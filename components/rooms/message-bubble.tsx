import { cn } from "cn";
import { RotateCcwIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { AiMarkdown } from "@/components/rooms/ai-markdown";
import { timeHe } from "@/lib/ui/format";
import type { Message } from "@/lib/repositories/messages";
import type { RoomMember } from "@/lib/repositories/rooms";

export const DELETE_WINDOW_MS = 5 * 60 * 1000;

export function MessageBubble({
  message,
  isOwn,
  sender,
  showSender,
  online,
  canDelete,
  onDelete,
  canRetry,
  onRetry,
  busy,
}: {
  message: Message;
  isOwn: boolean;
  sender: RoomMember | undefined;
  showSender: boolean;
  online: boolean;
  canDelete: boolean;
  onDelete: () => void;
  canRetry: boolean;
  onRetry: () => void;
  busy: boolean;
}) {
  const isAi = message.sender_type === "ai";
  const isStreaming = message.status === "streaming";
  const isFailed = isAi && message.status === "failed";
  const isDeleted = message.deleted_at !== null;
  const name = isAi ? "עוזר AI" : (sender?.profile?.full_name ?? "סטודנט/ית");

  if (message.sender_type === "system") {
    return (
      <p className="py-1 text-center text-xs text-muted-foreground" role="note">
        {message.content}
      </p>
    );
  }

  return (
    <div className={cn("group flex items-end gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn &&
        (showSender ? (
          isAi ? (
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-diag text-white"
            >
              <SparklesIcon className="size-4" />
            </span>
          ) : (
            <PersonAvatar
              id={message.sender_id ?? "x"}
              name={name}
              avatarPath={sender?.profile?.avatar_url}
              online={online}
              className="size-8 text-[11px]"
            />
          )
        ) : (
          <span className="w-8 shrink-0" />
        ))}

      <div
        className={cn(
          "flex min-w-0 flex-col gap-1",
          isAi ? "max-w-[85%]" : "max-w-[75%]",
          isOwn ? "items-end" : "items-start",
        )}
      >
        {!isOwn && showSender && (
          <p className="px-1 text-xs font-medium text-muted-foreground">{name}</p>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words shadow-sm",
            isDeleted
              ? "border border-dashed border-border bg-transparent text-muted-foreground italic shadow-none"
              : isOwn
                ? "rounded-ee-md bg-primary text-primary-foreground"
                : isFailed
                  ? "rounded-es-md border border-danger-line bg-danger-soft text-foreground"
                  : isAi
                    ? "rounded-es-md border border-primary-line bg-[linear-gradient(135deg,var(--color-primary-soft),var(--color-success-soft))] text-foreground"
                    : "rounded-es-md bg-muted text-foreground",
          )}
        >
          {isDeleted ? (
            <span>ההודעה נמחקה</span>
          ) : isStreaming && message.content.length === 0 ? (
            <span className="flex items-center gap-2 py-0.5 text-muted-foreground" role="status">
              העוזר כותב
              <span className="flex items-center gap-1" aria-hidden>
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current" />
              </span>
            </span>
          ) : isAi ? (
            <AiMarkdown text={message.content} />
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
        </div>

        <div className={cn("flex items-center gap-2 px-1", isOwn && "flex-row-reverse")}>
          <time dateTime={message.created_at} className="text-[11px] text-muted-foreground">
            {timeHe(message.created_at)}
          </time>
          {canDelete && !isDeleted && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="flex items-center gap-1 rounded text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 disabled:opacity-50 max-sm:opacity-100"
            >
              <Trash2Icon className="size-3" aria-hidden />
              מחיקה
            </button>
          )}
          {isFailed && canRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={busy}
              className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary shadow-sm hover:bg-primary-soft disabled:opacity-50"
            >
              <RotateCcwIcon className="size-3" aria-hidden />
              נסה שוב
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
