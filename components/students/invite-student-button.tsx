"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleCheckIcon,
  DoorOpenIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  previewStudyInvite,
  sendStudyInvite,
  type StudyInviteTarget,
} from "@/lib/rooms/study-invite-actions";
import { filterPeople } from "@/lib/ui/people";

type Course = { id: string; name: string };

const SEARCH_FROM = 6;

// "הזמנה ללמידה" (client QA 11.2026): a dialog instead of a menu that sent the
// invitation on pick. 1. choose the course (shared ones first; any other
// course of mine works too — accepting enrolls the invitee, Change Request
// 07.11.2026), 2. see which room it goes to (an existing room of mine, or a
// new one), 3. confirm. After sending: a link to the room.
export function InviteStudentButton({
  inviteeId,
  inviteeName,
  sharedCourses,
  myCourses = [],
  presetCourseId,
  topicTitle = null,
  className,
  compact = false,
  buttonClassName,
}: {
  inviteeId: string;
  inviteeName: string;
  sharedCourses: Course[];
  /** All my active courses (shared ones included; they are de-duplicated). */
  myCourses?: Course[];
  /** The course page: the course is already known. */
  presetCourseId?: string;
  /** Names a new room after the syllabus topic (course page). */
  topicTitle?: string | null;
  className?: string;
  /** Card-sized trigger. */
  compact?: boolean;
  /** Restyles the trigger itself (student cards). */
  buttonClassName?: string;
}) {
  const sharedIds = new Set(sharedCourses.map((c) => c.id));
  const otherCourses = myCourses.filter((c) => !sharedIds.has(c.id));
  const all = [...sharedCourses, ...otherCourses];

  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState<string>(
    presetCourseId ?? (all.length === 1 ? all[0].id : ""),
  );
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<{ roomId: string; roomName: string } | null>(null);
  const [pending, startTransition] = useTransition();
  // Bumped on every open, so the room is checked again (it may have filled).
  const [openCount, setOpenCount] = useState(0);
  const previewKey = `${courseId}:${openCount}`;
  const [preview, setPreview] = useState<{
    key: string;
    target: StudyInviteTarget | null;
  } | null>(null);
  const target = preview?.key === previewKey ? preview.target : null;
  const loadingTarget = !!courseId && preview?.key !== previewKey;

  // Where would it go? Asked again whenever the course changes.
  useEffect(() => {
    if (!open || !courseId || sent) return;
    let cancelled = false;
    previewStudyInvite(courseId, inviteeId, topicTitle).then((r) => {
      if (cancelled) return;
      setPreview({ key: previewKey, target: r.ok ? (r.target ?? null) : null });
      if (!r.ok) toast.error(r.error ?? "לא ניתן לטעון את פרטי ההזמנה");
    });
    return () => {
      cancelled = true;
    };
  }, [open, courseId, inviteeId, topicTitle, sent, previewKey]);

  function send() {
    startTransition(async () => {
      const r = await sendStudyInvite(courseId, inviteeId, topicTitle);
      if (!r.ok || !r.roomId) {
        toast.error(r.error ?? "לא ניתן לשלוח הזמנה");
        return;
      }
      setSent({ roomId: r.roomId, roomName: r.roomName ?? "" });
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // A fresh start next time (unless it was sent: the trigger says so).
      setQuery("");
      if (!presetCourseId && all.length !== 1) setCourseId("");
    }
  }

  const shownShared = filterPeople(sharedCourses, query, (c) => [c.name]);
  const shownOther = filterPeople(otherCourses, query, (c) => [c.name]);
  const picked = all.find((c) => c.id === courseId);

  return (
    <div className={className}>
      <Button
        type="button"
        variant={compact ? "outline-primary" : "brand"}
        size={compact ? "md" : "xl"}
        className={buttonClassName ?? "w-full"}
        onClick={() => {
          setOpenCount((n) => n + 1);
          setOpen(true);
        }}
      >
        {sent ? "ההזמנה נשלחה ✓" : "הזמנה ללמידה"}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-[24px] p-6 sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">
              {sent ? "ההזמנה נשלחה" : `הזמנת ${inviteeName} ללמידה`}
            </DialogTitle>
            <DialogDescription>
              {sent
                ? `${inviteeName} יקבל/תקבל התראה ויוכל/תוכל להצטרף לחדר. אפשר כבר להתחיל ללמוד.`
                : "בוחרים קורס, רואים לאיזה חדר תישלח ההזמנה, ושולחים."}
            </DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 rounded-[14px] bg-success-soft px-4 py-3 text-sm font-semibold text-success-ink">
                <CircleCheckIcon className="size-5 shrink-0" aria-hidden />
                נשלחה הזמנה לחדר „{sent.roomName}“
              </p>
              <Button asChild variant="brand" size="xl" className="w-full">
                <Link href={`/rooms/${sent.roomId}`}>
                  לחדר
                  <ArrowLeftIcon />
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                סגירה
              </Button>
            </div>
          ) : all.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="rounded-[14px] bg-surface-2 px-4 py-3 text-sm">
                כדי להזמין ללמידה צריך להירשם לפחות לקורס אחד.
              </p>
              <Button asChild variant="brand" size="xl" className="w-full">
                <Link href="/courses">למציאת קורס</Link>
              </Button>
            </div>
          ) : (
            <>
              {!presetCourseId && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-bold">1. באיזה קורס?</legend>
                  {all.length >= SEARCH_FROM && (
                    <label className="flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-primary-line">
                      <SearchIcon className="size-4 shrink-0" aria-hidden />
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="חיפוש קורס"
                        aria-label="חיפוש קורס"
                        className="min-w-0 grow bg-transparent text-sm text-foreground outline-none"
                      />
                    </label>
                  )}
                  <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
                    {shownShared.map((c) => (
                      <CourseOption
                        key={c.id}
                        course={c}
                        selected={c.id === courseId}
                        onSelect={() => setCourseId(c.id)}
                        note="קורס משותף"
                        shared
                      />
                    ))}
                    {shownOther.map((c) => (
                      <CourseOption
                        key={c.id}
                        course={c}
                        selected={c.id === courseId}
                        onSelect={() => setCourseId(c.id)}
                        note={`${inviteeName} יירשם/תירשם לקורס בעת האישור`}
                      />
                    ))}
                    {shownShared.length + shownOther.length === 0 && (
                      <p className="py-3 text-center text-sm text-muted-foreground">
                        לא נמצא קורס כזה
                      </p>
                    )}
                  </div>
                </fieldset>
              )}

              {picked && (
                <section aria-live="polite" className="flex flex-col gap-2">
                  {!presetCourseId && <p className="text-sm font-bold">2. לאיזה חדר?</p>}
                  <div className="flex items-center gap-3 rounded-[14px] border border-primary-line bg-primary-tint px-4 py-3 text-sm">
                    {loadingTarget ? (
                      <>
                        <Loader2Icon className="size-5 shrink-0 animate-spin text-primary" />
                        בודקים לאיזה חדר תישלח ההזמנה…
                      </>
                    ) : !target ? (
                      <span>לא הצלחנו לבדוק את החדר. סגרו ופתחו שוב כדי לנסות שוב.</span>
                    ) : target.kind === "existing" ? (
                      <>
                        <DoorOpenIcon className="size-5 shrink-0 text-primary" aria-hidden />
                        <span>
                          ההזמנה תישלח לחדר שלך <b>„{target.roomName}“</b>
                        </span>
                      </>
                    ) : (
                      <>
                        <PlusIcon className="size-5 shrink-0 text-primary" aria-hidden />
                        <span>
                          ייפתח חדר חדש <b>„{target.roomName}“</b> וההזמנה תישלח אליו
                        </span>
                      </>
                    )}
                  </div>
                </section>
              )}

              <Button
                type="button"
                variant="brand"
                size="xl"
                className="w-full"
                disabled={!picked || !target || loadingTarget || pending}
                onClick={send}
              >
                {pending ? "שולחים…" : picked ? `שליחת הזמנה ל${inviteeName}` : "בחרו קורס"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourseOption({
  course,
  selected,
  onSelect,
  note,
  shared = false,
}: {
  course: Course;
  selected: boolean;
  onSelect: () => void;
  note: string;
  shared?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-[14px] border-[1.5px] px-3.5 py-2.5 text-start transition-colors",
        selected
          ? "border-primary bg-primary-soft"
          : "border-border bg-white hover:border-primary-line",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary bg-primary text-white" : "border-switch-off",
        )}
      >
        {selected && <CheckIcon className="size-3" strokeWidth={3} aria-hidden />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{course.name}</span>
        <span className={cn("text-xs", shared ? "text-success-ink" : "text-muted-foreground")}>
          {note}
        </span>
      </span>
    </button>
  );
}
