import { createClient } from "@/lib/supabase/client";
import { DEMO_AVATAR_PREFIX, isDemoId } from "@/lib/demo/constants";

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
  if (isDemoId(userId)) throw new Error("DEMO_MODE");
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

// ---------------------------------------------------------------------------
// Room files (20261030000001_room_exercises.sql): a private bucket, one
// folder per room. Members of an active room upload; members read through
// short-lived signed URLs.
// ---------------------------------------------------------------------------
const ROOM_FILES_BUCKET = "room-files";
export const MAX_ROOM_FILE_BYTES = 10 * 1024 * 1024;
export const ROOM_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;
export type RoomFileType = (typeof ROOM_FILE_TYPES)[number];

const ROOM_FILE_EXT: Record<RoomFileType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function isRoomFileType(type: string): type is RoomFileType {
  return (ROOM_FILE_TYPES as readonly string[]).includes(type);
}

// Returns the object path "<roomId>/<uuid>.<ext>" for add_room_exercise.
export async function uploadRoomFile(roomId: string, file: File): Promise<string> {
  if (isDemoId(roomId)) throw new Error("DEMO_MODE");
  if (file.size > MAX_ROOM_FILE_BYTES) throw new Error("ROOM_FILE_TOO_LARGE");
  if (!isRoomFileType(file.type)) throw new Error("ROOM_FILE_INVALID_TYPE");

  const supabase = createClient();
  const path = `${roomId}/${crypto.randomUUID()}.${ROOM_FILE_EXT[file.type]}`;
  const { error } = await supabase.storage
    .from(ROOM_FILES_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export async function getRoomFileUrl(path: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(ROOM_FILES_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export function getAvatarUrl(path: string): string {
  // Demo mode avatars ship with the app (public/demo/avatars).
  if (path.startsWith(DEMO_AVATAR_PREFIX)) return `/${path}`;
  const supabase = createClient();
  return supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
}
