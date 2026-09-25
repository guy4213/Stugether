import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getAvatarUrl } from "@/lib/storage";
import type { PublicProfile } from "@/lib/repositories/profiles";
import type { MatchResult } from "@/lib/matching/score";

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function matchColor(percent: number): string {
  if (percent >= 60) return "bg-secondary/20 text-secondary-foreground";
  if (percent >= 20) return "bg-accent text-accent-foreground";
  return "bg-muted text-muted-foreground";
}

// Eyal's request: show a match percentage between the viewer and every other
// student on a course's roster, based on institution/faculty/department/
// study year/city (see lib/matching/score.ts).
export function RosterList({
  classmates,
}: {
  classmates: { profile: PublicProfile; match: MatchResult }[];
}) {
  if (classmates.length === 0) {
    return <p className="text-sm text-muted-foreground">אין עדיין סטודנטים אחרים רשומים לקורס.</p>;
  }

  return (
    <div className="space-y-2">
      {classmates.map(({ profile, match }) => (
        <div
          key={profile.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="flex items-center gap-3">
            <Avatar>
              {profile.avatar_url && (
                <AvatarImage src={getAvatarUrl(profile.avatar_url)} alt={profile.full_name} />
              )}
              <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {match.breakdown
                  .filter((b) => b.matched)
                  .map((b) => b.label)
                  .join(" · ") || "אין נתונים משותפים"}
              </p>
            </div>
          </div>
          <Badge className={matchColor(match.percent)}>{match.percent}% התאמה</Badge>
        </div>
      ))}
    </div>
  );
}
