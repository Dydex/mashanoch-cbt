"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import {
  authEmailFor,
  CLASSES,
  ADMISSION_NO_PATTERN,
  normalizeAdmissionNo,
  REVIEW_NOTE_MAX,
} from "@/lib/constants";
import { normalizeSurname, studentAuthPassword } from "@/lib/student-password";
import { isLocked } from "@/lib/test-status";

export type AdminState = {
  error?: string;
  notice?: string;
  /** Login details for a student just added. */
  issued?: Slip;
};

export type Slip = {
  fullName: string;
  username: string;
  /** The surname, which is the password. */
  password: string;
  class: string;
};

/**
 * Invites a teacher or admin.
 *
 * Staff never receive a password from us — they get an emailed link and choose
 * their own. Role is fixed here by the inviting admin and comes from trusted
 * server code, never from anything the invitee submits.
 */
export async function inviteStaff(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!fullName) return { error: "Enter the person's full name." };
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (role !== "teacher" && role !== "admin")
    return { error: "Choose teacher or admin." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { username: email, full_name: fullName, role },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/staff/set-password`,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { notice: `Invitation sent to ${email}. They choose their own password.` };
}

const NAME_MAX = 50;

/** A student's first and last name from a form, tidied of stray spaces. */
function readNames(
  formData: FormData,
): { error: string } | { first: string; last: string } {
  const tidy = (key: string) =>
    String(formData.get(key) ?? "").trim().replace(/\s+/g, " ");
  const first = tidy("first_name");
  const last = tidy("last_name");

  if (!first) return { error: "Enter the student's first name." };
  if (!last)
    return { error: "Enter the student's last name. It is their password." };
  if (first.length > NAME_MAX || last.length > NAME_MAX)
    return { error: `Keep each name under ${NAME_MAX} characters.` };
  return { first, last };
}

/**
 * Reads a admission number from a form, checks its shape, and confirms no one
 * else already has it. `except` is the student being edited, who may keep
 * their own number.
 */
async function claimAdmissionNo(
  formData: FormData,
  except?: string,
): Promise<{ error: string } | { admissionNo: string }> {
  const admissionNo = normalizeAdmissionNo(String(formData.get("admissionNo") ?? ""));
  if (!admissionNo) return { error: "Enter the student's admission number." };
  if (!ADMISSION_NO_PATTERN.test(admissionNo))
    return {
      error: "A admission number is 3 to 30 letters and digits, and may contain / - or .",
    };

  const { data: taken } = await createAdminClient()
    .from("profiles")
    .select("id, full_name")
    .eq("username", admissionNo)
    .maybeSingle();
  if (taken && taken.id !== except)
    return { error: `${admissionNo} already belongs to ${taken.full_name}.` };

  return { admissionNo };
}

/**
 * Creates a student account. They sign in with the admission number the admin
 * enters, stored as their username, and their surname as the password.
 *
 * Students have no email, so Supabase Auth gets a synthetic one derived from
 * the profile UUID — never from the admission number, so a mistyped number can
 * be corrected later without recreating the account.
 */
export async function createStudent(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const names = readNames(formData);
  if ("error" in names) return names;

  const klass = String(formData.get("class") ?? "");
  if (!CLASSES.includes(klass as (typeof CLASSES)[number]))
    return { error: "Choose a class." };

  const claimed = await claimAdmissionNo(formData);
  if ("error" in claimed) return claimed;
  const username = claimed.admissionNo;
  const fullName = `${names.first} ${names.last}`;

  const admin = createAdminClient();
  const id = randomUUID();

  const { error } = await admin.auth.admin.createUser({
    id,
    email: authEmailFor(id),
    password: studentAuthPassword(names.last),
    email_confirm: true,
    user_metadata: {
      username,
      full_name: fullName,
      role: "student",
      class: klass,
    },
  });

  if (error) return { error: error.message };

  // The on_auth_user_created trigger (0003) made the profile. The name
  // columns are filled in here, so that trigger can stay exactly as it is.
  const { error: nameError } = await admin
    .from("profiles")
    .update({ first_name: names.first, last_name: names.last })
    .eq("id", id);

  revalidatePath("/admin/students");
  return {
    issued: { fullName, username, password: names.last, class: klass },
    ...(nameError && {
      error: `Student created, but their first and last name were not saved separately: ${nameError.message}`,
    }),
  };
}

/**
 * Corrects a student's first name, last name and admission number. A new
 * surname is a new password, so Auth is updated first and the profile
 * follows. The account and its session are otherwise untouched.
 */
export async function updateStudent(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Missing student." };

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("profiles")
    .select("role, last_name")
    .eq("id", profileId)
    .maybeSingle();

  if (!student || student.role !== "student")
    return { error: "That is not a student account." };

  const names = readNames(formData);
  if ("error" in names) return names;
  const claimed = await claimAdmissionNo(formData, profileId);
  if ("error" in claimed) return claimed;

  const surnameChanged =
    normalizeSurname(names.last) !== normalizeSurname(student.last_name ?? "");
  if (surnameChanged) {
    const { error } = await admin.auth.admin.updateUserById(profileId, {
      password: studentAuthPassword(names.last),
    });
    if (error) return { error: error.message };
  }

  const { error } = await admin
    .from("profiles")
    .update({
      first_name: names.first,
      last_name: names.last,
      full_name: `${names.first} ${names.last}`,
      username: claimed.admissionNo,
    })
    .eq("id", profileId);
  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {
    notice: surnameChanged
      ? `Saved. Their password is now “${names.last}”.`
      : "Saved.",
  };
}

/**
 * Removes a teacher or admin.
 *
 * test_created_by_fkey is ON DELETE CASCADE, so deleting the account outright
 * would take their tests — and every question, submission and score attached
 * to them — with it. Past papers and results are exactly what a school needs
 * to keep, so any tests they own are transferred to the admin doing the
 * removal first, and only then is the account deleted.
 */
export async function removeStaff(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const me = await requireAdmin();

  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Missing account." };
  if (profileId === me.id)
    return { error: "You cannot remove your own account." };

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) return { error: "That account no longer exists." };
  if (target.role === "student")
    return { error: "Use the student list to remove a student." };

  const { count: owned } = await admin
    .from("test")
    .select("id", { count: "exact", head: true })
    .eq("created_by", profileId);

  if (owned && owned > 0) {
    const { error } = await admin
      .from("test")
      .update({ created_by: me.id })
      .eq("created_by", profileId);
    if (error)
      return { error: `Could not transfer their tests: ${error.message}` };
  }

  // Deleting the auth user cascades to profiles via profiles_id_fkey.
  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {
    notice:
      owned && owned > 0
        ? `${target.full_name} removed. ${owned} test${owned === 1 ? "" : "s"} transferred to you.`
        : `${target.full_name} removed.`,
  };
}

const STALE =
  "This test changed while you were reviewing it. Reload the page to see the latest version.";

/**
 * An admin's decision on a test, or a comment on it.
 *
 *   approve  students may sit it once its window opens
 *   changes  sends it back to the teacher, with a note saying what to fix
 *   comment  adds to the thread and changes nothing else
 *
 * Every entry lands in test_reviews, so the teacher and every admin read the
 * same history.
 */
export async function reviewTest(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const me = await requireAdmin();

  const testId = String(formData.get("test_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!testId) return { error: "Missing test." };
  if (decision !== "approve" && decision !== "changes" && decision !== "comment")
    return { error: "Choose what to do with this test." };
  if (note.length > REVIEW_NOTE_MAX)
    return { error: `Keep the note under ${REVIEW_NOTE_MAX} characters.` };

  const admin = createAdminClient();
  const { data: test } = await admin
    .from("test")
    .select("created_by, approval_status, start_time, end_time, questions(count)")
    .eq("id", testId)
    .maybeSingle();

  if (!test) return { error: "That test no longer exists." };

  const record = async (kind: "approved" | "changes_requested" | "comment") => {
    const { error } = await admin.from("test_reviews").insert({
      test_id: testId,
      author_id: me.id,
      kind,
      body: note || null,
    });
    revalidatePath(`/teacher/${testId}`);
    revalidatePath("/teacher");
    revalidatePath("/admin/reviews");
    return error;
  };

  // Moves the test on, but only from the status just read. If the teacher
  // changed it in the meantime, nothing moves.
  const move = async (to: "approved" | "changes_requested") => {
    const { data, error } = await admin
      .from("test")
      .update({ approval_status: to })
      .eq("id", testId)
      .eq("approval_status", test.approval_status)
      .select("id");
    if (error) return error.message;
    return data?.length ? null : STALE;
  };

  if (decision === "comment") {
    if (!note) return { error: "Write your comment first." };
    const error = await record("comment");
    return error ? { error: error.message } : { notice: "Comment added." };
  }

  // Students may already be sitting it. Pulling it now would strand them.
  if (isLocked(test))
    return { error: "This test has already started, so its approval can no longer change." };

  if (decision === "changes") {
    if (!note)
      return { error: "Say what needs to change, so the teacher knows what to fix." };
    const moveError = await move("changes_requested");
    if (moveError) return { error: moveError };
    const error = await record("changes_requested");
    return error
      ? { error: `Sent back, but your note was not saved: ${error.message}` }
      : { notice: "Sent back to the teacher with your note." };
  }

  if (test.approval_status === "approved")
    return { error: "This test is already approved." };

  // An admin's own test has nobody to submit it to. Anyone else's must come
  // from its teacher first, so what gets approved is what they meant to hand in.
  if (test.created_by !== me.id) {
    if (test.approval_status !== "pending")
      return { error: "The teacher has not submitted this test for approval yet." };

    // Approve only the submission this admin actually looked at. Any edit
    // sends a pending test back to draft, so if the latest submission is the
    // one the page showed, the paper is unchanged since it was opened.
    const { data: latest } = await admin
      .from("test_reviews")
      .select("id")
      .eq("test_id", testId)
      .eq("kind", "submitted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if ((latest?.id ?? "") !== String(formData.get("submission_id") ?? ""))
      return { error: STALE };
  }

  const questions = (test.questions as { count: number }[])[0]?.count ?? 0;
  if (questions === 0) return { error: "This test has no questions yet." };
  if (new Date(test.end_time).getTime() <= Date.now())
    return { error: "This test's closing time has already passed. Its dates need changing before it can be approved." };

  const moveError = await move("approved");
  if (moveError) return { error: moveError };
  const error = await record("approved");
  if (error) return { error: `Approved, but your note was not saved: ${error.message}` };

  return {
    notice:
      new Date(test.start_time).getTime() <= Date.now()
        ? "Approved. It is open to students now."
        : "Approved. Students can sit it once its window opens.",
  };
}
