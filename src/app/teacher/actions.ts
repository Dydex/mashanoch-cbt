"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher, requireTestOwner } from "@/lib/auth";
import { CLASSES, REVIEW_NOTE_MAX, TERMS } from "@/lib/constants";
import { isLocked } from "@/lib/test-status";
import { parseSchoolTime } from "@/lib/time";
import { readQuestionImage } from "@/lib/question-image";
import { removeTestImages, storeQuestionImage } from "@/lib/question-image-store";

export type ActionState = { error?: string; notice?: string };

/**
 * Every action below re-checks authorisation. Server Actions are POST endpoints
 * reachable without our UI, so a guard on the page does not protect them.
 */

/**
 * A test's paper is frozen once it is approved and a student has started it,
 * so nobody has questions change underneath them mid-exam. Database triggers
 * enforce this for real (0008, amended by 0010 and 0015); this check exists
 * so the teacher gets a readable message instead of a raw Postgres exception.
 *
 * An edit that gets past this check sends a pending or approved test back to
 * draft. That also happens in the database, so no action here repeats it.
 */
async function testIsLocked(testId: string): Promise<boolean> {
  const admin = createAdminClient();
  const [{ data: test }, { count }] = await Promise.all([
    admin.from("test").select("approval_status").eq("id", testId).single(),
    admin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("test_id", testId),
  ]);
  if (!test) return true;
  return isLocked(test, count ?? 0);
}

const STARTED =
  "A student has already started this test, so its questions can no longer be changed.";

type TestFields = {
  title: string;
  description: string | null;
  subject_id: string;
  class: string;
  term: string;
  session: string;
  duration_minutes: number;
  start_time: string;
  end_time: string;
};

/** The details form, validated the same way for creating and editing. */
function readTestForm(
  formData: FormData,
): { error: string } | { fields: TestFields } {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "");
  const klass = String(formData.get("class") ?? "");
  const term = String(formData.get("term") ?? "");
  const session = String(formData.get("session") ?? "").trim();
  const duration = Number(formData.get("duration_minutes"));
  const startRaw = String(formData.get("start_time") ?? "");
  const endRaw = String(formData.get("end_time") ?? "");

  if (!title) return { error: "Give the test a title." };
  if (!subjectId) return { error: "Choose a subject." };
  if (!CLASSES.includes(klass as (typeof CLASSES)[number]))
    return { error: "Choose a class." };
  if (!TERMS.includes(term as (typeof TERMS)[number]))
    return { error: "Choose a term." };
  if (!/^\d{4}\/\d{4}$/.test(session))
    return { error: "Session must look like 2026/2027." };
  if (!Number.isFinite(duration) || duration < 1)
    return { error: "Duration must be at least 1 minute." };
  if (!startRaw || !endRaw) return { error: "Set the opening and closing time." };

  // School time, not the server's: see src/lib/time.ts.
  const start = parseSchoolTime(startRaw);
  const end = parseSchoolTime(endRaw);
  if (!start || !end) return { error: "That date is not valid." };
  if (end <= start) return { error: "Closing time must be after opening time." };

  return {
    fields: {
      title,
      description: description || null,
      subject_id: subjectId,
      class: klass,
      term,
      session,
      duration_minutes: duration,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    },
  };
}

