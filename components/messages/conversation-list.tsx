"use client";

import { useState } from "react";
import Link from "next/link";
import { SquarePenIcon } from "lucide-react";
import { cn } from "cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { relativeTimeHe } from "@/lib/ui/format";
import { filterPeople } from "@/lib/ui/people";
import { NoPeopleFound, PeopleSearchInput } from "@/components/ui/people-search-input";
import type { InboxItem } from "@/lib/messages/queries";

// The inbox: one row per private chat, newest first. Unread = bold name, blue
// time and a gradient dot (design round 4, 12.11.2026). The search by name
// shows up once the list is long enough to need it.
export function ConversationList({
  items,
  activeId,
  heading = "h2",
  className,
}: {
  items: InboxItem[];
  activeId?: string;
  /** /messages makes the list title the page's h1. */
  heading?: "h1" | "h2";
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const shown = filterPeople(items, query, (i) => [i.other.fullName]);
  const unreadChats = items.filter((i) => i.unread > 0 && i.conversationId !== activeId).length;
  const Heading = heading;

  return (
    <nav
      aria-label="השיחות שלי"
      className={cn(
        "flex min-h-0 flex-col gap-[18px] bg-card px-4 pt-6 pb-4 sm:px-[18px] lg:border-e lg:border-divider lg:pt-[26px]",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-1.5">
        <Heading className="text-[30px] leading-none font-extrabold tracking-[-.8px]">
          הודעות
        </Heading>
        {unreadChats > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-diag px-2 text-xs font-bold text-white">
            {unreadChats}
            <span className="sr-only"> שיחות עם הודעות שלא נקראו</span>
          </span>
        )}
        <Link
          href="/students"
          title="שיחה חדשה"
          aria-label="שיחה חדשה: מציאת סטודנט/ית"
          className="ms-auto flex size-[42px] items-center justify-center rounded-[14px] bg-foreground text-white shadow-[0_10px_20px_-10px_rgba(15,27,51,.6)] transition-transform hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <SquarePenIcon className="size-[19px]" aria-hidden />
        </Link>
      </div>

      {items.length > 3 && (
        <PeopleSearchInput
          value={query}
          onChange={setQuery}
          placeholder="חיפוש שיחה לפי שם"
          className="h-[46px] shrink-0 rounded-[15px] bg-[#f4f7fb] px-4"
        />
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
          <p className="text-base font-bold text-foreground">אין עדיין שיחות</p>
          <p>
            אפשר לפתוח שיחה מכרטיס של סטודנט/ית ב
            <Link href="/students" className="font-semibold text-primary hover:underline">
              רשימת הסטודנטים
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
          {shown.length === 0 && (
            <li>
              <NoPeopleFound query={query} />
            </li>
          )}
          {shown.map((item) => {
            const active = item.conversationId === activeId;
            const unread = item.unread > 0 && !active;
            return (
              <li key={item.conversationId}>
                <Link
                  href={`/messages/${item.conversationId}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3.5 rounded-[20px] p-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-line",
                    active ? "bg-[linear-gradient(135deg,#eef4ff,#eefaf6)]" : "hover:bg-surface-2",
                  )}
                >
                  <PersonAvatar
                    id={item.other.id}
                    name={item.other.fullName}
                    avatarPath={item.other.avatarPath}
                    online={item.other.online}
                    className="size-[50px] shrink-0"
                  />
                  <span className="flex min-w-0 grow flex-col gap-[3px]">
                    <span className="flex items-center justify-between gap-2.5">
                      <span
                        className={cn(
                          "truncate text-[15px] tracking-[-.1px]",
                          unread ? "font-extrabold" : "font-semibold",
                        )}
                      >
                        {item.other.fullName}
                      </span>
                      <time
                        dateTime={item.lastMessageAt}
                        suppressHydrationWarning
                        className={cn(
                          "shrink-0 text-xs",
                          unread ? "font-bold text-primary" : "text-[#8592ab]",
                        )}
                      >
                        {relativeTimeHe(item.lastMessageAt)}
                      </time>
                    </span>
                    <span className="flex items-center justify-between gap-2.5">
                      <span
                        className={cn(
                          "truncate text-[13.5px]",
                          unread ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {item.preview === null
                          ? "ההודעה נמחקה"
                          : `${item.previewIsMine ? "אני: " : ""}${item.preview}`}
                      </span>
                      {unread && (
                        <span className="size-2.5 shrink-0 rounded-full bg-brand-diag shadow-[0_0_0_4px_rgba(37,99,235,.12)]">
                          <span className="sr-only">
                            {item.unread > 99 ? "99+" : item.unread} הודעות שלא נקראו
                          </span>
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
