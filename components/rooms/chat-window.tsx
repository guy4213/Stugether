"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { SendIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageBubble } from "@/components/rooms/message-bubble";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import type { Message } from "@/lib/repositories/messages";
import type { RoomMember } from "@/lib/repositories/rooms";

const TZ = "Asia/Jerusalem";

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

// Deliberately just the message thread — no side conversation-list panel
// (per the client's note: rooms are course-scoped, not a general inbox, so
// this page IS "the chat", full width).
export function ChatWindow({
  roomId,
  currentUserId,
  initialMessages,
  members,
  isActive,
}: {
  roomId: string;
  currentUserId: string;
  initialMessages: Message[];
  members: RoomMember[];
  isActive: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const membersById = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  useRoomChannel(roomId, {
    onMessageInsert: (row) => {
      setMessages((prev) =>
        prev.some((m) => m.id === row.id) ? prev : [...prev, row as unknown as Message],
      );
    },
    onMessageUpdate: (row) => {
      setMessages((prev) => prev.map((m) => (m.id === row.id ? (row as unknown as Message) : m)));
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "שליחת ההודעה נכשלה");
        return;
      }
      setContent("");
    } catch {
      toast.error("שליחת ההודעה נכשלה");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-muted-foreground">
            אין עדיין הודעות בחדר הזה. כתבו הודעה כדי להתחיל, או תייגו @ai לשאלה לעוזר.
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
                isOwn={message.sender_id === currentUserId}
                sender={message.sender_id ? membersById.get(message.sender_id) : undefined}
                showSender={!sameSenderAsPrev}
              />
            </Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3 sm:p-4">
        {isActive ? (
          <div className="flex items-end gap-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="כתבו הודעה... (@ai לשאלה לעוזר)"
              aria-label="כתיבת הודעה"
              rows={1}
              className="max-h-32 min-h-11 resize-none rounded-full bg-muted/60 px-5 py-3"
              disabled={isSending}
            />
            <Button
              size="icon"
              variant="gradient"
              className="size-11"
              onClick={handleSend}
              disabled={isSending || !content.trim()}
              aria-label="שליחת הודעה"
            >
              <SendIcon className="size-4 rtl:-scale-x-100" />
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            החדר הזה אינו פעיל יותר — לא ניתן לשלוח הודעות חדשות.
          </p>
        )}
      </div>
    </div>
  );
}