export async function createTest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireTeacher();

  const parsed = readTestForm(formData);
  if ("error" in parsed) return parsed;

  // User client: RLS confirms this account may create tests, and the policy
  // requires created_by = auth.uid(), so a teacher cannot forge authorship.
  // Every test starts as a draft; students cannot see it until it is approved.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test")
    .insert({ ...parsed.fields, created_by: profile.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/teacher");
  redirect(`/teacher/${data.id}`);
}

/**
 * Edits a test's details: title, subject, class, window and so on.
 *
 * Goes through the user client, like createTest, so RLS decides who may edit.
 * The guard_test_approval trigger then sends a pending or approved test back
 * to draft, because what an admin approved is no longer what is there.
 */
export async function updateTest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const testId = String(formData.get("test_id") ?? "");
  if (!testId) return { error: "Missing test." };

  await requireTestOwner(testId);

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("test")
    .select("approval_status")
    .eq("id", testId)
    .single();
  if (!before) return { error: "That test no longer exists." };
  if (await testIsLocked(testId))
    return { error: "A student has already started this test, so its details can no longer be changed." };

  const parsed = readTestForm(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const { data: after, error } = await supabase
    .from("test")
    .update(parsed.fields)
    .eq("id", testId)
    .select("approval_status")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/teacher/${testId}`);
  revalidatePath("/teacher");

  return {
    notice:
      after.approval_status !== before.approval_status
        ? "Saved. The test is back in draft, so submit it for approval again when you're ready."
        : "Saved.",
  };
}

/**
 * Deletes a test, with its questions, approval thread and any images.
 *
 * Only while nobody has sat it: a test with submissions is a record of
 * results, which a school needs to keep.
 */
export async function deleteTest(formData: FormData): Promise<void> {
  const testId = String(formData.get("test_id") ?? "");
  if (!testId) return;

  await requireTestOwner(testId);

  const admin = createAdminClient();
  const { count } = await admin
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("test_id", testId);
  if (count) redirect(`/teacher/${testId}`);

  // Questions, options and the review thread all cascade from the test row;
  // pictures live in storage, so they are cleared separately.
  await removeTestImages(testId);
  await admin.from("test").delete().eq("id", testId);

  revalidatePath("/teacher");
  redirect("/teacher");
}

/**
 * Hands a test to the admins. Students cannot see it until one approves it.
 */
export async function submitForReview(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const testId = String(formData.get("test_id") ?? "");
  if (!testId) return { error: "Missing test." };

  const profile = await requireTestOwner(testId);

  const note = String(formData.get("note") ?? "").trim();
  if (note.length > REVIEW_NOTE_MAX)
    return { error: `Keep the note under ${REVIEW_NOTE_MAX} characters.` };

  // Service role: authenticated clients cannot change approval_status at all
  // (see guard_test_approval). Ownership was verified above.
  const admin = createAdminClient();
  const { data: test } = await admin
    .from("test")
    .select("approval_status, end_time, questions(count)")
    .eq("id", testId)
    .single();

  if (!test) return { error: "That test no longer exists." };
  if (test.approval_status === "pending")
    return { error: "This test is already waiting for approval." };
  if (test.approval_status === "approved")
    return { error: "This test has already been approved." };

  const questions = (test.questions as { count: number }[])[0]?.count ?? 0;
  if (questions === 0)
    return { error: "Add at least one question before submitting." };
  if (new Date(test.end_time).getTime() <= Date.now())
    return { error: "This test's closing time has already passed. Change its dates before submitting." };

  // Conditional on the status just read, so a double submit moves it once.
  const { data: moved, error } = await admin
    .from("test")
    .update({ approval_status: "pending" })
    .eq("id", testId)
    .eq("approval_status", test.approval_status)
    .select("id");

  if (error) return { error: error.message };
  if (!moved?.length)
    return { error: "This test changed while you were submitting it. Reload the page and try again." };

  const { error: logError } = await admin.from("test_reviews").insert({
    test_id: testId,
    author_id: profile.id,
    kind: "submitted",
    body: note || null,
  });

  revalidatePath(`/teacher/${testId}`);
  revalidatePath("/teacher");
  revalidatePath("/admin/reviews");

  if (logError)
    return { error: `Submitted, but your note was not saved: ${logError.message}` };
  return { notice: "Submitted. An admin will review it before students can see it." };
}

export async function addQuestion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const testId = String(formData.get("test_id") ?? "");
  if (!testId) return { error: "Missing test." };

  await requireTestOwner(testId);
  if (await testIsLocked(testId)) return { error: STARTED };

  const text = String(formData.get("question_text") ?? "").trim();
  if (!text) return { error: "Write the question." };

  const image = readQuestionImage(formData);
  if ("error" in image) return image;

  const options = [0, 1, 2, 3]
    .map((i) => String(formData.get(`option_${i}`) ?? "").trim())
    .map((value, index) => ({ value, index }))
    .filter((o) => o.value.length > 0);

  if (options.length < 2) return { error: "Give at least two options." };

  const correctIndex = Number(formData.get("correct"));
  if (!options.some((o) => o.index === correctIndex))
    return { error: "Mark which option is correct." };

  // Service role: `authenticated` has no write grant on question_options at
  // all, because that table holds is_correct. Ownership was verified above.
  const admin = createAdminClient();

  const { data: last } = await admin
    .from("questions")
    .select("order_index")
    .eq("test_id", testId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIndex = (last?.order_index ?? 0) + 1;

  const { data: question, error: qError } = await admin
    .from("questions")
    .insert({ test_id: testId, question_text: text, order_index: nextIndex })
    .select("id")
    .single();

  if (qError) return { error: qError.message };

  const { error: oError } = await admin.from("question_options").insert(
    options.map((o) => ({
      question_id: question.id,
      option_text: o.value,
      is_correct: o.index === correctIndex,
    })),
  );

  if (oError) {
    // Don't leave a question with no options behind.
    await admin.from("questions").delete().eq("id", question.id);
    return { error: oError.message };
  }

  if (image.file) {
    const stored = await storeQuestionImage(testId, question.id, image.file);
    if ("error" in stored) return { error: stored.error };
    await admin
      .from("questions")
      .update({ image_url: stored.url })
      .eq("id", question.id);
  }

  revalidatePath(`/teacher/${testId}`);
  return {};
}

export async function deleteQuestion(formData: FormData): Promise<void> {
  const testId = String(formData.get("test_id") ?? "");
  const questionId = String(formData.get("question_id") ?? "");
  if (!testId || !questionId) return;

  await requireTestOwner(testId);
  if (await testIsLocked(testId)) return;

  const admin = createAdminClient();
  // Options cascade via the foreign key.
  await admin.from("questions").delete().eq("id", questionId).eq("test_id", testId);

  revalidatePath(`/teacher/${testId}`);
}

/**
 * Edits an existing question, its image and its options.
 *
 * Options are updated in place by id rather than deleted and recreated:
 * answers.selected_option_id points at these rows, so recreating them would
 * blank out every answer students have already saved.
 *
 * Ordering matters. `question_options_one_correct` is a partial unique index
 * (one correct row per question), so the old correct answer has to be cleared
 * before the new one is set, or the update collides with the index.
 */
export async function updateQuestion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const testId = String(formData.get("test_id") ?? "");
  const questionId = String(formData.get("question_id") ?? "");
  if (!testId || !questionId) return { error: "Missing question." };

  await requireTestOwner(testId);
  if (await testIsLocked(testId)) return { error: STARTED };

  const text = String(formData.get("question_text") ?? "").trim();
  if (!text) return { error: "The question cannot be empty." };

  const image = readQuestionImage(formData);
  if ("error" in image) return image;
  const removeImage = formData.get("remove_image") === "on";

  const slots = [0, 1, 2, 3].map((i) => ({
    id: String(formData.get(`option_id_${i}`) ?? ""),
    text: String(formData.get(`option_${i}`) ?? "").trim(),
  }));

  const filled = slots.filter((s) => s.text.length > 0);
  if (filled.length < 2) return { error: "Give at least two options." };

  const correctIndex = Number(formData.get("correct"));
  const correctSlot = slots[correctIndex];
  if (!correctSlot?.text) return { error: "Mark which option is correct." };

  const admin = createAdminClient();

  // 1. Clear the existing correct answer so the unique index is free.
  await admin
    .from("question_options")
    .update({ is_correct: false })
    .eq("question_id", questionId);

  // 2. The question text, and its image if it changed.
  const changes: { question_text: string; image_url?: string | null } = {
    question_text: text,
  };
  if (image.file) {
    const stored = await storeQuestionImage(testId, questionId, image.file);
    if ("error" in stored) return { error: stored.error };
    changes.image_url = stored.url;
  } else if (removeImage) {
    changes.image_url = null;
  }

  const { error: qError } = await admin
    .from("questions")
    .update(changes)
    .eq("id", questionId)
    .eq("test_id", testId);
  if (qError) return { error: qError.message };

  // 3. Update, insert or remove each option slot.
  let correctOptionId = correctSlot.id || null;

  for (const [i, slot] of slots.entries()) {
    if (slot.text && slot.id) {
      const { error } = await admin
        .from("question_options")
        .update({ option_text: slot.text })
        .eq("id", slot.id)
        .eq("question_id", questionId);
      if (error) return { error: error.message };
    } else if (slot.text && !slot.id) {
      const { data, error } = await admin
        .from("question_options")
        .insert({
          question_id: questionId,
          option_text: slot.text,
          is_correct: false,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      if (i === correctIndex) correctOptionId = data.id;
    } else if (!slot.text && slot.id) {
      // Removing an option nulls it out on any answer that chose it.
      const { error } = await admin
        .from("question_options")
        .delete()
        .eq("id", slot.id)
        .eq("question_id", questionId);
      if (error) return { error: error.message };
    }
  }

  // 4. Set the new correct answer, now that nothing else claims it.
  if (!correctOptionId) return { error: "Could not save the correct answer." };
  const { error: cError } = await admin
    .from("question_options")
    .update({ is_correct: true })
    .eq("id", correctOptionId)
    .eq("question_id", questionId);
  if (cError) return { error: cError.message };

  revalidatePath(`/teacher/${testId}`);
  return {};
}
