import { cn } from "cn";
import { SparklesIcon } from "lucide-react";
import type { Message } from "@/lib/repositories/messages";
import type { RoomMember } from "@/lib/repositories/rooms";

const AVATAR_COLORS = ["#1f6fd1", "#14a38b", "#8b5cf6", "#d9467b", "#c26a00"];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

export function MessageBubble({
  message,
  isOwn,
  sender,
  showSender,
}: {
  message: Message;
  isOwn: boolean;
  sender: RoomMember | undefined;
  showSender: boolean;
}) {
  const isAi = message.sender_type === "ai";
  const isStreaming = message.status === "streaming";
  const name = isAi ? "עוזר AI" : (sender?.profile?.full_name ?? "סטודנט");

  return (
    <div className={cn("flex items-end gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn &&
        (showSender ? (
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{
              background: isAi
                ? "linear-gradient(135deg, var(--primary), var(--secondary))"
                : colorFor(message.sender_id ?? "x"),
            }}
          >
            {isAi ? <SparklesIcon className="size-4" /> : initials(name)}
          </span>
        ) : (
          <span className="w-8 shrink-0" />
        ))}

      <div className={cn("flex max-w-[75%] flex-col gap-1", isOwn ? "items-end" : "items-start")}>
        {!isOwn && showSender && (
          <p className="px-1 text-xs font-medium text-muted-foreground">{name}</p>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            isOwn
              ? "rounded-ee-md bg-primary text-primary-foreground"
              : isAi
                ? "rounded-es-md border border-[oklch(0.88_0.06_175)] bg-[oklch(0.96_0.03_175)] text-foreground"
                : "rounded-es-md bg-muted text-foreground",
          )}
        >
          {isStreaming && message.content.length === 0 ? (
            <span className="flex items-center gap-1 py-1" aria-label="העוזר מקליד">
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-current" />
            </span>
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
        </div>
        <time dateTime={message.created_at} className="px-1 text-[11px] text-muted-foreground">
          {time(message.created_at)}
        </time>
      </div>
    </div>
  );
}
