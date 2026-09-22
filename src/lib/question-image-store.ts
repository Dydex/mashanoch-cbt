import { createAdminClient } from "@/lib/supabase/admin";
import { IMAGE_TYPES, QUESTION_IMAGE_BUCKET } from "@/lib/question-image";

/**
 * Putting a question's picture in storage. Server-only: it uses the service
 * role, after the caller has been checked as the test's author, so no client
 * ever needs write access to the bucket.
 */

/** Stores one question's picture and returns the address to show it from. */
export async function storeQuestionImage(
  testId: string,
  questionId: string,
  file: File,
): Promise<{ error: string } | { url: string }> {
  const admin = createAdminClient();
  // Named for the question, with a timestamp, so a replacement never serves
  // the old picture from a cache.
  const path = `${testId}/${questionId}-${Date.now()}.${IMAGE_TYPES[file.type]}`;

  const { error } = await admin.storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { error: `The picture could not be saved: ${error.message}` };

  const { data } = admin.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Clears out a deleted test's pictures, so the bucket does not fill up. */
export async function removeTestImages(testId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(QUESTION_IMAGE_BUCKET).list(testId);
  const paths = (data ?? []).map((f) => `${testId}/${f.name}`);
  if (paths.length) await admin.storage.from(QUESTION_IMAGE_BUCKET).remove(paths);
}
