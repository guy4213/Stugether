"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { DELETE_WINDOW_MS, MessageBubble } from "@/components/rooms/message-bubble";
import { dayKey, dayLabel } from "@/components/rooms/chat-panel";
import { useConversationChannel } from "@/hooks/useRoomChannel";
import {
  deleteDirectMessageAction,
  loadOlderDirectMessages,
  markConversationReadAction,
  sendDirectMessageAction,
} from "@/lib/messages/actions";
import type { DirectMessage } from "@/lib/repositories/conversations";
import type { Message } from "@/lib/repositories/messages";
import type { ConversationPageData } from "@/lib/messages/queries";

const PAGE = 50;
const MARK_READ_THROTTLE_MS = 3000;

// MessageBubble speaks the room's Message shape; a private message is a plain
// user message in it.
function toBubble(m: DirectMessage): Message {
  return {
    id: m.id,
    room_id: m.conversation_id,
    sender_id: m.sender_id,
    sender_type: "user",
    content: m.content,
    status: "complete",
    ai_run_id: null,
    metadata: {},
    created_at: m.created_at,
    deleted_at: m.deleted_at,
  };
}

function upsert(list: DirectMessage[], row: DirectMessage): DirectMessage[] {
  const i = list.findIndex((m) => m.id === row.id);
  if (i === -1) return [...list, row];
  const next = [...list];
  next[i] = row;
  return next;
}

