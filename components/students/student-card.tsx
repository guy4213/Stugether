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
} from "lucide-react";
import { cn } from "cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { LastSeen } from "@/components/ui/last-seen";
import { InviteStudentButton } from "@/components/students/invite-student-button";
import { MessageStudentButton } from "@/components/messages/message-student-button";
import { FriendButton } from "@/components/friends/friend-button";
import type { MyFriendState } from "@/lib/friends/queries";
import { yearLabel } from "@/lib/ui/labels";
import { MATCH_SOLID, matchLevel } from "@/lib/ui/tones";
import type { StudentCard as StudentCardData } from "@/lib/students/queries";

const MAX_COURSE_CHIPS = 2;

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
// shared courses, and "פרטים נוספים" expanding the card in place — it used to
// open over the card below it (client QA 11.2026).
export function StudentCard({
  student,
  myCourses,
  friend,
}: {
  student: StudentCardData;
  /** My active courses: "הזמנה ללמידה" works without a shared course too. */
  myCourses: { id: string; name: string }[];
  friend?: MyFriendState;
}) {
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
          "flex h-full flex-col rounded-[22px] bg-card px-[30px] pb-6 shadow-card transition-shadow",
          open && "shadow-[0_24px_48px_-16px_rgba(15,27,51,.35)]",
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
                MATCH_SOLID[matchLevel(match.percent)],
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
          <LastSeen online={student.online} lastSeenAt={profile.last_seen_at} className="mt-1" />
        </div>

        <p className="mt-5 text-[11px] text-muted-foreground">קורסים משותפים</p>
        <div className="mt-2 flex min-h-[26px] flex-wrap items-center gap-1.5">
          {courses.length === 0 ? (
            <span className="text-xs text-muted-foreground">אין קורסים משותפים</span>
          ) : (
            <>
              {courses.slice(0, MAX_COURSE_CHIPS).map((c) => (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}`}
                  title={`לעמוד הקורס ${c.name}`}
                  className="inline-flex min-h-[26px] max-w-full items-center gap-1 rounded-[13px] border border-success/40 bg-success-soft px-2.5 py-1 text-[11px] leading-tight font-medium text-success-ink hover:border-success"
                >
                  <CheckIcon className="size-3 shrink-0" aria-hidden />
                  <span className="underline underline-offset-2">{c.name}</span>
                </Link>
              ))}
              {courses.length > MAX_COURSE_CHIPS && (
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label={`עוד ${courses.length - MAX_COURSE_CHIPS} קורסים משותפים`}
                  className="flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-surface-2 px-1.5 text-[10px] font-semibold text-muted-foreground hover:bg-primary-soft"
                >
                  +{courses.length - MAX_COURSE_CHIPS}
                </button>
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

        {open && (
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
              {courses.length > MAX_COURSE_CHIPS && (
                <DetailRow icon={CheckIcon} label="כל הקורסים המשותפים" value={list(courses)} />
              )}
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
        )}
        {/* RTL: the icons sit at the start (right), "הזמנה ללמידה" at the end (left). */}
        <div className="mt-auto flex items-center gap-2.5 pt-6">
          <FriendButton
            compact
            studentId={profile.id}
            studentName={profile.full_name}
            initial={friend}
          />
          <MessageStudentButton compact studentId={profile.id} studentName={profile.full_name} />
          <InviteStudentButton
            compact
            inviteeId={profile.id}
            inviteeName={profile.full_name}
            sharedCourses={courses}
            myCourses={myCourses}
            className="min-w-0 grow"
            buttonClassName="h-[38px] w-full rounded-full border-0 bg-primary text-[13px] font-bold text-white hover:bg-primary-strong"
          />
        </div>
      </div>
    </article>
  );
}
