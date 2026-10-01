export const QUESTION_IMAGE_BUCKET = "question-images";

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const IMAGE_ACCEPT = Object.keys(IMAGE_TYPES).join(",");

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
