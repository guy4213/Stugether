"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  GraduationCapIcon,
  HeartIcon,
  MessageSquareTextIcon,
  UserRoundPlusIcon,
} from "lucide-react";
import { cn } from "cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { InviteStudentButton } from "@/components/students/invite-student-button";
import { yearLabel } from "@/lib/ui/labels";
import type { StudentCard as StudentCardData } from "@/lib/students/queries";

const MAX_COURSE_CHIPS = 2;

// Badge colour by match (Figma: blue high, green middle, orange low).
function matchTone(percent: number) {
  if (percent >= 70) return "bg-linear-to-b from-[#3b82f6] to-primary-strong";
  if (percent >= 40) return "bg-linear-to-b from-[#4ade80] to-success";
  return "bg-linear-to-b from-[#fb923c] to-[#ea580c]";
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClockIcon;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-start gap-2 text-[13px] leading-snug">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span>
        <span className="font-bold">{label}:</span> {value}
      </span>
    </li>
  );
}

// One student in the directory (Figma "כרטיסיות סטודנטים"): photo, match,
// shared courses, and "פרטים נוספים" opening over the cards below.
export function StudentCard({ student }: { student: StudentCardData }) {
  const { profile, match, details } = student;
  const [open, setOpen] = useState(false);
  const subtitle = [student.departmentName, yearLabel(profile.study_year)]
    .filter(Boolean)
    .join(" | ");
  const courses = student.sharedCourses;
  const studies = [details.track, details.semester].filter(Boolean).join(" • ");
  const list = (items: { name: string }[]) => items.map((i) => i.name).join(", ");

  return (
    <article className="relative mt-11 h-[calc(100%-2.75rem)]">
      <div
        className={cn(
          "flex flex-col rounded-[22px] bg-card px-[30px] pb-6 shadow-card transition-shadow",
          open
            ? "absolute inset-x-0 top-0 z-30 shadow-[0_24px_48px_-16px_rgba(15,27,51,.35)]"
            : "h-full",
        )}
      >
        <div className="-mt-11 flex flex-col items-center">
          <Link
            href={`/students/${profile.id}`}
            className="rounded-full"
            aria-label={`לפרופיל של ${profile.full_name}`}
          >
            <PersonAvatar
              id={profile.id}
              name={profile.full_name}
              avatarPath={profile.avatar_url}
              online={student.online}
              className="size-[88px] border-[3px] border-primary bg-white text-2xl shadow-soft"
            />
          </Link>
          {match && (
            <span
              className={cn(
                "z-10 -mt-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white shadow-soft",
                matchTone(match.percent),
              )}
            >
              {match.percent}% התאמה
            </span>
          )}
          <h3 className="mt-3 text-[17px] font-extrabold">
            <Link href={`/students/${profile.id}`} className="hover:text-primary">
              {profile.full_name}
            </Link>
          </h3>
          <p className="text-[13px] text-foreground">{subtitle || "סטודנט/ית"}</p>
        </div>

        <p className="mt-5 text-[11px] text-muted-foreground">קורסים משותפים</p>
        <div className="mt-2 flex min-h-[26px] flex-wrap items-center gap-1.5">
          {courses.length === 0 ? (
            <span className="text-xs text-muted-foreground">אין קורסים משותפים</span>
          ) : (
            <>
              {courses.slice(0, MAX_COURSE_CHIPS).map((c) => (
                <span
                  key={c.id}
                  className="inline-flex h-[26px] max-w-[48%] items-center gap-1 rounded-full border border-success/40 bg-success-soft px-2.5 text-[11px] font-medium text-success-ink"
                >
                  <CheckIcon className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{c.name}</span>
                </span>
              ))}
              {courses.length > MAX_COURSE_CHIPS && (
                <span
                  className="flex size-[26px] items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-muted-foreground"
                  title={courses
                    .slice(MAX_COURSE_CHIPS)
                    .map((c) => c.name)
                    .join(", ")}
                >
                  +{courses.length - MAX_COURSE_CHIPS}
                </span>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mt-4 flex items-center justify-between border-y border-divider py-3.5 text-[13px] font-bold"
        >
          {open ? "הסתרת פרטים" : "פרטים נוספים"}
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {open ? (
          <div className="flex flex-col gap-4 pt-4">
            {details.sharedExtras.length > 0 && (
              <div className="rounded-[14px] bg-success-soft px-4 py-3">
                <p className="text-[13px] font-bold text-success-ink">עוד דברים משותפים לכם</p>
                <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                  {details.sharedExtras.map((x) => (
                    <li
                      key={x}
                      className="flex items-center gap-1 text-[13px] font-semibold text-success-ink"
                    >
                      <CheckIcon className="size-3.5" aria-hidden />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="flex flex-col gap-3">
              {studies && <DetailRow icon={GraduationCapIcon} label="לימודים" value={studies} />}
              {details.studyTimes.length > 0 && (
                <DetailRow icon={ClockIcon} label="זמינות" value={list(details.studyTimes)} />
              )}
              {details.learningStyles.length > 0 && (
                <DetailRow
                  icon={BookOpenIcon}
                  label="דרכי למידה"
                  value={list(details.learningStyles)}
                />
              )}
              {details.hobbies.length > 0 && (
                <DetailRow icon={HeartIcon} label="תחביבים" value={list(details.hobbies)} />
              )}
              {!studies &&
                details.studyTimes.length === 0 &&
                details.learningStyles.length === 0 &&
                details.hobbies.length === 0 && (
                  <li className="text-[13px] text-muted-foreground">עוד לא מילא/ה פרטים נוספים</li>
                )}
            </ul>
          </div>
        ) : (
          <div className="mt-auto flex items-center gap-2.5 pt-6">
            {courses.length > 0 ? (
              <InviteStudentButton
                compact
                inviteeId={profile.id}
                inviteeName={profile.full_name}
                sharedCourses={courses}
                className="grow"
                buttonClassName="h-[38px] w-full rounded-full border-0 bg-primary text-[13px] font-bold text-white hover:bg-primary-strong"
              />
            ) : (
              <span
                className="flex h-[38px] grow items-center justify-center rounded-full bg-surface-2 text-[12px] text-muted-foreground"
                title="אפשר להזמין רק סטודנטים שרשומים איתך לאותו קורס"
              >
                אין קורס משותף להזמנה
              </span>
            )}
            <Link
              href={`/students/${profile.id}`}
              aria-label={`הפרופיל של ${profile.full_name}`}
              title="לפרופיל"
              className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-primary hover:bg-primary-soft"
            >
              <MessageSquareTextIcon className="size-[18px]" aria-hidden />
            </Link>
            <Link
              href={`/students/${profile.id}#invite`}
              aria-label={`הזמנה של ${profile.full_name} לפי קורס`}
              title="הזמנה לפי קורס"
              className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-primary hover:bg-primary-soft"
            >
              <UserRoundPlusIcon className="size-[18px]" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
