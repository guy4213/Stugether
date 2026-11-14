"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import type { PublicProfile } from "@/lib/repositories/profiles";
import type { MatchResult } from "@/lib/matching/score";
import { MATCH_SOFT, matchLevel } from "@/lib/ui/tones";
import { filterPeople } from "@/lib/ui/people";
import { NoPeopleFound, PeopleSearchInput } from "@/components/ui/people-search-input";

// Match percentage between the viewer and every other student on a course's
// roster (lib/matching/score.ts). The course page's "שותפים" tab; each row
// opens the student's profile.
export function RosterList({
  classmates,
}: {
  classmates: { profile: PublicProfile; match: MatchResult }[];
}) {
  const [query, setQuery] = useState("");
  const shown = filterPeople(classmates, query, (c) => [c.profile.full_name]);
  if (classmates.length === 0) {
    return (
      <p className="rounded-[22px] border border-border bg-card p-6 text-sm text-muted-foreground">
        אין עדיין סטודנטים אחרים רשומים לקורס.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {classmates.length > 4 && (
        <PeopleSearchInput value={query} onChange={setQuery} className="bg-card md:max-w-sm" />
      )}
      {shown.length === 0 && <NoPeopleFound query={query} />}
      <ul className="grid gap-3 md:grid-cols-2">
        {shown.map(({ profile, match }) => (
          <li key={profile.id}>
            <Link
              href={`/students/${profile.id}`}
              className="flex items-center justify-between gap-3 rounded-[22px] border border-border bg-card p-4 transition-colors hover:border-primary-line"
            >
              <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar
                  id={profile.id}
                  name={profile.full_name}
                  avatarPath={profile.avatar_url}
                  className="size-12 text-base"
                />
                <div className="min-w-0">
                  <p className="truncate font-bold">{profile.full_name}</p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {match.breakdown
                      .filter((b) => b.matched)
                      .map((b) => b.label)
                      .join(" · ") || "אין נתונים משותפים"}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold",
                  MATCH_SOFT[matchLevel(match.percent)],
                )}
              >
                {match.percent}% התאמה
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
