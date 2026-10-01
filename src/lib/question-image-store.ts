import { createAdminClient } from "@/lib/supabase/admin";
import { IMAGE_TYPES, QUESTION_IMAGE_BUCKET } from "@/lib/question-image";

export async function storeQuestionImage(
  testId: string,
  questionId: string,
  file: File,
): Promise<{ error: string } | { url: string }> {
  const admin = createAdminClient();
  const path = `${testId}/${questionId}-${Date.now()}.${IMAGE_TYPES[file.type]}`;

  const { error } = await admin.storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { error: `The picture could not be saved: ${error.message}` };
  const { data } = admin.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function removeTestImages(testId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(QUESTION_IMAGE_BUCKET).list(testId);
  const paths = (data ?? []).map((f) => `${testId}/${f.name}`);
  if (paths.length) await admin.storage.from(QUESTION_IMAGE_BUCKET).remove(paths);
}
