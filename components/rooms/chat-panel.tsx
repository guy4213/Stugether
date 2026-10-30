"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDownIcon, SendIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DELETE_WINDOW_MS, MessageBubble } from "@/components/rooms/message-bubble";
import { deleteMessage, loadOlderMessages, markRoomReadAction } from "@/lib/rooms/actions";
import type { Message } from "@/lib/repositories/messages";
import type { RoomMember } from "@/lib/repositories/rooms";
import { DEMO_AI_REPLY, DEMO_READ_ONLY_ERROR } from "@/lib/demo/constants";

const TZ = "Asia/Jerusalem";
const MARK_READ_THROTTLE_MS = 3000;

// Hebrew copy for start_ai_run's non-"started" outcomes (SPEC §4.7).
const AI_STATUS_MESSAGE: Record<string, string> = {
  busy: "העוזר עונה כרגע, נסו שוב בעוד רגע",
  rate_limited: "הגעתם למגבלת השימוש בעוזר לשעה הקרובה. נסו שוב מאוחר יותר",
  disabled: "העוזר כבוי בחדר הזה",
};

// Same trigger as the messages route, for the demo room's simulated tutor.
export const AI_MENTION_RE = /(^|\s)@ai(\s|[.,!?]|$)/i;

export type ChatMode = "group" | "ai";

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

function dayLabel(iso: string): string {
  const key = dayKey(iso);
  if (key === dayKey(new Date().toISOString())) return "היום";
  if (key === dayKey(new Date(Date.now() - 86_400_000).toISOString())) return "אתמול";
  return new Date(iso).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  });
}

export function localMessage(roomId: string, fields: Partial<Message>): Message {
  return {
    id: crypto.randomUUID(),
    room_id: roomId,
    sender_id: null,
    sender_type: "user",
    content: "",
    status: "complete",
    ai_run_id: null,
    metadata: {},
    created_at: new Date().toISOString(),
    deleted_at: null,
    ...fields,
  };
}

export function upsertMessage(list: Message[], row: Message): Message[] {
  const i = list.findIndex((m) => m.id === row.id);
  if (i === -1) return [...list, row];
  const next = [...list];
  next[i] = row;
  return next;
}

// "מצב AI" shows the tutor's answers and the questions that asked for them:
// an @AI mention, or the message right before an AI reply ("שאל את העוזר").
function aiThread(messages: Message[]): Message[] {
  return messages.filter(
    (m, i) =>
      m.sender_type === "ai" ||
      (m.sender_type === "user" &&
        (AI_MENTION_RE.test(m.content) || messages[i + 1]?.sender_type === "ai")),
  );
}

// Quick prompts for the tutor (Figma "פעולות מהירות"). They still go through
// the regular route, so the AI rules (guide, don't solve) apply.
function quickActions(exerciseTitle: string | null) {
  const ex = exerciseTitle ? ` "${exerciseTitle}"` : "";
  return [
    { label: "סכם", text: "סכם בקצרה את מה שדיברנו עליו עד עכשיו" },
    { label: "שאלה", text: `שאל אותנו שאלה שתבדוק אם הבנו את התרגיל${ex}` },
    { label: "רמז", text: `תן לנו רמז קטן לכיוון הפתרון של התרגיל${ex}` },
    { label: "פתרון והסבר", text: `הסבר לנו צעד אחר צעד איך ניגשים לתרגיל${ex}` },
  ];
}

