import Link from "next/link";
import { MessageSquareTextIcon } from "lucide-react";
import { cn } from "cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { relativeTimeHe } from "@/lib/ui/format";
import type { InboxItem } from "@/lib/messages/queries";

// The inbox: one row per private chat, newest first, with an unread count.
export function ConversationList({
  items,
  activeId,
  className,
}: {
  items: InboxItem[];
  activeId?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="השיחות שלי"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[22px] bg-card shadow-card",
        className,
      )}
    >
      <h2 className="border-b border-divider px-5 py-4 text-base font-bold">השיחות שלי</h2>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
          <MessageSquareTextIcon className="size-8" aria-hidden />
          <p>אין עדיין שיחות.</p>
          <p>
            אפשר לפתוח שיחה מכרטיס של סטודנט/ית ב
            <Link href="/students" className="font-semibold text-primary hover:underline">
              רשימת הסטודנטים
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {items.map((item) => {
            const active = item.conversationId === activeId;
            const unread = item.unread > 0 && !active;
            return (
              <li key={item.conversationId} className="border-b border-divider last:border-b-0">
                <Link
                  href={`/messages/${item.conversationId}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2",
                    active && "bg-primary-soft hover:bg-primary-soft",
                  )}
                >
                  <PersonAvatar
                    id={item.other.id}
                    name={item.other.fullName}
                    avatarPath={item.other.avatarPath}
                    online={item.other.online}
                    className="size-11 shrink-0 text-sm"
                  />
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn("truncate text-sm", unread ? "font-bold" : "font-semibold")}
                      >
                        {item.other.fullName}
                      </span>
                      <time
                        dateTime={item.lastMessageAt}
                        className="shrink-0 text-[11px] text-muted-foreground"
                      >
                        {relativeTimeHe(item.lastMessageAt)}
                      </time>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-[13px]",
                          unread ? "font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {item.preview === null
                          ? "ההודעה נמחקה"
                          : `${item.previewIsMine ? "את/ה: " : ""}${item.preview}`}
                      </span>
                      {unread && (
                        <span className="h-5 min-w-5 shrink-0 rounded-[10px] bg-primary px-1.5 text-center text-[11px] leading-5 font-bold text-white">
                          {item.unread > 99 ? "99+" : item.unread}
                          <span className="sr-only"> הודעות שלא נקראו</span>
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
