import Link from "next/link";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { yearLabel } from "@/lib/ui/labels";
import type { StudentCard as StudentCardData } from "@/lib/students/queries";

// One student in the directory: who, where they study, how well we match.
export function StudentCard({ student }: { student: StudentCardData }) {
  const { profile, match } = student;
  const reasons = (match?.breakdown ?? [])
    .filter((b) => b.matched)
    .slice(0, 3)
    .map((b) => b.label);

  return (
    <Link
      href={`/students/${profile.id}`}
      className="flex flex-col gap-4 rounded-[22px] border border-border bg-card p-5 transition-colors hover:border-primary-line"
    >
      <div className="flex items-center gap-3.5">
        <PersonAvatar
          id={profile.id}
          name={profile.full_name}
          avatarPath={profile.avatar_url}
          ring
          online={student.online}
          className="size-14 text-[17px]"
        />
        <div className="flex min-w-0 grow flex-col">
          <span className="truncate text-[17px] font-bold">{profile.full_name}</span>
          <span className="truncate text-[13px] text-muted-foreground">
            {[student.departmentName, yearLabel(profile.study_year)].filter(Boolean).join(" · ") ||
              "סטודנט/ית"}
          </span>
          {student.institutionName && (
            <span className="truncate text-xs text-muted-foreground">
              {student.institutionName}
            </span>
          )}
        </div>
        {match && (
          <ProgressRing
            value={match.percent}
            size={58}
            stroke={6}
            label={`${match.percent}% התאמה`}
          >
            <span className="text-[13px] font-extrabold">{match.percent}%</span>
          </ProgressRing>
        )}
      </div>
      <div className="flex min-h-7 flex-wrap gap-1.5">
        {student.online && (
          <span className="flex h-7 items-center gap-1.5 rounded-full bg-success-soft px-2.5 text-xs font-semibold text-success-ink">
            <span className="size-[7px] rounded-full bg-success" aria-hidden />
            מחובר/ת עכשיו
          </span>
        )}
        {reasons.map((r) => (
          <span
            key={r}
            className="flex h-7 items-center rounded-full bg-muted px-2.5 text-xs font-medium text-ink-2"
          >
            {r}
          </span>
        ))}
      </div>
    </Link>
  );
}
