"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRightIcon, SendIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/ui/pill";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { LiveDot } from "@/components/ui/live-dot";
import { DELETE_WINDOW_MS, MessageBubble } from "@/components/rooms/message-bubble";
import { RoomMembersDialog } from "@/components/rooms/room-members-dialog";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { deleteMessage, loadOlderMessages, markRoomReadAction } from "@/lib/rooms/actions";
import type { Message } from "@/lib/repositories/messages";
import type { RoomPageData } from "@/lib/rooms/queries";

const TZ = "Asia/Jerusalem";
const MARK_READ_THROTTLE_MS = 3000;

// Hebrew copy for start_ai_run's non-"started" outcomes (SPEC §4.7).
const AI_STATUS_MESSAGE: Record<string, string> = {
  busy: "העוזר עונה כרגע, נסו שוב בעוד רגע",
  rate_limited: "הגעתם למגבלת השימוש בעוזר לשעה הקרובה. נסו שוב מאוחר יותר",
  disabled: "העוזר כבוי בחדר הזה",
};

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

function upsert(list: Message[], row: Message): Message[] {
  const i = list.findIndex((m) => m.id === row.id);
  if (i === -1) return [...list, row];
  const next = [...list];
  next[i] = row;
  return next;
}

// The whole room screen below the app nav: header (members, presence, AI
// state), the thread and the composer. Deliberately no side conversation
// list — rooms are course-scoped, not a general inbox.
export function ChatWindow({ data, currentUserId }: { data: RoomPageData; currentUserId: string }) {
  const { room, course, isMember, aiAvailable } = data;
  const isActive = room.status === "active";
  const canPost = isMember && isActive;

  const [messages, setMessages] = useState<Message[]>(data.messages);
  const [hasMore, setHasMore] = useState(data.hasMoreMessages);
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingOlder, startLoadingOlder] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastMarkRead = useRef(0);

  const membersById = useMemo(
    () => new Map(data.members.map((m) => [m.user_id, m])),
    [data.members],
  );
  const activeMembers = data.members.filter((m) => !m.left_at);

  const { onlineUserIds } = useRoomChannel(room.id, isMember ? currentUserId : null, {
    onMessageInsert: (row) => setMessages((prev) => upsert(prev, row as unknown as Message)),
    onMessageUpdate: (row) => setMessages((prev) => upsert(prev, row as unknown as Message)),
    onMessageDeleted: (id) =>
      setMessages((prev) =>
        prev.flatMap((m) => {
          if (m.id !== id) return [m];
          // My own deleted message stays as a "deleted" stub; others' vanish
          // (RLS hides deleted rows from everyone but the sender).
          return m.sender_id === currentUserId
            ? [{ ...m, deleted_at: m.deleted_at ?? new Date().toISOString() }]
            : [];
        }),
      ),
  });
  const online = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);

  // Re-evaluate the 5-minute delete window without a user action.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const markRead = useCallback(() => {
    if (!isMember || document.visibilityState !== "visible") return;
    const t = Date.now();
    if (t - lastMarkRead.current < MARK_READ_THROTTLE_MS) return;
    lastMarkRead.current = t;
    void markRoomReadAction(room.id);
  }, [isMember, room.id]);

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
  }, [messages]);

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
      const older = await loadOlderMessages(room.id, {
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

  async function send(askAi: boolean) {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, askAi }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? "שליחת ההודעה נכשלה");
        return;
      }
      setContent("");
      stickToBottom.current = true;
      if (body?.message) setMessages((prev) => upsert(prev, body.message as Message));
      const aiMessage = body?.aiStatus ? AI_STATUS_MESSAGE[body.aiStatus] : undefined;
      if (aiMessage) toast.info(aiMessage);
    } catch {
      toast.error("שליחת ההודעה נכשלה");
    } finally {
      setIsSending(false);
    }
  }

  async function handleDelete(message: Message) {
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
    setBusyId(message.id);
    try {
      const res = await fetch(`/api/rooms/${room.id}/ai-retry`, {
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
      void send(false);
    }
  }

  const onlineOthers = activeMembers.filter(
    (m) => m.user_id !== currentUserId && online.has(m.user_id),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card shadow-card sm:rounded-[22px] sm:border sm:border-border">
      <div className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-5">
        <Link
          href={course ? `/courses/${course.id}` : "/dashboard"}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="חזרה לקורס"
        >
          <ArrowRightIcon className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base font-bold sm:text-lg">{room.name}</h1>
            {room.status === "archived" && <Pill tone="warning">מאורכב</Pill>}
            {room.status === "closed" && <Pill tone="neutral">סגור</Pill>}
          </div>
          <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
            {onlineOthers.length > 0 ? (
              <>
                <LiveDot className="size-2" />
                <span className="truncate">
                  {onlineOthers.length === 1
                    ? `${onlineOthers[0].profile?.full_name ?? "משתתף/ת"} מחובר/ת עכשיו`
                    : `${onlineOthers.length} מחוברים עכשיו`}
                </span>
              </>
            ) : (
              <span className="truncate">
                {course?.name ?? ""}
                {room.topic ? ` · ${room.topic}` : ""}
              </span>
            )}
          </p>
        </div>
        {aiAvailable && isActive && (
          <Pill tone="teal" className="max-sm:hidden">
            <SparklesIcon className="size-3.5" aria-hidden />
            עוזר AI פעיל
          </Pill>
        )}
        <AvatarStack
          people={activeMembers.map((m) => ({
            id: m.user_id,
            name: m.profile?.full_name ?? "?",
          }))}
          max={4}
          size="md"
          showInitials
          className="max-sm:hidden"
        />
        <RoomMembersDialog
          data={data}
          currentUserId={currentUserId}
          onlineUserIds={onlineUserIds}
        />
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-5 sm:px-6"
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
        {isMember && messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-muted-foreground">
            אין עדיין הודעות בחדר הזה. כתבו הודעה כדי להתחיל, או תייגו @AI לשאלה לעוזר.
          </p>
        )}
        {messages.map((message, i) => {
          const prev = messages[i - 1];
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
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
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

      <div className="border-t border-border p-3 sm:p-4">
        {canPost ? (
          <div className="flex items-end gap-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={aiAvailable ? "כתבו הודעה... (@AI לשאלה לעוזר)" : "כתבו הודעה..."}
              aria-label="כתיבת הודעה"
              rows={1}
              maxLength={4000}
              className="max-h-32 min-h-11 resize-none rounded-[22px] bg-muted/60 px-5 py-3"
              disabled={isSending}
            />
            {aiAvailable && (
              <Button
                variant="soft"
                size="md"
                className="shrink-0 max-sm:size-11 max-sm:px-0"
                onClick={() => void send(true)}
                disabled={isSending || !content.trim()}
                title="שליחה ושאלת העוזר"
              >
                <SparklesIcon className="size-4" aria-hidden />
                <span className="max-sm:sr-only">שאל את העוזר</span>
              </Button>
            )}
            <Button
              size="icon"
              variant="gradient"
              className="size-11 shrink-0"
              onClick={() => void send(false)}
              disabled={isSending || !content.trim()}
              aria-label="שליחת הודעה"
            >
              <SendIcon className="size-4 rtl:-scale-x-100" />
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            {!isMember
              ? "רק משתתפי החדר יכולים לכתוב בו."
              : room.status === "closed"
                ? "החדר סגור — ניתן לקרוא בלבד."
                : "החדר מאורכב — ניתן לקרוא בלבד."}
          </p>
        )}
      </div>
    </div>
  );
}
