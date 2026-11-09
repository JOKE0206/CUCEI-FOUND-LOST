import { api } from "./api";
import { getSupabase, PHOTOS_BUCKET } from "./supabase";
import type { PhotoView, SignedUpload } from "./types";

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function photoProblem(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return `${file.name}: usa una imagen JPEG, PNG o WebP.`;
  if (file.size > MAX_PHOTO_BYTES) return `${file.name}: pesa más de 5 MB.`;
  return null;
}

// Pide una URL firmada, sube el archivo y lo registra en la publicación.
export async function uploadPhoto(publicationId: string, file: File): Promise<PhotoView> {
  const upload = await api<SignedUpload>(`/publicaciones/${publicationId}/fotos/url-subida`, {
    method: "POST",
    body: { mimeType: file.type },
  });

  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase no está configurado");

  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type });
  if (error) throw error;

  return api<PhotoView>(`/publicaciones/${publicationId}/fotos`, {
    method: "POST",
    body: { storagePath: upload.path },
  });
}
