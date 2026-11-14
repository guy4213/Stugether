"use client";

import Link from "next/link";
import { XIcon } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { InviteStudentButton } from "@/components/students/invite-student-button";
import { courseTheme } from "@/lib/ui/course-theme";
import { MATCH_GRADIENT, matchLevel } from "@/lib/ui/tones";
import type { ChatPartner, ConversationPageData } from "@/lib/messages/queries";

// Beside the chat on wide screens, opened from the header's "פרטים" button:
// who this is, how well we match, the courses we share, and the next step
// (design round 4, 12.11.2026).
export function PartnerPanel({
  other,
  partner,
  onClose,
}: {
  other: ConversationPageData["other"];
  partner: ChatPartner;
  onClose: () => void;
}) {
  const { match } = partner;
  return (
    <aside
      aria-label={`פרטים על ${other.fullName}`}
      className="flex w-[300px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-s border-divider bg-card px-[22px] pt-7 pb-[22px] text-center motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-left-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="סגירת הפרטים"
        className="-mb-2 flex size-[34px] items-center justify-center self-end rounded-[11px] bg-[#f4f7fb] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary-line focus-visible:outline-none"
      >
        <XIcon className="size-4" aria-hidden />
      </button>
      <PersonAvatar
        id={other.id}
        name={other.fullName}
        avatarPath={other.avatarPath}
        online={other.online}
        ring={other.online}
        className="size-[88px]"
      />
      <h2 className="mt-3.5 text-xl font-extrabold tracking-[-.3px]">{other.fullName}</h2>
      {partner.meta && <p className="text-[13px] text-muted-foreground">{partner.meta}</p>}

      {match && (
        <div className="mt-[18px] flex w-full items-center gap-3 rounded-[18px] bg-[#f6f8fc] p-3.5 text-start">
          <ProgressRing
            value={match.percent}
            size={58}
            stroke={6}
            from={MATCH_GRADIENT[matchLevel(match.percent)][0]}
            to={MATCH_GRADIENT[matchLevel(match.percent)][1]}
            label={`${match.percent}% התאמה`}
            className="shrink-0"
          >
            <span className="text-[15px] font-extrabold text-primary-strong">{match.percent}%</span>
          </ProgressRing>
          <span className="flex min-w-0 flex-col gap-0.5">
            <strong className="text-sm">התאמה ללמידה יחד</strong>
            <small className="text-xs text-muted-foreground">
              {match.reasons.length > 0
                ? match.reasons.slice(0, 2).join(", ")
                : "אין עדיין נתונים משותפים"}
            </small>
          </span>
        </div>
      )}

      {partner.sharedCourses.length > 0 && (
        <ul aria-label="קורסים משותפים" className="mt-3.5 flex w-full flex-col gap-2.5 text-start">
          {partner.sharedCourses.map((c) => {
            const theme = courseTheme(c.name, c.id);
            const Icon = theme.icon;
            return (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.id}`}
                  className="flex items-center gap-2.5 rounded-xl text-sm font-semibold hover:text-primary"
                >
                  <span
                    aria-hidden
                    className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px] text-white"
                    style={{
                      background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
                    }}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="truncate">{c.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto flex w-full flex-col items-center gap-1.5 pt-5">
        <InviteStudentButton
          inviteeId={other.id}
          inviteeName={other.fullName}
          sharedCourses={partner.sharedCourses}
          myCourses={partner.myCourses}
          className="w-full"
          buttonClassName="h-[46px] w-full rounded-[15px] bg-brand-diag text-sm font-semibold text-white shadow-[0_14px_28px_-14px_rgba(37,99,235,.8)] hover:brightness-110"
        />
        <Link
          href={`/students/${other.id}`}
          className="pt-1.5 text-[13px] font-semibold text-primary hover:underline"
        >
          לפרופיל המלא
        </Link>
      </div>
    </aside>
  );
}
