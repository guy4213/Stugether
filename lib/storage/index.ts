import { createClient } from "@/lib/supabase/client";

// The only module allowed to touch Supabase Storage.
const AVATARS_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size > MAX_AVATAR_BYTES) throw new Error("AVATAR_TOO_LARGE");
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) throw new Error("AVATAR_INVALID_TYPE");

  const supabase = createClient();
  const path = `${userId}/avatar-${Date.now()}`;
  const { error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;

  return getAvatarUrl(path);
}

export function getAvatarUrl(path: string): string {
  const supabase = createClient();
  return supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
}
