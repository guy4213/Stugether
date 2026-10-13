import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRightIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckIcon,
  CircleCheckIcon,
  ClockIcon,
  FlagIcon,
  LayoutGridIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { InviteStudentButton } from "@/components/students/invite-student-button";
import { getCurrentUser } from "@/lib/auth/session";
import { getStudentProfileData } from "@/lib/students/queries";

// A student's profile as seen by another student: academic details, hobbies,
// shared courses and why the two of them match.
export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (id === user.id) redirect("/profile");

  const data = await getStudentProfileData(user.id, id);
  if (!data) notFound();
  const { student, match, details } = data;
  const reasons = (match?.breakdown ?? []).filter((b) => b.matched);

  const tiles: { label: string; value: string | null; icon: LucideIcon }[] = [
    { label: "מוסד לימודים", value: details.institution, icon: Building2Icon },
    { label: "פקולטה", value: details.faculty, icon: LayoutGridIcon },
    { label: "מחלקה", value: details.department, icon: FlagIcon },
    { label: "מסלול לימודים", value: details.track, icon: BookOpenIcon },
    { label: "שנת לימודים", value: details.year, icon: CalendarDaysIcon },
    { label: "סמסטר", value: details.semester, icon: ClockIcon },
  ];

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-4 px-4 pt-7 pb-10 sm:px-8"
    >
      <Link
        href="/students"
        className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowRightIcon className="size-4" aria-hidden />
        חזרה לסטודנטים
      </Link>

      <article className="flex flex-col gap-7 rounded-[26px] border border-border bg-card p-6 sm:p-8">
        <header className="flex items-center gap-4 border-b border-divider pb-6">
          <PersonAvatar
            id={student.id}
            name={student.full_name}
            avatarPath={student.avatar_url}
            ring
            online={data.online}
            className="size-[76px] text-2xl"
          />
          <div className="flex min-w-0 grow flex-col gap-1">
            <h1 className="truncate text-[26px] leading-tight font-extrabold">
              {student.full_name}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {["סטודנט/ית", details.department].filter(Boolean).join(" · ")}
            </p>
            {data.online ? (
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-success-ink">
                <span className="size-2 rounded-full bg-success" aria-hidden />
                פנוי/ה ללמוד עכשיו
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground">לא מחובר/ת כרגע</span>
            )}
          </div>
          {match && (
            <ProgressRing
              value={match.percent}
              size={92}
              stroke={9}
              label={`${match.percent}% התאמה`}
            >
              <span className="flex flex-col items-center leading-none">
                <span className="text-[22px] font-extrabold">{match.percent}%</span>
                <span className="mt-1 text-[11px] text-muted-foreground">התאמה</span>
              </span>
            </ProgressRing>
          )}
        </header>

        <section aria-labelledby="academic" className="flex flex-col gap-3">
          <h2 id="academic" className="text-base font-bold">
            פרטים אקדמיים
          </h2>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {tiles.map((t) => (
              <li
                key={t.label}
                className="flex items-center gap-3 rounded-[16px] border border-border p-3"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
                >
                  <t.icon className="size-5" strokeWidth={1.9} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs text-muted-foreground">{t.label}</span>
                  <span className="truncate text-sm font-bold">{t.value ?? "—"}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="hobbies" className="flex flex-col gap-3">
          <h2 id="hobbies" className="text-base font-bold">
            תחביבים
          </h2>
          {data.hobbies.length === 0 ? (
            <p className="text-sm text-muted-foreground">לא צוינו תחביבים</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {data.hobbies.map((h) => (
                <li
                  key={h.name}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm",
                    h.shared
                      ? "bg-success-soft font-semibold text-success-ink"
                      : "bg-muted text-ink-2",
                  )}
                >
                  {h.shared && <CheckIcon className="size-3.5" strokeWidth={2.6} aria-hidden />}
                  {h.name}
                  {h.shared && <span className="sr-only">(משותף)</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="shared" className="flex flex-col gap-3">
          <h2 id="shared" className="text-base font-bold">
            קורסים משותפים
          </h2>
          {data.sharedCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין לכם עדיין קורסים משותפים</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {data.sharedCourses.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/courses/${c.id}`}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-primary-soft px-3.5 text-sm font-semibold text-primary-strong hover:brightness-95"
                  >
                    <BookOpenIcon className="size-4" aria-hidden />
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {match && (
          <section aria-labelledby="why" className="flex flex-col gap-3">
            <h2 id="why" className="text-base font-bold">
              אחוז התאמה ביניכם
            </h2>
            {reasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין עדיין נתונים משותפים</p>
            ) : (
              <ul className="flex flex-col divide-y divide-divider sm:max-w-md">
                {reasons.map((r) => (
                  <li key={r.label} className="flex items-center gap-2.5 py-2.5 text-sm">
                    <CircleCheckIcon className="size-[18px] text-success" aria-hidden />
                    <span className="grow">{r.label}</span>
                    <span dir="ltr" className="font-bold text-success-ink">
                      +{r.points}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <InviteStudentButton
          inviteeId={student.id}
          inviteeName={student.full_name}
          sharedCourses={data.sharedCourses}
        />
      </article>
    </main>
  );
}
