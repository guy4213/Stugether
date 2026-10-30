import type { SupabaseClient } from "@supabase/supabase-js";

// The room's shared exercises (20261030000001_room_exercises.sql).
// Members read through RLS; adding one is the add_room_exercise RPC.

export type ExerciseFileType = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";

export interface RoomExercise {
  id: string;
  room_id: string;
  created_by: string;
  title: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: ExerciseFileType | null;
  created_at: string;
}

// Oldest first: "תרגיל 1, 2, 3..." in the order they were added.
export async function listRoomExercises(
  client: SupabaseClient,
  roomId: string,
): Promise<RoomExercise[]> {
  const { data, error } = await client
    .from("room_exercises")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as RoomExercise[];
}

export async function getRoomExercise(
  client: SupabaseClient,
  exerciseId: string,
): Promise<RoomExercise | null> {
  const { data, error } = await client
    .from("room_exercises")
    .select("*")
    .eq("id", exerciseId)
    .maybeSingle();
  if (error) throw error;
  return data as RoomExercise | null;
}

export async function addRoomExercise(
  client: SupabaseClient,
  input: {
    roomId: string;
    title: string;
    content: string | null;
    file: { path: string; name: string; type: ExerciseFileType } | null;
  },
): Promise<string> {
  const { data, error } = await client.rpc("add_room_exercise", {
    p_room_id: input.roomId,
    p_title: input.title,
    p_content: input.content,
    p_file_path: input.file?.path ?? null,
    p_file_name: input.file?.name ?? null,
    p_file_type: input.file?.type ?? null,
  });
  if (error) throw error;
  return data as string;
}
