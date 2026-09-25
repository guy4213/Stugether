import { cn } from "cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import type { PublicProfile } from "@/lib/repositories/profiles";
import type { MatchResult } from "@/lib/matching/score";

function matchTone(percent: number): string {
  if (percent >= 60) return "bg-success-soft text-success-ink";
  if (percent >= 20) return "bg-primary-tint text-primary-strong";
  return "bg-muted text-muted-foreground";
}

// Eyal's request: show a match percentage between the viewer and every other
// student on a course's roster, based on institution/faculty/department/
// study year/city (see lib/matching/score.ts). The course page's "שותפים" tab.
export function RosterList({
  classmates,
}: {
  classmates: { profile: PublicProfile; match: MatchResult }[];
}) {
  if (classmates.length === 0) {
    return (
      <p className="rounded-[22px] border border-border bg-card p-6 text-sm text-muted-foreground">
        אין עדיין סטודנטים אחרים רשומים לקורס.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {classmates.map(({ profile, match }) => (
        <li
          key={profile.id}
          className="flex items-center justify-between gap-3 rounded-[22px] border border-border bg-card p-4"
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
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
              matchTone(match.percent),
            )}
          >
            {match.percent}% התאמה
          </span>
        </li>
      ))}
    </ul>
  );
}
