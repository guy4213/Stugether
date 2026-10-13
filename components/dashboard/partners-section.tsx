import Link from "next/link";
import { ArrowLeftIcon, UsersIcon } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { InviteStudentButton } from "@/components/students/invite-student-button";
import type { DashboardPartner } from "@/lib/dashboard/queries";

// "שותפים ללמידה": the classmates I match best, each with an invite button.
export function PartnersSection({ partners }: { partners: DashboardPartner[] }) {
  return (
    <section
      aria-labelledby="partners"
      className="flex flex-col gap-4 rounded-[24px] border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="partners" className="flex items-center gap-2 text-xl font-extrabold">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary"
          >
            <UsersIcon className="size-[18px]" />
          </span>
          שותפים ללמידה
        </h2>
        <Link
          href="/students"
          className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-strong"
        >
          הצג הכל
          <ArrowLeftIcon className="size-4" strokeWidth={2.2} aria-hidden />
        </Link>
      </div>

      {partners.length === 0 ? (
        <p className="rounded-[18px] border-2 border-dashed border-switch-off bg-surface-2 p-6 text-center text-sm text-muted-foreground">
          הירשמו לקורסים כדי לראות כאן שותפים ללמידה.{" "}
          <Link href="/students" className="font-semibold text-primary">
            לכל הסטודנטים
          </Link>
        </p>
      ) : (
        <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-5">
          {partners.map((p) => (
            <li
              key={p.id}
              className="flex w-[220px] shrink-0 snap-start flex-col gap-3 rounded-[18px] border border-border bg-surface-2/60 p-3.5 sm:w-auto"
            >
              <Link
                href={`/students/${p.id}`}
                className="flex flex-col items-center gap-2 text-center"
              >
                <PersonAvatar
                  id={p.id}
                  name={p.name}
                  avatarPath={p.avatarPath}
                  ring
                  online={p.online}
                  className="size-16 text-lg"
                />
                <span className="flex flex-col">
                  <span className="font-bold hover:text-primary">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[p.departmentName, p.year].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success-ink">
                  {p.percent}% התאמה
                </span>
              </Link>
              <ul className="flex grow flex-col gap-1 text-xs text-ink-2">
                {p.reasons.map((r) => (
                  <li key={r} className="flex items-center gap-1.5">
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
              <InviteStudentButton
                inviteeId={p.id}
                inviteeName={p.name}
                sharedCourses={p.sharedCourses}
                compact
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
