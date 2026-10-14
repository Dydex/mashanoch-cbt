"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import {
  ADMISSION_NO_PATTERN,
  authEmailFor,
  CLASSES,
  defaultDepartment,
  isDepartment,
  isSenior,
  normalizeAdmissionNo,
  REOPEN_MAX_DAYS,
  REVIEW_NOTE_MAX,
  type Department,
} from "@/lib/constants";
import { normalizeSurname, studentAuthPassword } from "@/lib/student-password";
import { isLocked } from "@/lib/test-status";
import { parseSchoolTime, timeFmt } from "@/lib/time";

export type AdminState = {
  error?: string;
  notice?: string;
  issued?: Slip;
  imported?: { created: number; problems: string[]; warnings: string[] };
};

export type Slip = {
  fullName: string;
  username: string;
  password: string;
  class: string;
  department: Department | null;
};

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

async function createStudentAccount(details: {
  first: string;
  last: string;
  admissionNo: string;
  klass: string;
  department: Department | null;
}): Promise<{ error: string } | { id: string }> {
  const id = randomUUID();
  const { error } = await createAdminClient().auth.admin.createUser({
    id,
    email: authEmailFor(id),
    password: studentAuthPassword(details.last),
    email_confirm: true,
    app_metadata: { role: "student" },
    user_metadata: {
      username: details.admissionNo,
      full_name: `${details.first} ${details.last}`,
      role: "student",
      class: details.klass,
      department: details.department ?? "",
      first_name: details.first,
      last_name: details.last,
    },
  });
  return error ? { error: error.message } : { id };
}

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

  const department = defaultDepartment(klass, claimed.admissionNo);
  const made = await createStudentAccount({
    first: names.first,
    last: names.last,
    admissionNo: claimed.admissionNo,
    klass,
    department,
  });
  if ("error" in made) return { error: made.error };
  revalidatePath("/admin/students");
  return {
    issued: {
      fullName: `${names.first} ${names.last}`,
      username: claimed.admissionNo,
      password: names.last,
      class: klass,
      department,
    },
    ...(isSenior(klass) &&
      !department && {
        notice: `${claimed.admissionNo} does not start with MPSS, MPSH or MPSC, so no department was set. Choose one with Edit.`,
      }),
  };
}

const IMPORT_MAX = 200;

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
  const problems: string[] = [];
  const warnings: string[] = [];
  const ready: {
    row: number;
    first: string;
    last: string;
    admissionNo: string;
    klass: string;
    department: Department | null;
  }[] = [];

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
    const department = defaultDepartment(klass, admissionNo);
    if (isSenior(klass) && !department)
      warnings.push(
        `${where}: ${admissionNo} is in ${klass} but does not start with MPSS, MPSH or MPSC, so no department was set.`,
      );
    ready.push({ row: n + 2, first, last, admissionNo, klass, department });
  });
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
    imported: { created, problems, warnings },
    notice: `${created} student${created === 1 ? "" : "s"} added${
      problems.length ? `, ${problems.length} row${problems.length === 1 ? "" : "s"} skipped` : ""
    }.`,
  };
}

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
    .select("role, last_name, username, department")
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

  const chosen = String(formData.get("department") ?? "");
  if (chosen && !isDepartment(chosen))
    return { error: "Choose Science, Art or Commercial." };
  const renumbered = claimed.admissionNo !== student.username;
  const keepChosen =
    chosen && !(chosen === (student.department ?? "") && renumbered);
  const department: Department | null = !isSenior(klass)
    ? null
    : keepChosen
      ? (chosen as Department)
      : defaultDepartment(klass, claimed.admissionNo);

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
      department,
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
  const departmentNote =
    isSenior(next) && !isSenior(klass)
      ? " Give each a department with Edit, or a new admission number starting MPSS, MPSH or MPSC."
      : "";
  return {
    notice: `${count} student${count === 1 ? "" : "s"} moved from ${klass} to ${next}.${departmentNote}`,
  };
}

function readSubject(
  formData: FormData,
): { error: string } | { name: string; department: Department | null } {
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const department = String(formData.get("department") ?? "");
  if (name.length < 2) return { error: "Enter the subject's name." };
  if (name.length > 60) return { error: "Keep the name under 60 characters." };
  if (department && !isDepartment(department))
    return { error: "Choose Science, Art, Commercial or General." };
  return { name, department: (department || null) as Department | null };
}

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
  const read = readSubject(formData);
  if ("error" in read) return read;
  if (await subjectNameTaken(read.name))
    return { error: `${read.name} is already on the list.` };

  const { error } = await createAdminClient()
    .from("subjects")
    .insert({ name: read.name, department: read.department });
  if (error) return { error: error.message };
  revalidatePath("/admin/subjects");
  revalidatePath("/teacher/new");
  return { notice: `${read.name} added.` };
}

export async function updateSubject(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const id = String(formData.get("subject_id") ?? "");
  if (!id) return { error: "Missing subject." };
  const read = readSubject(formData);
  if ("error" in read) return read;
  if (await subjectNameTaken(read.name, id))
    return { error: `${read.name} is already on the list.` };

  const { error } = await createAdminClient()
    .from("subjects")
    .update({ name: read.name, department: read.department })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/subjects");
  revalidatePath("/teacher");
  return { notice: `${read.name} saved.` };
}

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

  if (test.created_by !== me.id) {
    if (test.approval_status !== "pending")
      return { error: "The teacher has not submitted this test for approval yet." };

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

export async function reopenTest(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const me = await requireAdmin();

  const testId = String(formData.get("test_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!testId) return { error: "Missing test." };
  if (!reason) return { error: "Say why you are reopening it." };
  if (reason.length > REVIEW_NOTE_MAX)
    return { error: `Keep the reason under ${REVIEW_NOTE_MAX} characters.` };

  const closesAt = parseSchoolTime(String(formData.get("closes_at") ?? ""));
  if (!closesAt) return { error: "Choose when it should close." };

  const admin = createAdminClient();
  const { data: test } = await admin
    .from("test")
    .select("approval_status, end_time")
    .eq("id", testId)
    .maybeSingle();
  if (!test) return { error: "That test no longer exists." };
  if (test.approval_status !== "approved")
    return { error: "Only an approved test can be reopened." };

  const currentEnd = new Date(test.end_time);
  if (closesAt <= currentEnd)
    return {
      error: `Choose a time after its current closing time, ${timeFmt.format(currentEnd)}.`,
    };
  if (closesAt.getTime() <= Date.now())
    return { error: "Choose a time in the future." };
  if (closesAt.getTime() > Date.now() + REOPEN_MAX_DAYS * 86_400_000)
    return {
      error: `A test can be reopened for at most ${REOPEN_MAX_DAYS} days at a time.`,
    };

  const { data: moved, error } = await admin
    .from("test")
    .update({ end_time: closesAt.toISOString() })
    .eq("id", testId)
    .eq("approval_status", "approved")
    .select("id");
  if (error) return { error: error.message };
  if (!moved?.length) return { error: STALE };

  const until = timeFmt.format(closesAt);
  const { error: logError } = await admin.from("test_reviews").insert({
    test_id: testId,
    author_id: me.id,
    kind: "comment",
    body: `Reopened until ${until}. Reason: ${reason}`,
  });

  revalidatePath(`/teacher/${testId}`);
  revalidatePath("/teacher");
  revalidatePath("/admin/results");
  revalidatePath("/exam");
  return {
    notice: logError
      ? `Reopened until ${until}, but the note was not saved: ${logError.message}`
      : `Reopened until ${until}.`,
  };
}
