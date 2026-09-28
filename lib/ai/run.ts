import "server-only";
import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildRoomAiContext, parseEnvInt } from "@/lib/ai/context";
import { streamGeminiCompletion } from "@/lib/ai/gemini";

// Shared by POST /api/rooms/[id]/messages (a fresh @AI mention) and
// POST /api/rooms/[id]/ai-retry ("נסה שוב" on a failed answer): both go
// through the same start_ai_run RPC — one transaction for stale-check, rate
// limit, the one-active-run lock and the placeholder (TECHNICAL_SPEC §6.3).

// .env.example defaults — keep these three in sync with the comments there.
const DEFAULT_USER_RATE_LIMIT_PER_HOUR = 30; // AI_RATE_LIMIT_USER_PER_HOUR
const DEFAULT_ROOM_RATE_LIMIT_PER_HOUR = 60; // AI_RATE_LIMIT_ROOM_PER_HOUR
const DEFAULT_MAX_OUTPUT_TOKENS = 1024; // AI_MAX_OUTPUT_TOKENS — short chat replies (TECHNICAL_SPEC §6.8: "ענה קצר")

export type AiStatus = "disabled" | "rate_limited" | "busy" | "started";

// Return shape of the start_ai_run RPC (supabase/migrations/20260913000004_rpcs.sql).
type StartAiRunResult = {
  run_id: string | null;
  placeholder_message_id: string | null;
  ai_status: AiStatus;
};

// Calls start_ai_run via the admin client (service_role only) and, when a run
// was started, schedules the Gemini call with after() so it runs once the
// HTTP response has been sent. Returns null when the RPC itself failed.
export async function startAiRunAndSchedule(input: {
  roomId: string;
  triggerMessageId: string;
  requestedBy: string;
}): Promise<AiStatus | null> {
  const userLimit = parseEnvInt("AI_RATE_LIMIT_USER_PER_HOUR", DEFAULT_USER_RATE_LIMIT_PER_HOUR);
  const roomLimit = parseEnvInt("AI_RATE_LIMIT_ROOM_PER_HOUR", DEFAULT_ROOM_RATE_LIMIT_PER_HOUR);

  let result: StartAiRunResult;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("start_ai_run", {
      p_room_id: input.roomId,
      p_trigger_message_id: input.triggerMessageId,
      p_requested_by: input.requestedBy, // always the authenticated user, never the body
      p_user_limit_per_hour: userLimit,
      p_room_limit_per_hour: roomLimit,
    });
    if (error) throw error;
    result = data as StartAiRunResult;
  } catch (err) {
    // NOT_ALLOWED / INVALID_ARGUMENT here would be a bug in OUR call (the
    // caller always passes an authenticated user and their own message) —
    // report and move on rather than failing the whole request.
    Sentry.captureException(err, {
      extra: {
        room_id: input.roomId,
        user_id: input.requestedBy,
        trigger_message_id: input.triggerMessageId,
      },
    });
    return null;
  }

  // `after()` is available in this Next.js version (confirmed against
  // node_modules/next/server.d.ts and
  // node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md).
  const { run_id: runId, placeholder_message_id: placeholderId } = result;
  if (result.ai_status === "started" && runId && placeholderId) {
    after(() => runAiTurn(runId, placeholderId, input.roomId));
  }
  return result.ai_status;
}

// -----------------------------------------------------------------------------
// Runs entirely after the HTTP response has been sent. Every step is wrapped
// so that no failure here — a thrown exception, a Gemini error response, a
// network failure — can escape as an unhandled rejection; the worst case is a
// message left in its already-inserted state.
// -----------------------------------------------------------------------------
async function runAiTurn(
  runId: string,
  placeholderMessageId: string,
  roomId: string,
): Promise<void> {
  const admin = createAdminClient();
  let accumulatedText = "";

  try {
    await admin
      .from("ai_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", runId);

    const { turns, contextMessageCount } = await buildRoomAiContext(roomId);
    const maxOutputTokens = parseEnvInt("AI_MAX_OUTPUT_TOKENS", DEFAULT_MAX_OUTPUT_TOKENS);

    const result = await streamGeminiCompletion(turns, {
      // Intentional no-op hook today (TECHNICAL_SPEC §6.6) — nothing
      // subscribes to per-chunk text yet. Tracked independently of the
      // function's own return value so a partial answer survives even if
      // the call throws mid-stream.
      onChunk: (chunk) => {
        accumulatedText += chunk;
      },
      maxOutputTokens,
    });

    const finalText = result.text.length > 0 ? result.text : accumulatedText;

    const { error: messageError } = await admin
      .from("messages")
      .update({ content: finalText, status: "complete" })
      .eq("id", placeholderMessageId);
    if (messageError) throw messageError;

    const { error: runError } = await admin
      .from("ai_runs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        prompt_tokens: result.promptTokens ?? null,
        completion_tokens: result.completionTokens ?? null,
        context_message_count: contextMessageCount,
        model: process.env.GEMINI_MODEL?.trim() || null,
      })
      .eq("id", runId);
    if (runError) throw runError;
  } catch (err) {
    Sentry.captureException(err, { extra: { room_id: roomId, run_id: runId } });

    const failureContent =
      accumulatedText.trim().length > 0
        ? `${accumulatedText} (נקטע)`
        : "מצטערים, לא הצלחנו לקבל תשובה מהעוזר כרגע.";

    try {
      const { error } = await admin
        .from("messages")
        .update({ content: failureContent, status: "failed" })
        .eq("id", placeholderMessageId);
      if (error) throw error;
    } catch (updateErr) {
      Sentry.captureException(updateErr, { extra: { room_id: roomId, run_id: runId } });
    }

    try {
      const { error } = await admin
        .from("ai_runs")
        .update({
          status: "failed",
          error_code: errorCodeOf(err),
          error_message: errorMessageOf(err),
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
      if (error) throw error;
    } catch (updateErr) {
      Sentry.captureException(updateErr, { extra: { room_id: roomId, run_id: runId } });
    }
  }
}

// Short machine code for ai_runs.error_code — never a raw stack trace.
function errorCodeOf(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) return code.slice(0, 40);
  }
  return "ai_turn_failed";
}

// Human-readable, storage-safe message — never a raw stack trace.
function errorMessageOf(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 500);
  if (typeof err === "string") return err.slice(0, 500);
  return "Unknown AI turn failure";
}
