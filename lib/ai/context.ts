import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoom, listRoomMembers } from "@/lib/repositories/rooms";
import { listRoomMessages, type Message } from "@/lib/repositories/messages";
import type { GeminiTurn } from "./gemini";

// -----------------------------------------------------------------------------
// Builds the Gemini prompt for a room: system prompt (rendered from
// app_settings.ai_system_prompt, TECHNICAL_SPEC §6.8) + the room's recent,
// non-deleted messages, oldest-to-newest, trimmed to a token budget.
//
// No separate systemPrompt.ts: the template lives in one table, is read in
// one place, and is only ever rendered here — splitting it out would just add
// an import for a single small function. Documented per the task's "your
// call, document it" note.
//
// ADMIN CLIENT ONLY: this module runs from after() / a fire-and-forget
// background task, i.e. strictly after the triggering HTTP response has
// already been sent. The original request's cookies (and therefore any
// user-scoped client built from them) are not guaranteed to still be usable
// at that point, so every read here goes through createAdminClient()
// (service_role, bypasses RLS) instead of lib/supabase/server.ts.
// -----------------------------------------------------------------------------

// .env.example defaults — keep these two in sync with the comments there.
const DEFAULT_CONTEXT_MESSAGES = 30; // AI_CONTEXT_MESSAGES
const DEFAULT_MAX_INPUT_TOKENS = 8000; // AI_MAX_INPUT_TOKENS
const CHARS_PER_TOKEN = 4; // simple chars/4 heuristic (TECHNICAL_SPEC §6.5)

// Shared with the route handler (rate limits, output token cap) so env
// parsing/defaulting lives in exactly one place.
export function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// Interpolates the {course_name} / {room_topic} / {participant_names}
// placeholders from the admin-editable template (TECHNICAL_SPEC §6.8).
function renderSystemPrompt(
  template: string,
  vars: { courseName: string; roomTopic: string; participantNames: string },
): string {
  return template
    .split("{course_name}")
    .join(vars.courseName)
    .split("{room_topic}")
    .join(vars.roomTopic)
    .split("{participant_names}")
    .join(vars.participantNames);
}

export interface RoomAiContext {
  // turns[0] is always the rendered system prompt (role 'system').
  turns: GeminiTurn[];
  // Messages actually kept after trimming — useful for ai_runs.context_message_count.
  contextMessageCount: number;
}

export async function buildRoomAiContext(roomId: string): Promise<RoomAiContext> {
  const admin = createAdminClient();

  const [settingsResult, room, allMembers] = await Promise.all([
    admin.from("app_settings").select("ai_system_prompt").eq("id", 1).single(),
    getRoom(admin, roomId),
    listRoomMembers(admin, roomId),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (!room) throw new Error(`AI_CONTEXT_ROOM_NOT_FOUND: ${roomId}`);

  const { data: courseRow, error: courseError } = await admin
    .from("courses")
    .select("name")
    .eq("id", room.course_id)
    .maybeSingle();
  if (courseError) throw courseError;

  // participant_names: active members only. Name lookup for message
  // attribution below uses ALL members (including ones who left) so a past
  // member's older messages still show their name.
  const activeMembers = allMembers.filter((m) => m.left_at === null);
  const participantNames = activeMembers
    .map((m) => m.profile?.full_name)
    .filter((name): name is string => Boolean(name && name.trim().length > 0))
    .join(", ");

  const nameByUserId = new Map(allMembers.map((m) => [m.user_id, m.profile?.full_name ?? "משתתף"]));

  const systemPrompt = renderSystemPrompt(settingsResult.data?.ai_system_prompt ?? "", {
    courseName: courseRow?.name ?? "הקורס",
    roomTopic: room.topic ?? room.name,
    participantNames: participantNames.length > 0 ? participantNames : "אין משתתפים פעילים",
  });

  const contextLimit = parseEnvInt("AI_CONTEXT_MESSAGES", DEFAULT_CONTEXT_MESSAGES);
  const maxInputTokens = parseEnvInt("AI_MAX_INPUT_TOKENS", DEFAULT_MAX_INPUT_TOKENS);

  // listRoomMessages is newest-first. The admin client bypasses RLS (which is
  // what normally hides soft-deleted rows from everyone but the sender), so
  // deleted rows and empty/in-progress ('streaming') placeholders are
  // filtered out explicitly here.
  const recentMessages = await listRoomMessages(admin, roomId, { limit: contextLimit });
  const liveMessages = recentMessages.filter(
    (m) => m.deleted_at === null && m.content.trim().length > 0,
  );

  const speakerLabel = (m: Message): string =>
    m.sender_type === "user"
      ? `${nameByUserId.get(m.sender_id ?? "") ?? "משתתף"}: `
      : m.sender_type === "system"
        ? "[מערכת]: "
        : "";

  // Accumulate from newest to oldest so that when the token budget runs out
  // it is the OLDEST messages that get dropped, per TECHNICAL_SPEC §6.5.
  // Always keep at least the single most recent live message, even if it
  // alone exceeds the budget.
  let budget = Math.max(0, maxInputTokens - estimateTokens(systemPrompt));
  const kept: Message[] = [];
  for (const message of liveMessages) {
    const cost = estimateTokens(speakerLabel(message) + message.content);
    if (kept.length > 0 && cost > budget) break;
    budget -= cost;
    kept.push(message);
  }

  const turns: GeminiTurn[] = [{ role: "system", text: systemPrompt }];
  for (const message of kept.slice().reverse()) {
    turns.push({
      role: message.sender_type === "ai" ? "model" : "user",
      text: speakerLabel(message) + message.content,
    });
  }

  return { turns, contextMessageCount: kept.length };
}
