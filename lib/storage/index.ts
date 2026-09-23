import { createClient } from "@/lib/supabase/client";

// The only module allowed to touch Supabase Storage.
const AVATARS_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

// file.type -> extension. Only ever called after ALLOWED_AVATAR_TYPES has
// already been checked, so the default branch is unreachable in practice.
function extensionForType(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    default:
      return "jpg";
  }
}

// Returns the Storage OBJECT PATH ("<uid>/avatar-<timestamp>.<ext>"), never a
// URL: profiles.avatar_url must store the path only (see the CHECK constraint
// profiles_avatar_url_own_object_path in
// supabase/migrations/20260913000001_catalog_and_users.sql), so a caller can
// pass this straight into updateOwnProfile({ avatarPath }). Use
// getAvatarUrl(path) separately at render time.
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size > MAX_AVATAR_BYTES) throw new Error("AVATAR_TOO_LARGE");
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) throw new Error("AVATAR_INVALID_TYPE");

  const supabase = createClient();
  const path = `${userId}/avatar-${Date.now()}.${extensionForType(file.type)}`;
  const { error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;

  return path;
}

export function getAvatarUrl(path: string): string {
  const supabase = createClient();
  return supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
}
