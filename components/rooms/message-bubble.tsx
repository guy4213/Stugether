import { cn } from "cn";
import { SparklesIcon } from "lucide-react";
import type { Message } from "@/lib/repositories/messages";
import type { RoomMember } from "@/lib/repositories/rooms";

export function MessageBubble({
  message,
  isOwn,
  sender,
}: {
  message: Message;
  isOwn: boolean;
  sender: RoomMember | undefined;
}) {
  const isAi = message.sender_type === "ai";
  const isStreaming = message.status === "streaming";

  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[80%] space-y-1", isOwn && "items-end")}>
        {!isOwn && (
          <p className="flex items-center gap-1 ps-1 text-xs text-muted-foreground">
            {isAi && <SparklesIcon className="size-3" />}
            {isAi ? "עוזר AI" : (sender?.profile?.full_name ?? "סטודנט")}
          </p>
        )}
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm",
            isOwn
              ? "rounded-ee-sm bg-primary text-primary-foreground"
              : isAi
                ? "rounded-es-sm bg-secondary/15 text-foreground"
                : "rounded-es-sm bg-muted text-foreground",
          )}
        >
          {isStreaming && message.content.length === 0 ? (
            <span className="text-muted-foreground">מקליד/ה...</span>
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
        </div>
      </div>
    </div>
  );
}
