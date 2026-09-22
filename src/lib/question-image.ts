/**
 * Pictures for questions (a diagram, a map, a passage photo).
 *
 * They live in a public Supabase Storage bucket: students have to load them
 * while sitting the test, and a question's picture is no more secret than the
 * question itself. The answer key is never in the image.
 *
 * Nothing here touches the database, so the question forms can import the
 * limits. Uploading lives in question-image-store.ts, which is server-only.
 */
export const QUESTION_IMAGE_BUCKET = "question-images";

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** What we accept, and the file extension each is stored under. */
export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const IMAGE_ACCEPT = Object.keys(IMAGE_TYPES).join(",");

/** The picture a form is carrying, if any, once it is known to be usable. */
export function readQuestionImage(
  formData: FormData,
): { error: string } | { file: File | null } {
  const value = formData.get("image");
  if (!(value instanceof File) || value.size === 0) return { file: null };

  if (!IMAGE_TYPES[value.type])
    return { error: "Pictures must be PNG, JPEG, WebP or GIF." };
  if (value.size > IMAGE_MAX_BYTES)
    return { error: "That picture is over 2 MB. Use a smaller one." };
  return { file: value };
}
