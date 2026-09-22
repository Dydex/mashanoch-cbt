"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import {
  ADMISSION_NO_PATTERN,
  authEmailFor,
  CLASSES,
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
  /** What a spreadsheet import did, row by row. */
  imported?: { created: number; problems: string[] };
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
 * server code, never from anything the invitee submits: an invitation cannot
 * carry app metadata, so the new account starts as a student (0015) and is
 * moved to its real role here, with the service role.
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
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { username: email, full_name: fullName, role },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/staff/set-password`,
  });

  if (error) return { error: error.message };

  if (invited?.user) {
    await admin.auth.admin.updateUserById(invited.user.id, {
      app_metadata: { role },
    });
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", invited.user.id);
    if (roleError)
      return {
        error: `Invitation sent, but their role was not set: ${roleError.message}`,
      };
  }

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
 * Reads an admission number from a form, checks its shape, and confirms no
 * one else already has it. `except` is the student being edited, who may keep
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
      error: "An admission number is 3 to 30 letters and digits, and may contain / - or .",
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

/** One new student account, from details already checked. */
async function createStudentAccount(details: {
  first: string;
  last: string;
  admissionNo: string;
  klass: string;
}): Promise<{ error: string } | { id: string }> {
  const id = randomUUID();
  const { error } = await createAdminClient().auth.admin.createUser({
    id,
    email: authEmailFor(id),
    password: studentAuthPassword(details.last),
    email_confirm: true,
    // The profile's role is read from app metadata, which only the service
    // role can set (0015).
    app_metadata: { role: "student" },
    user_metadata: {
      username: details.admissionNo,
      full_name: `${details.first} ${details.last}`,
      role: "student",
      class: details.klass,
      first_name: details.first,
      last_name: details.last,
    },
  });
  return error ? { error: error.message } : { id };
}

/**
 * Creates a student account. They sign in with the admission number the admin
 * enters, stored as their username, and their surname as the password.
 *
 * Students have no email, so Supabase Auth gets a synthetic one derived from
 * the profile UUID — never from the admission number, so a mistyped number
 * can be corrected later without recreating the account.
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

  const made = await createStudentAccount({
    first: names.first,
    last: names.last,
    admissionNo: claimed.admissionNo,
    klass,
  });
  if ("error" in made) return { error: made.error };

  revalidatePath("/admin/students");
  return {
    issued: {
      fullName: `${names.first} ${names.last}`,
      username: claimed.admissionNo,
      password: names.last,
      class: klass,
    },
  };
}

const IMPORT_MAX = 200;

/** Splits one line of a CSV, honouring "quoted, fields". */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/**
 * Adds a whole list of students from a spreadsheet saved as CSV.
 *
 * The first row names the columns; order does not matter. Every row is
 * checked before anything is created, and a row that cannot be used is
 * reported and skipped rather than stopping the rest.
 */
export async function importStudents(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Choose a CSV file to upload." };
  if (file.size > 1_000_000)
    return { error: "That file is over 1 MB. Split it into smaller files." };

  const lines = (await file.text())
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2)
    return { error: "That file has no rows under its column names." };

  const header = splitCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/[\s_-]+/g, ""),
  );
  const columnFor = (...names: string[]) =>
    header.findIndex((h) => names.includes(h));
  const at = {
    first: columnFor("firstname", "first", "firstnames", "givenname"),
    last: columnFor("lastname", "last", "surname"),
    admissionNo: columnFor("admissionno", "admissionnumber", "admission"),
    klass: columnFor("class", "classname"),
  };
  if (Object.values(at).some((i) => i < 0))
    return {
      error:
        "The first row must name the columns: first_name, last_name, admission_no, class.",
    };

  const rows = lines.slice(1);
  if (rows.length > IMPORT_MAX)
    return {
      error: `That file has ${rows.length} rows. Import at most ${IMPORT_MAX} at a time.`,
    };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("username");
  const taken = new Set((existing ?? []).map((p) => p.username));

  // Checked first, so a duplicate inside the file is caught as well.
  const problems: string[] = [];
  const ready: { row: number; first: string; last: string; admissionNo: string; klass: string }[] = [];

  rows.forEach((line, n) => {
    const cells = splitCsvLine(line);
    const cell = (i: number) => (cells[i] ?? "").trim().replace(/\s+/g, " ");
    const where = `Row ${n + 2}`;
    const first = cell(at.first);
    const last = cell(at.last);
    const admissionNo = normalizeAdmissionNo(cell(at.admissionNo));
    const klass = cell(at.klass).toUpperCase();

    if (!first || !last) {
      problems.push(`${where}: missing a first or last name.`);
      return;
    }
    if (first.length > NAME_MAX || last.length > NAME_MAX) {
      problems.push(`${where}: a name is longer than ${NAME_MAX} characters.`);
      return;
    }
    if (!ADMISSION_NO_PATTERN.test(admissionNo)) {
      problems.push(`${where}: “${cell(at.admissionNo)}” is not a valid admission number.`);
      return;
    }
    if (taken.has(admissionNo)) {
      problems.push(`${where}: ${admissionNo} is already taken.`);
      return;
    }
    if (!CLASSES.includes(klass as (typeof CLASSES)[number])) {
      problems.push(`${where}: “${cell(at.klass)}” is not one of ${CLASSES.join(", ")}.`);
      return;
    }
    taken.add(admissionNo);
    ready.push({ row: n + 2, first, last, admissionNo, klass });
  });

  // Small batches: this hits the auth admin API once per student, and a whole
  // class at once invites rate limiting.
  let created = 0;
  for (let i = 0; i < ready.length; i += 5) {
    const chunk = ready.slice(i, i + 5);
    const results = await Promise.all(
      chunk.map(async (student) => ({
        student,
        made: await createStudentAccount(student),
      })),
    );
    for (const { student, made } of results) {
      if ("error" in made) problems.push(`Row ${student.row}: ${made.error}`);
      else created += 1;
    }
  }

  revalidatePath("/admin/students");
  return {
    imported: { created, problems },
    notice: `${created} student${created === 1 ? "" : "s"} added${
      problems.length ? `, ${problems.length} row${problems.length === 1 ? "" : "s"} skipped` : ""
    }.`,
  };
}

/**
 * Corrects a student's first name, last name, admission number and class. A
 * new surname is a new password, so Auth is updated first and the profile
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
  const klass = String(formData.get("class") ?? "");
  if (!CLASSES.includes(klass as (typeof CLASSES)[number]))
    return { error: "Choose a class." };
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
      class: klass,
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
 * Removes a student, with everything they sat.
 *
 * Their answers and submissions go first, so the delete cannot fail on a
 * foreign key; deleting the auth account then takes the profile with it.
 */
export async function removeStudent(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Missing student." };

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", profileId)
    .maybeSingle();

  if (!student || student.role !== "student")
    return { error: "That is not a student account." };

  const { data: submissions } = await admin
    .from("submissions")
    .select("id")
    .eq("student_id", profileId);
  const ids = (submissions ?? []).map((s) => s.id);
  if (ids.length) {
    await admin.from("answers").delete().in("submission_id", ids);
    await admin.from("submissions").delete().in("id", ids);
  }

  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return {
    notice: `${student.full_name} removed${
      ids.length ? `, with ${ids.length} result${ids.length === 1 ? "" : "s"}` : ""
    }.`,
  };
}

/**
 * Moves a whole class up a year, the way a school does at the end of a
 * session: JSS1 becomes JSS2, and so on. A student who repeats the year is
 * put back with Edit afterwards, and the final class has nowhere to go —
 * those students are removed once they leave.
 */
export async function promoteClass(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const klass = String(formData.get("class") ?? "");
  const step = CLASSES.indexOf(klass as (typeof CLASSES)[number]);
  if (step < 0) return { error: "Choose a class." };

  const next = CLASSES[step + 1];
  if (!next)
    return {
      error: `${klass} is the final class, so there is nowhere to promote to. Remove those students once they have left.`,
    };

  const admin = createAdminClient();
  const { data: moved, error } = await admin
    .from("profiles")
    .update({ class: next })
    .eq("role", "student")
    .eq("class", klass)
    .select("id");

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  const count = moved?.length ?? 0;
  return {
    notice: `${count} student${count === 1 ? "" : "s"} moved from ${klass} to ${next}.`,
  };
}

/** A subject's name, tidied, or why it cannot be used. */
function readSubjectName(formData: FormData): { error: string } | { name: string } {
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2) return { error: "Enter the subject's name." };
  if (name.length > 60) return { error: "Keep the name under 60 characters." };
  return { name };
}

/** True when another subject already goes by this name. */
async function subjectNameTaken(name: string, except?: string) {
  const { data } = await createAdminClient()
    .from("subjects")
    .select("id")
    .ilike("name", name.replace(/[%_]/g, "\\$&"))
    .maybeSingle();
  return Boolean(data && data.id !== except);
}

export async function createSubject(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const read = readSubjectName(formData);
  if ("error" in read) return read;
  if (await subjectNameTaken(read.name))
    return { error: `${read.name} is already on the list.` };

  const { error } = await createAdminClient()
    .from("subjects")
    .insert({ name: read.name });
  if (error) return { error: error.message };

  revalidatePath("/admin/subjects");
  revalidatePath("/teacher/new");
  return { notice: `${read.name} added.` };
}

export async function renameSubject(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const id = String(formData.get("subject_id") ?? "");
  if (!id) return { error: "Missing subject." };

  const read = readSubjectName(formData);
  if ("error" in read) return read;
  if (await subjectNameTaken(read.name, id))
    return { error: `${read.name} is already on the list.` };

  const { error } = await createAdminClient()
    .from("subjects")
    .update({ name: read.name })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/subjects");
  revalidatePath("/teacher");
  return { notice: `Renamed to ${read.name}.` };
}

/** Removes a subject, unless tests already use it. */
export async function deleteSubject(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const id = String(formData.get("subject_id") ?? "");
  if (!id) return { error: "Missing subject." };

  const admin = createAdminClient();
  const { count } = await admin
    .from("test")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", id);
  if (count)
    return {
      error: `${count} test${count === 1 ? " uses" : "s use"} this subject, so it cannot be removed. Rename it instead.`,
    };

  const { error } = await admin.from("subjects").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/subjects");
  return { notice: "Subject removed." };
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
    .select(
      "created_by, approval_status, start_time, end_time, questions(count), submissions(count)",
    )
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

  // A student is already sitting it. Pulling it now would strand them.
  const sat = (test.submissions as { count: number }[])[0]?.count ?? 0;
  if (isLocked(test, sat))
    return { error: "A student has already started this test, so its approval can no longer change." };

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