// The private chat screen (SPEC §5.1): realtime on dm:{id}, history with
// keyset pagination, send, self-delete within 5 minutes, read status.
export function DirectChat({
  data,
  currentUserId,
  className,
}: {
  data: ConversationPageData;
  currentUserId: string;
  className?: string;
}) {
  const router = useRouter();
  const { conversationId, other } = data;
  const [messages, setMessages] = useState<DirectMessage[]>(data.messages);
  const [hasMore, setHasMore] = useState(data.hasMore);
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingOlder, startLoadingOlder] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastMarkRead = useRef(0);
  const refreshedShell = useRef(false);
  const trailingMarkRead = useRef<number | null>(null);
  const markReadRef = useRef<() => void>(() => {});

  const { status } = useConversationChannel(conversationId, {
    onMessageInsert: (row) => {
      setMessages((prev) => upsert(prev, row as unknown as DirectMessage));
    },
    onMessageUpdate: (row) => {
      setMessages((prev) => upsert(prev, row as unknown as DirectMessage));
    },
    onMessageDeleted: (id) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    },
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    const t = Date.now();
    const wait = lastMarkRead.current + MARK_READ_THROTTLE_MS - t;
    if (wait > 0) {
      // Throttled: one trailing call, so a burst of messages still ends read.
      if (trailingMarkRead.current === null) {
        trailingMarkRead.current = window.setTimeout(() => {
          trailingMarkRead.current = null;
          markReadRef.current();
        }, wait);
      }
      return;
    }
    lastMarkRead.current = t;
    void markConversationReadAction(conversationId).then((result) => {
      // The nav badges were rendered before this read: refresh them once.
      if (result.ok && !refreshedShell.current) {
        refreshedShell.current = true;
        router.refresh();
      }
    });
  }, [conversationId, router]);

  useEffect(() => {
    markReadRef.current = markRead;
  }, [markRead]);
  useEffect(
    () => () => {
      if (trailingMarkRead.current !== null) window.clearTimeout(trailingMarkRead.current);
    },
    [],
  );

  const lastMessageId = messages.at(-1)?.id;
  useEffect(() => {
    markRead();
  }, [lastMessageId, markRead]);
  useEffect(() => {
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [markRead]);

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
      const older = await loadOlderDirectMessages(conversationId, {
        createdAt: oldest.created_at,
        id: oldest.id,
      });
      setHasMore(older.length === PAGE);
      if (older.length === 0) return;
      stickToBottom.current = false;
      setMessages((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]);
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight;
      });
    });
  }

  async function send() {
    const text = content.trim();
    if (!text || isSending) return;
    setIsSending(true);
    try {
      const result = await sendDirectMessageAction(conversationId, text);
      if (!result.ok || !result.message) {
        toast.error(result.error ?? "שליחת ההודעה נכשלה");
        return;
      }
      setContent("");
      stickToBottom.current = true;
      setMessages((prev) => upsert(prev, result.message!));
    } catch {
      toast.error("שליחת ההודעה נכשלה");
    } finally {
      setIsSending(false);
    }
  }

  async function handleDelete(message: DirectMessage) {
    setBusyId(message.id);
    const result = await deleteDirectMessageAction(message.id);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error ?? "המחיקה נכשלה");
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, deleted_at: new Date().toISOString() } : m)),
    );
  }

  const sender = { profile: { full_name: other.fullName, avatar_url: other.avatarPath } };

  return (
    <section
      aria-label={`שיחה עם ${other.fullName}`}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[22px] bg-card shadow-card",
        className,
      )}
    >
      <header className="flex items-center gap-3 border-b border-divider px-4 py-3 sm:px-6">
        <Link
          href="/messages"
          aria-label="חזרה לשיחות"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground lg:hidden"
        >
          <ArrowRightIcon className="size-5" aria-hidden />
        </Link>
        <PersonAvatar
          id={other.id}
          name={other.fullName}
          avatarPath={other.avatarPath}
          online={other.online}
          className="size-10 shrink-0 text-sm"
        />
        <div className="flex min-w-0 grow flex-col">
          {data.otherActive ? (
            <Link
              href={`/students/${other.id}`}
              className="truncate text-[15px] font-bold hover:text-primary"
            >
              {other.fullName}
            </Link>
          ) : (
            <span className="truncate text-[15px] font-bold">{other.fullName}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {other.online ? "מחובר/ת עכשיו" : "לא מחובר/ת כרגע"}
          </span>
        </div>
        {status === "error" && (
          <span className="shrink-0 text-xs text-warning-ink" role="status">
            אין חיבור בזמן אמת
          </span>
        )}
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 sm:px-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        {hasMore && (
          <div className="flex justify-center pb-2">
            <Button variant="quiet" size="chip" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? "טוען..." : "טעינת הודעות קודמות"}
            </Button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-muted-foreground">
            זו תחילת השיחה שלך עם {other.fullName}. כתבו הודעה כדי להתחיל.
          </p>
        )}
        {messages.map((message, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(message.created_at);
          const isOwn = message.sender_id === currentUserId;
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
                message={toBubble(message)}
                isOwn={isOwn}
                sender={isOwn ? undefined : sender}
                showSender={!isOwn && (newDay || prev?.sender_id !== message.sender_id)}
                online={!isOwn && other.online}
                canDelete={isOwn && now - new Date(message.created_at).getTime() < DELETE_WINDOW_MS}
                onDelete={() => void handleDelete(message)}
                canRetry={false}
                onRetry={() => {}}
                busy={busyId === message.id}
              />
            </Fragment>
          );
        })}
      </div>

      <div className="px-4 pt-2 pb-4 sm:px-6 sm:pb-5">
        {data.otherActive ? (
          <div className="flex items-end gap-2 rounded-full bg-surface-2 py-1 ps-4 pe-1 focus-within:ring-2 focus-within:ring-primary-line">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={`הודעה ל${other.fullName}...`}
              aria-label="כתיבת הודעה"
              rows={1}
              maxLength={4000}
              className="max-h-28 min-h-8 resize-none border-0 bg-transparent px-0 py-1.5 shadow-none focus-visible:ring-0"
              disabled={isSending}
            />
            <Button
              size="icon"
              className="size-[30px] shrink-0 rounded-full bg-primary text-white hover:bg-primary-strong"
              onClick={() => void send()}
              disabled={isSending || !content.trim()}
              aria-label="שליחת הודעה"
            >
              <SendIcon className="size-3.5 rtl:-scale-x-100" />
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            החשבון הזה לא פעיל, אי אפשר לשלוח אליו הודעות.
          </p>
        )}
      </div>
    </section>
  );
}
