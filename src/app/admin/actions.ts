"use server";

import { randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { authEmailFor, CLASSES, REVIEW_NOTE_MAX } from "@/lib/constants";
import { isLocked } from "@/lib/test-status";
import { schoolParts } from "@/lib/time";

export type AdminState = {
  error?: string;
  notice?: string;
  /** Shown once, so the admin can write the slip. Never recoverable after. */
  issued?: Slip;
  /** Same, for a whole class at once. */
  issuedBatch?: Slip[];
};

export type Slip = {
  fullName: string;
  username: string;
  pin: string;
  class: string;
};

// Ambiguous characters (0/O, 1/l/I) left out — these get read off paper.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const newPin = () =>
  Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

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

/**
 * Creates a student account and issues an ID and PIN.
 *
 * Students have no email, so Supabase Auth gets a synthetic one derived from
 * the profile UUID — never from the username, so the school can swap in real
 * admission numbers later without recreating accounts or reissuing PINs.
 */
export async function createStudent(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const klass = String(formData.get("class") ?? "");

  if (!fullName) return { error: "Enter the student's full name." };
  if (!CLASSES.includes(klass as (typeof CLASSES)[number]))
    return { error: "Choose a class." };

  const admin = createAdminClient();

  // IDs are <2-digit join year><4-digit serial>, e.g. 260147.
  const prefix = String(schoolParts().year).slice(-2);
  const { data: existing } = await admin
    .from("profiles")
    .select("username")
    .like("username", `${prefix}%`)
    .order("username", { ascending: false })
    .limit(1);

  const lastSerial = existing?.[0]
    ? Number(existing[0].username.slice(2))
    : 0;
  const username = `${prefix}${String(lastSerial + 1).padStart(4, "0")}`;

  const pin = newPin();
  const id = randomUUID();

  const { error } = await admin.auth.admin.createUser({
    id,
    email: authEmailFor(id),
    password: pin,
    email_confirm: true,
    user_metadata: {
      username,
      full_name: fullName,
      role: "student",
      class: klass,
    },
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { issued: { fullName, username, pin, class: klass } };
}

/** Issues a fresh PIN. The old one stops working immediately. */
export async function resetStudentPin(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Missing student." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("username, full_name, role, class")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile || profile.role !== "student")
    return { error: "That is not a student account." };

  const pin = newPin();
  const { error } = await admin.auth.admin.updateUserById(profileId, {
    password: pin,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {
    issued: {
      fullName: profile.full_name,
      username: profile.username,
      pin,
      class: profile.class ?? "",
    },
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


/**
 * Regenerates the PIN for every student in one class.
 *
 * This is the answer to "reset everyone after the exam period" without giving
 * students a shared PIN. Each student still gets their own secret, so one
 * pupil can never sign in as another — but the admin does it in one action
 * and prints one sheet.
 *
 * The new PINs are returned once and are not recoverable afterwards: Supabase
 * stores only a hash, which is what stops a database leak handing over every
 * account.
 */
export async function resetClassPins(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const klass = String(formData.get("class") ?? "");
  if (!CLASSES.includes(klass as (typeof CLASSES)[number]))
    return { error: "Choose a class." };

  const admin = createAdminClient();
  const { data: students } = await admin
    .from("profiles")
    .select("id, username, full_name, class")
    .eq("role", "student")
    .eq("class", klass)
    .order("full_name");

  if (!students?.length)
    return { error: `No students in ${klass}.` };

  const slips: Slip[] = [];
  const failed: string[] = [];

  // Small batches rather than one big Promise.all: this hits the auth admin
  // API once per student and a whole class at once invites rate limiting.
  for (let i = 0; i < students.length; i += 5) {
    const chunk = students.slice(i, i + 5);
    await Promise.all(
      chunk.map(async (student) => {
        const pin = newPin();
        const { error } = await admin.auth.admin.updateUserById(student.id, {
          password: pin,
        });
        if (error) {
          failed.push(student.full_name);
          return;
        }
        slips.push({
          fullName: student.full_name,
          username: student.username,
          pin,
          class: student.class ?? klass,
        });
      }),
    );
  }

  slips.sort((a, b) => a.fullName.localeCompare(b.fullName));

  revalidatePath("/admin/students");
  return {
    issuedBatch: slips,
    notice: failed.length
      ? `${slips.length} PINs reset. Failed for: ${failed.join(", ")}.`
      : `${slips.length} PINs reset for ${klass}. Print this sheet now — they cannot be shown again.`,
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
