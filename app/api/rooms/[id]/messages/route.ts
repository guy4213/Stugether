import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { createUserMessage } from "@/lib/repositories/messages";
import { startAiRunAndSchedule, type AiStatus } from "@/lib/ai/run";

// TECHNICAL_SPEC §6.2 — the ONE route the client calls to post a message. The
// @AI trigger is detected server-side; the client never calls a separate AI
// endpoint. maxDuration covers both the synchronous part (insert + start_ai_run)
// and the after() Gemini call, which shares the same function invocation.
export const maxDuration = 60;

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // --- e. start_ai_run + schedule Gemini after the response ---------------------
  const aiStatus: AiStatus | null = await startAiRunAndSchedule({
    roomId,
    triggerMessageId: message.id,
    requestedBy: user.id,
  });

  return NextResponse.json({ message, aiStatus }, { status: 201 });
}
