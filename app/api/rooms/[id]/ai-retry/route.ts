import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDemoScenario } from "@/lib/demo/state";
import { DEMO_READ_ONLY_ERROR } from "@/lib/demo/constants";
import { getAiRunTrigger } from "@/lib/repositories/messages";
import { startAiRunAndSchedule } from "@/lib/ai/run";

// "נסה שוב" on a failed AI answer (SPEC §4.7, TECHNICAL_SPEC §6.7). Starts a new
// run for the SAME trigger message, through the same start_ai_run RPC — so the
// lock, rate limit and "busy" answer are identical to a fresh @AI mention. The
// failed answer stays in the thread as it was.
export const maxDuration = 60;

const bodySchema = z.object({ messageId: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  // Demo mode never writes; the demo room simulates sending on the client.
  if (await getDemoScenario()) {
    return NextResponse.json({ error: DEMO_READ_ONLY_ERROR }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "יש להתחבר מחדש" }, { status: 401 });
  }

  // User-scoped client: RLS returns the run only to an active room member.
  const trigger = await getAiRunTrigger(supabase, parsed.data.messageId).catch(() => null);
  if (!trigger || trigger.roomId !== roomId || !trigger.triggerMessageId) {
    return NextResponse.json({ error: "לא ניתן לנסות שוב את התשובה הזו" }, { status: 404 });
  }
  // start_ai_run only accepts the requester's own trigger message.
  if (trigger.requestedBy !== user.id) {
    return NextResponse.json({ error: "רק מי ששאל את העוזר יכול לנסות שוב" }, { status: 403 });
  }

  const aiStatus = await startAiRunAndSchedule({
    roomId,
    triggerMessageId: trigger.triggerMessageId,
    requestedBy: user.id,
  });
  if (aiStatus === null) {
    return NextResponse.json({ error: "לא ניתן לנסות שוב כרגע" }, { status: 409 });
  }
  return NextResponse.json({ aiStatus }, { status: 200 });
}