// The room's chat column: "צ'אט קבוצתי" (the whole thread, AI included —
// SPEC §4.6) and "מצב AI" (the tutor's part of it, quick prompts, and every
// message goes to the tutor).
export function ChatPanel({
  roomId,
  currentUserId,
  messages,
  setMessages,
  initialHasMore,
  membersById,
  online,
  isMember,
  canPost,
  aiAvailable,
  readOnlyReason,
  demo,
  mode,
  onModeChange,
  exerciseTitle,
  draft,
  className,
}: {
  roomId: string;
  currentUserId: string;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  initialHasMore: boolean;
  membersById: Map<string, RoomMember>;
  online: Set<string>;
  isMember: boolean;
  canPost: boolean;
  aiAvailable: boolean;
  readOnlyReason: string;
  demo: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  exerciseTitle: string | null;
  /** Text handed over from elsewhere in the room ("שאל את העוזר על התרגיל"). */
  draft: { id: number; text: string } | null;
  className?: string;
}) {
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingOlder, startLoadingOlder] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [showActions, setShowActions] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const lastMarkRead = useRef(0);

  const aiMode = mode === "ai" && aiAvailable;
  const shown = aiMode ? aiThread(messages) : messages;

  // A new draft replaces what is in the box (state adjusted during render).
  const [seenDraft, setSeenDraft] = useState(draft);
  if (draft !== seenDraft) {
    setSeenDraft(draft);
    if (draft) setContent(draft.text);
  }
  useEffect(() => {
    if (draft) inputRef.current?.focus();
  }, [draft]);

  // Re-evaluate the 5-minute delete window without a user action.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const markRead = useCallback(() => {
    if (demo || !isMember || document.visibilityState !== "visible") return;
    const t = Date.now();
    if (t - lastMarkRead.current < MARK_READ_THROTTLE_MS) return;
    lastMarkRead.current = t;
    void markRoomReadAction(roomId);
  }, [demo, isMember, roomId]);

  // Room-level "read" (SPEC §4.6): on open, on every new message while the
  // room is on screen, and when the tab comes back into view.
  const lastMessageId = messages.at(-1)?.id;
  useEffect(() => {
    markRead();
  }, [lastMessageId, markRead]);
  useEffect(() => {
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [markRead]);

  // Follow new messages only when the reader is already at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [shown.length, messages]);
  useEffect(() => {
    stickToBottom.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mode]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function loadOlder() {
    const oldest = messages[0];
    const el = scrollRef.current;
    if (!oldest || !el) return;
    const prevHeight = el.scrollHeight;
    startLoadingOlder(async () => {
      const older = await loadOlderMessages(roomId, {
        createdAt: oldest.created_at,
        id: oldest.id,
      });
      setHasMore(older.length === 50);
      if (older.length === 0) return;
      stickToBottom.current = false;
      setMessages((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]);
      // Keep the reader's position after prepending.
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight;
      });
    });
  }

  async function send(askAi: boolean, text = content) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    if (demo) {
      sendDemo(trimmed, askAi || AI_MENTION_RE.test(trimmed));
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, askAi }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? "שליחת ההודעה נכשלה");
        return;
      }
      if (text === content) setContent("");
      stickToBottom.current = true;
      if (body?.message) setMessages((prev) => upsertMessage(prev, body.message as Message));
      const aiMessage = body?.aiStatus ? AI_STATUS_MESSAGE[body.aiStatus] : undefined;
      if (aiMessage) toast.info(aiMessage);
    } catch {
      toast.error("שליחת ההודעה נכשלה");
    } finally {
      setIsSending(false);
    }
  }

  function sendDemo(text: string, askAi: boolean) {
    setContent("");
    stickToBottom.current = true;
    setMessages((prev) => [
      ...prev,
      localMessage(roomId, { sender_id: currentUserId, content: text }),
    ]);
    if (!askAi) return;
    const reply = localMessage(roomId, { sender_type: "ai", status: "streaming" });
    setTimeout(() => setMessages((prev) => [...prev, reply]), 600);
    setTimeout(
      () =>
        setMessages((prev) =>
          upsertMessage(prev, { ...reply, status: "complete", content: DEMO_AI_REPLY }),
        ),
      2200,
    );
  }

  async function handleDelete(message: Message) {
    if (demo) {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, deleted_at: new Date().toISOString() } : m)),
      );
      return;
    }
    setBusyId(message.id);
    const result = await deleteMessage(message.id);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error ?? "המחיקה נכשלה");
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, deleted_at: new Date().toISOString() } : m)),
    );
  }

  async function handleRetry(message: Message) {
    if (demo) {
      toast.info(DEMO_READ_ONLY_ERROR);
      return;
    }
    setBusyId(message.id);
    try {
      const res = await fetch(`/api/rooms/${roomId}/ai-retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? "לא ניתן לנסות שוב כרגע");
        return;
      }
      stickToBottom.current = true;
      const aiMessage = body?.aiStatus ? AI_STATUS_MESSAGE[body.aiStatus] : undefined;
      if (aiMessage) toast.info(aiMessage);
    } catch {
      toast.error("לא ניתן לנסות שוב כרגע");
    } finally {
      setBusyId(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(aiMode);
    }
  }

  return (
    <section
      aria-label="צ'אט החדר"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[22px] bg-card shadow-card",
        className,
      )}
    >
      {aiAvailable && (
        <div className="px-6 pt-6 pb-4">
          <div
            role="tablist"
            aria-label="מצב הצ'אט"
            className="mx-auto grid w-full max-w-[238px] grid-cols-2 rounded-[8px] bg-surface-2 p-0.5"
          >
            {(
              [
                { id: "group", label: "צ'אט קבוצתי" },
                { id: "ai", label: "מצב AI" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                onClick={() => onModeChange(tab.id)}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-[7px] text-sm transition-colors",
                  mode === tab.id
                    ? "bg-primary font-bold text-white shadow-soft"
                    : "font-medium text-foreground hover:bg-white",
                )}
              >
                {tab.label}
                {tab.id === "ai" && <SparklesIcon className="size-3.5" aria-hidden />}
              </button>
            ))}
          </div>
          <div className="mt-4 h-px bg-divider" />
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 sm:px-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        {!isMember && (
          <p className="rounded-xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
            צפייה במטא-נתונים בלבד — תוכן ההודעות גלוי רק למשתתפי החדר.
          </p>
        )}
        {hasMore && (
          <div className="flex justify-center pb-2">
            <Button variant="quiet" size="chip" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? "טוען..." : "טעינת הודעות קודמות"}
            </Button>
          </div>
        )}
        {isMember && shown.length === 0 && (
          <p className="pt-8 text-center text-sm text-muted-foreground">
            {aiMode
              ? "שאלו את העוזר על התרגיל, או בחרו פעולה מהירה למטה."
              : "אין עדיין הודעות בחדר הזה. כתבו הודעה כדי להתחיל, או תייגו @AI לשאלה לעוזר."}
          </p>
        )}
        {shown.map((message, i) => {
          const prev = shown[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(message.created_at);
          const sameSenderAsPrev =
            !newDay &&
            prev &&
            prev.sender_id === message.sender_id &&
            prev.sender_type === message.sender_type;
          const isOwn = message.sender_type === "user" && message.sender_id === currentUserId;
          return (
            <Fragment key={message.id}>
              {newDay && (
                <div className="flex justify-center py-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {dayLabel(message.created_at)}
                  </span>
                </div>
              )}
              <MessageBubble
                message={message}
                isOwn={isOwn}
                sender={message.sender_id ? membersById.get(message.sender_id) : undefined}
                showSender={!sameSenderAsPrev}
                online={!!message.sender_id && online.has(message.sender_id)}
                canDelete={
                  isOwn &&
                  canPost &&
                  now - new Date(message.created_at).getTime() < DELETE_WINDOW_MS
                }
                onDelete={() => void handleDelete(message)}
                canRetry={canPost && aiAvailable}
                onRetry={() => void handleRetry(message)}
                busy={busyId === message.id}
              />
            </Fragment>
          );
        })}
      </div>

      <div className="px-4 pt-2 pb-4 sm:px-6 sm:pb-5">
        {canPost ? (
          <>
            {aiAvailable && (
              <div className="mb-3">
                <button
                  type="button"
                  aria-expanded={showActions && aiMode}
                  onClick={() => (aiMode ? setShowActions((v) => !v) : onModeChange("ai"))}
                  className="ms-auto flex items-center gap-1 text-[11px] font-medium text-foreground"
                >
                  פעולות מהירות
                  <ChevronDownIcon
                    className={cn(
                      "size-3.5 transition-transform",
                      showActions && aiMode && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {showActions && aiMode && (
                  <div className="mt-2 flex flex-wrap justify-start gap-2">
                    {quickActions(exerciseTitle).map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        disabled={isSending}
                        onClick={() => void send(true, a.text)}
                        className="h-[26px] rounded-full bg-surface-2 px-4 text-[11px] font-medium text-foreground shadow-soft transition-colors hover:bg-primary-soft disabled:opacity-50"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-full bg-surface-2 py-1 ps-4 pe-1 focus-within:ring-2 focus-within:ring-primary-line">
              <Textarea
                ref={inputRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  aiMode
                    ? "שאלו את העוזר..."
                    : aiAvailable
                      ? "כתבו הודעה... (@AI לשאלה לעוזר)"
                      : "כתבו הודעה..."
                }
                aria-label="כתיבת הודעה"
                rows={1}
                maxLength={4000}
                className="max-h-28 min-h-8 resize-none border-0 bg-transparent px-0 py-1.5 shadow-none focus-visible:ring-0"
                disabled={isSending}
              />
              <Button
                size="icon"
                className="size-[30px] shrink-0 rounded-full bg-primary text-white hover:bg-primary-strong"
                onClick={() => void send(aiMode)}
                disabled={isSending || !content.trim()}
                aria-label={aiMode ? "שליחה לעוזר" : "שליחת הודעה"}
              >
                <SendIcon className="size-3.5 rtl:-scale-x-100" />
              </Button>
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{readOnlyReason}</p>
        )}
      </div>
    </section>
  );
}
