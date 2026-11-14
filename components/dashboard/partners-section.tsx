"use client";

import { useState } from "react";
import Link from "next/link";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { InviteStudentButton } from "@/components/students/invite-student-button";
import { MessageStudentButton } from "@/components/messages/message-student-button";
import { FriendButton } from "@/components/friends/friend-button";
import type { MyFriendState } from "@/lib/friends/queries";
import { SectionHeader } from "@/components/dashboard/section-header";
import type { DashboardPartner } from "@/lib/dashboard/queries";
import { cn } from "cn";
import { LastSeen } from "@/components/ui/last-seen";
import { MATCH_SOFT, matchLevel } from "@/lib/ui/tones";
import { filterPeople } from "@/lib/ui/people";
import { NoPeopleFound, PeopleSearchInput } from "@/components/ui/people-search-input";

const ICON_BTN =
  "flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-white text-primary transition-colors hover:bg-primary-soft";

function sharedLabel(count: number) {
  return count === 1 ? "קורס משותף אחד" : `${count} קורסים משותפים`;
}

// "סטודנטים שמתאימים לך": the classmates I match best (scrolls sideways), each with an invite button and
// a message button that opens the private chat directly (not the profile).
export function PartnersSection({
  partners,
  hasCourses,
  friends = {},
}: {
  partners: DashboardPartner[];
  hasCourses: boolean;
  friends?: Record<string, MyFriendState>;
}) {
  const [query, setQuery] = useState("");
  const shown = filterPeople(partners, query, (p) => [p.name, p.departmentName]);
  return (
    <section aria-labelledby="partners" className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        id="partners"
        title="סטודנטים שמתאימים לך"
        link={{ href: "/students", label: "כל הסטודנטים" }}
      />

      {partners.length === 0 ? (
        <p className="flex flex-1 items-center justify-center rounded-[20px] border-2 border-dashed border-switch-off bg-surface-2 p-6 text-center text-sm text-muted-foreground">
          <span>
            {hasCourses
              ? "עוד אין סטודנטים נוספים בקורסים שלך."
              : "הירשמו לקורסים כדי לראות כאן סטודנטים שמתאימים לך."}{" "}
            <Link href="/students" className="font-semibold text-primary">
              לכל הסטודנטים
            </Link>
          </span>
        </p>
      ) : (
        <>
          {partners.length > 4 && (
            <PeopleSearchInput value={query} onChange={setQuery} className="bg-card sm:max-w-xs" />
          )}
          {shown.length === 0 && <NoPeopleFound query={query} />}
          <ul
            aria-label="גללו לצדדים כדי לראות עוד סטודנטים"
            className="-mx-4 flex flex-1 snap-x snap-mandatory [scrollbar-width:thin] gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-2 sm:-mx-1 sm:px-1"
          >
            {shown.map((p) => (
              <li
                key={p.id}
                className="flex w-[230px] shrink-0 snap-start flex-col items-center rounded-[20px] border border-border bg-card px-4 pt-5 pb-4 text-center shadow-card-sm"
              >
                <Link
                  href={`/students/${p.id}`}
                  className="flex flex-col items-center rounded-full"
                >
                  <PersonAvatar
                    id={p.id}
                    name={p.name}
                    avatarPath={p.avatarPath}
                    online={p.online}
                    className="size-[76px] border-[3px] border-primary bg-white text-xl"
                  />
                  <span
                    className={cn(
                      "z-10 -mt-3 rounded-full border-[1.5px] px-2.5 py-0.5 text-[11px] font-bold",
                      MATCH_SOFT[matchLevel(p.percent)],
                    )}
                  >
                    {p.percent}% התאמה
                  </span>
                </Link>
                <Link
                  href={`/students/${p.id}`}
                  className="mt-2.5 text-base font-extrabold hover:text-primary"
                >
                  {p.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {[p.departmentName, p.year].filter(Boolean).join(" | ") || "סטודנט/ית"}
                </span>
                <LastSeen online={p.online} lastSeenAt={p.lastSeenAt} className="mt-1" />
                <span className="mt-2.5 rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-semibold text-success-ink">
                  {sharedLabel(p.sharedCourses.length)}
                </span>
                <div className="mt-auto flex w-full items-center gap-1.5 pt-4">
                  <FriendButton
                    compact
                    studentId={p.id}
                    studentName={p.name}
                    initial={friends[p.id]}
                    className="size-9"
                  />
                  <MessageStudentButton
                    compact
                    studentId={p.id}
                    studentName={p.name}
                    className={ICON_BTN}
                    iconClassName="size-4"
                  />
                  <InviteStudentButton
                    compact
                    inviteeId={p.id}
                    inviteeName={p.name}
                    sharedCourses={p.sharedCourses}
                    className="min-w-0 grow"
                    buttonClassName="h-9 w-full rounded-[10px] border-0 bg-primary px-2 text-[13px] font-bold text-white hover:bg-primary-strong"
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
