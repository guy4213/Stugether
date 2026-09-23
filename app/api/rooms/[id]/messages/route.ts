import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserMessage } from "@/lib/repositories/messages";
import { buildRoomAiContext, parseEnvInt } from "@/lib/ai/context";
import { streamGeminiCompletion } from "@/lib/ai/gemini";

// TECHNICAL_SPEC §6.2 — the ONE route the client calls to post a message. The
// @AI trigger is detected server-side; the client never calls a separate AI
// endpoint. maxDuration covers both the synchronous part (insert + start_ai_run)
// and the after() Gemini call, which shares the same function invocation.
export const maxDuration = 60;

// .env.example defaults — keep these three in sync with the comments there.
const DEFAULT_USER_RATE_LIMIT_PER_HOUR = 30; // AI_RATE_LIMIT_USER_PER_HOUR
const DEFAULT_ROOM_RATE_LIMIT_PER_HOUR = 60; // AI_RATE_LIMIT_ROOM_PER_HOUR
const DEFAULT_MAX_OUTPUT_TOKENS = 1024; // AI_MAX_OUTPUT_TOKENS — short chat replies (TECHNICAL_SPEC §6.8: "ענה קצר")

// Case-insensitive whole-token "@ai" mention: start-of-string or whitespace
// before, whitespace/punctuation/end-of-string after. AI_TRIGGER_MODE is read
// for future extensibility (TECHNICAL_SPEC §6.1) but only 'mention' has a real
// implementation for MVP — unset or unrecognized values are treated as 'mention'.
const AI_MENTION_RE = /(^|\s)@ai(\s|[.,!?]|$)/i;

function isMentionTriggerEnabled(): boolean {
  const mode = process.env.AI_TRIGGER_MODE?.trim().toLowerCase();
  return !mode || mode === "mention";
}

const bodySchema = z.object({
  content: z.string().trim().min(1).max(4000),
  clientMessageId: z.string().uuid().optional(),
  askAi: z.boolean().optional(),
});

// Return shape of the start_ai_run RPC (supabase/migrations/20260913000004_rpcs.sql).
type StartAiRunResult = {
  run_id: string | null;
  placeholder_message_id: string | null;
  ai_status: "disabled" | "rate_limited" | "busy" | "started";
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: roomId } = await params;

  // --- a. validate body ------------------------------------------------------
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  const { content, askAi } = parsed.data;

  // --- b. authenticate ---------------------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "יש להתחבר כדי לשלוח הודעה" }, { status: 401 });
  }

  // --- c. insert the user's message (user-scoped client — RLS gates this) ------
  let message;
  try {
    message = await createUserMessage(supabase, { roomId, senderId: user.id, content });
  } catch (err) {
    Sentry.captureException(err, { extra: { room_id: roomId, user_id: user.id } });
    const code = (err as { code?: string } | null | undefined)?.code;
    if (code === "42501") {
      return NextResponse.json({ error: "אין הרשאה לשלוח הודעה בחדר הזה" }, { status: 403 });
    }
    // Any other rejection (room not found, "no rows" style failure, etc.) —
    // do not leak the raw Postgres error text to the client.
    return NextResponse.json({ error: "החדר לא נמצא" }, { status: 404 });
  }

  // --- d. trigger detection ------------------------------------------------
  const triggered = askAi === true || (isMentionTriggerEnabled() && AI_MENTION_RE.test(content));
  if (!triggered) {
    return NextResponse.json({ message, aiStatus: null }, { status: 201 });
  }

  // --- e. start_ai_run via the admin client (service_role only) ---------------
  const userLimit = parseEnvInt("AI_RATE_LIMIT_USER_PER_HOUR", DEFAULT_USER_RATE_LIMIT_PER_HOUR);
  const roomLimit = parseEnvInt("AI_RATE_LIMIT_ROOM_PER_HOUR", DEFAULT_ROOM_RATE_LIMIT_PER_HOUR);

  let aiStatus: StartAiRunResult["ai_status"] | null = null;
  let runId: string | null = null;
  let placeholderMessageId: string | null = null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("start_ai_run", {
      p_room_id: roomId,
      p_trigger_message_id: message.id,
      p_requested_by: user.id, // always the authenticated user, never the body
      p_user_limit_per_hour: userLimit,
      p_room_limit_per_hour: roomLimit,
    });
    if (error) throw error;

    const result = data as StartAiRunResult;
    aiStatus = result.ai_status;
    runId = result.run_id;
    placeholderMessageId = result.placeholder_message_id;
  } catch (err) {
    // NOT_ALLOWED / INVALID_ARGUMENT here would be a bug in OUR call (we
    // always pass the just-inserted message's own id and the authenticated
    // user's own id) — not something a legitimate flow should ever trigger.
    // Either way, the user's message already succeeded in step c: report and
    // move on rather than failing the whole request over an AI-side bug.
    Sentry.captureException(err, {
      extra: { room_id: roomId, user_id: user.id, trigger_message_id: message.id },
    });
    aiStatus = null;
  }

  // --- f. respond BEFORE calling Gemini ----------------------------------------
  const response = NextResponse.json({ message, aiStatus }, { status: 201 });

  // --- g. schedule the Gemini call to run after the response is sent -----------
  // `after()` is available in this Next.js version (confirmed against
  // node_modules/next/server.d.ts: `export { after } from 'next/dist/server/after'`,
  // and documented at node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md),
  // so it is used directly — no fire-and-forget IIFE fallback was needed.
  if (aiStatus === "started" && runId && placeholderMessageId) {
    const scheduledRunId = runId;
    const scheduledPlaceholderId = placeholderMessageId;
    after(() => runAiTurn(scheduledRunId, scheduledPlaceholderId, roomId));
  }

  return response;
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
