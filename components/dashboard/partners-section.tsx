import Link from "next/link";
import { UserRoundPlusIcon } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { InviteStudentButton } from "@/components/students/invite-student-button";
import { MessageStudentButton } from "@/components/messages/message-student-button";
import { SectionHeader } from "@/components/dashboard/section-header";
import type { DashboardPartner } from "@/lib/dashboard/queries";

const ICON_BTN =
  "flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-white text-primary transition-colors hover:bg-primary-soft";

function sharedLabel(count: number) {
  return count === 1 ? "קורס משותף אחד" : `${count} קורסים משותפים`;
}

// "שותפים ללמידה": the classmates I match best, each with an invite button and
// a message button that opens the private chat directly (not the profile).
export function PartnersSection({
  partners,
  hasCourses,
}: {
  partners: DashboardPartner[];
  hasCourses: boolean;
}) {
  return (
    <section aria-labelledby="partners" className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        id="partners"
        title="שותפים ללמידה"
        link={{ href: "/students", label: "הצג הכל" }}
      />

      {partners.length === 0 ? (
        <p className="flex flex-1 items-center justify-center rounded-[20px] border-2 border-dashed border-switch-off bg-surface-2 p-6 text-center text-sm text-muted-foreground">
          <span>
            {hasCourses
              ? "עוד אין סטודנטים נוספים בקורסים שלך."
              : "הירשמו לקורסים כדי לראות כאן שותפים ללמידה."}{" "}
            <Link href="/students" className="font-semibold text-primary">
              לכל הסטודנטים
            </Link>
          </span>
        </p>
      ) : (
        <ul className="-mx-4 flex flex-1 snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {partners.map((p) => (
            <li
              key={p.id}
              className="flex w-[230px] shrink-0 snap-start flex-col items-center rounded-[20px] border border-border bg-card px-4 pt-5 pb-4 text-center shadow-card-sm sm:w-auto"
            >
              <Link href={`/students/${p.id}`} className="flex flex-col items-center rounded-full">
                <PersonAvatar
                  id={p.id}
                  name={p.name}
                  avatarPath={p.avatarPath}
                  online={p.online}
                  className="size-[76px] border-[3px] border-primary bg-white text-xl"
                />
                <span className="z-10 -mt-3 rounded-full border-[1.5px] border-primary bg-white px-2.5 py-0.5 text-[11px] font-bold text-primary-strong">
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
              <span className="mt-2.5 rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-semibold text-success-ink">
                {sharedLabel(p.sharedCourses.length)}
              </span>
              <div className="mt-auto flex w-full items-center gap-1.5 pt-4">
                <Link
                  href={`/students/${p.id}#invite`}
                  aria-label={`הזמנה של ${p.name} לפי קורס`}
                  title="הזמנה לפי קורס"
                  className={ICON_BTN}
                >
                  <UserRoundPlusIcon className="size-4" aria-hidden />
                </Link>
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
      )}
    </section>
  );
}
