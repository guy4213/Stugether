"use client";

import { useState } from "react";
import Link from "next/link";
import { SearchIcon, UsersIcon } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { LastSeen } from "@/components/ui/last-seen";
import { FriendButton } from "@/components/friends/friend-button";
import { filterPeople } from "@/lib/ui/people";
import type { FriendPerson } from "@/lib/friends/queries";

const SEARCH_FROM = 6;

// "החברים שלי" on /profile, "החברים של X" on /students/[id] (client QA
// 11.2026). On my own profile the requests waiting for me come first.
export function FriendsCard({
  title,
  friends,
  incoming = [],
  emptyText,
}: {
  title: string;
  friends: FriendPerson[];
  incoming?: (FriendPerson & { friendshipId: string })[];
  emptyText: string;
}) {
  const [query, setQuery] = useState("");
  const shown = filterPeople(friends, query, (f) => [f.name]);

  return (
    <section className="flex flex-col gap-3.5 rounded-[22px] border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <UsersIcon className="size-5 text-primary" aria-hidden />
        {title}
        <span className="text-sm font-medium text-muted-foreground">({friends.length})</span>
      </h2>

      {incoming.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[16px] bg-primary-tint p-3">
          <p className="text-[13px] font-bold text-primary-strong">בקשות חברות שמחכות לך</p>
          <ul className="flex flex-col gap-2">
            {incoming.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Link href={`/students/${p.id}`} className="flex min-w-0 grow items-center gap-3">
                  <PersonAvatar id={p.id} name={p.name} avatarPath={p.avatarPath} />
                  <span className="truncate font-semibold">{p.name}</span>
                </Link>
                <FriendButton
                  compact
                  studentId={p.id}
                  studentName={p.name}
                  initial={{ status: "incoming", friendshipId: p.friendshipId }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {friends.length >= SEARCH_FROM && (
        <label className="flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-primary-line">
          <SearchIcon className="size-4 shrink-0" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש חבר/ה לפי שם"
            aria-label="חיפוש חבר/ה"
            className="min-w-0 grow bg-transparent text-sm text-foreground outline-none"
          />
        </label>
      )}

      {friends.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">לא נמצאו חברים בשם „{query.trim()}“</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map((p) => (
            <li key={p.id}>
              <Link
                href={`/students/${p.id}`}
                className="flex items-center gap-3 rounded-[14px] px-2 py-2 hover:bg-surface-2"
              >
                <PersonAvatar id={p.id} name={p.name} avatarPath={p.avatarPath} online={p.online} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{p.name}</span>
                  <LastSeen online={p.online} lastSeenAt={p.lastSeenAt} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
