"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  EllipsisIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  Trash2Icon,
  UndoIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { CreateRoomForm } from "@/components/courses/create-room-form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleFavorite } from "@/lib/favorites/actions";
import { enrollInCourse, setCourseCompleted, unenrollFromCourse } from "@/lib/courses/actions";
import type { CourseCardData } from "@/lib/courses/queries";

type Card = Omit<CourseCardData, "course" | "examSortKey">;

function Badge({ card }: { card: Card }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-medium before:size-1.5 before:rounded-full before:bg-current";
  if (card.completed) return <span className={cn(base, "bg-[#f2f2f5] text-[#737885]")}>הושלם</span>;
  if (card.examInDays !== null) {
    const when =
      card.examInDays === 0
        ? "מבחן היום"
        : card.examInDays === 1
          ? "מבחן מחר"
          : `מבחן בעוד ${card.examInDays} ימים`;
    return <span className={cn(base, "bg-[#fff2db] text-[#bf7305]")}>{when}</span>;
  }
  if (card.rooms > 0) {
    return (
      <span className={cn(base, "bg-[#e0f7e8] text-[#0d9952]")}>
        {card.rooms === 1 ? "חדר לימוד פעיל" : `${card.rooms} חדרי לימוד פעילים`}
      </span>
    );
  }
  return null;
}

// "שותפים ללמידה": classmates of my course, on hover / focus.
function Students({ card }: { card: Card }) {
  const text = card.students === 1 ? "סטודנט אחד בקורס" : `${card.students} סטודנטים בקורס`;
  const hasTooltip = card.partners.length > 0;
  return (
    <div
      tabIndex={hasTooltip ? 0 : undefined}
      className="group relative flex items-center gap-1.5 rounded-md text-[13px] text-[#737885] outline-none focus-visible:ring-2 focus-visible:ring-primary-line"
    >
      <UsersIcon className="size-[15px]" strokeWidth={1.8} aria-hidden />
      {text}
      {hasTooltip && (
        <div
          role="tooltip"
          className="invisible absolute bottom-[calc(100%+10px)] left-1/2 z-10 w-max min-w-[120px] -translate-x-1/2 translate-y-1 rounded-[10px] bg-[#1c1f26] px-3 pt-2 pb-2.5 text-center opacity-0 shadow-[0_4px_12px_rgba(0,0,0,.18)] transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:visible group-focus-visible:translate-y-0 group-focus-visible:opacity-100 after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-6 after:border-transparent after:border-t-[#1c1f26]"
        >
          <p className="text-[10px] font-semibold whitespace-nowrap text-white">שותפים ללמידה</p>
          <div className="mt-[7px] flex justify-center gap-1.5">
            {card.partners.map((p) => (
              <PersonAvatar
                key={p.id}
                id={p.id}
                name={p.name}
                avatarPath={p.avatarPath}
                className="size-5 text-[9px] ring-[1.5px] ring-[#1c1f26]"
              />
            ))}
          </div>
          <span className="sr-only">: {card.partners.map((p) => p.name).join(", ")}</span>
        </div>
      )}
    </div>
  );
}

function CardMenu({ card, onOpenRoom }: { card: Card; onOpenRoom: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger
        aria-label={`פעולות לקורס ${card.name}`}
        disabled={pending}
        className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[#f2f4f7] text-[#6b7180] transition-colors hover:bg-[#e6eaf1] data-[state=open]:bg-[#e6eaf1]"
      >
        <EllipsisIcon className="size-[18px]" strokeWidth={2.6} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px] rounded-[14px] p-1.5">
        <DropdownMenuItem
          onSelect={() =>
            run(
              () => toggleFavorite(card.id, !card.pinned),
              card.pinned ? "הקורס כבר לא נעוץ" : "הקורס ננעץ למעלה",
            )
          }
        >
          {card.pinned ? <PinOffIcon /> : <PinIcon />}
          {card.pinned ? "ביטול נעיצה" : "נעיצה למעלה"}
        </DropdownMenuItem>
        {card.enrolled ? (
          <>
            <DropdownMenuItem onSelect={onOpenRoom}>
              <PlusIcon />
              פתיחת חדר לימוד
            </DropdownMenuItem>
            {!card.completed ? (
              <DropdownMenuItem
                onSelect={() => run(() => setCourseCompleted(card.id, true), "הקורס סומן כהושלם")}
              >
                <CheckIcon />
                סימון כהושלם
              </DropdownMenuItem>
            ) : (
              card.canUncomplete && (
                <DropdownMenuItem
                  onSelect={() =>
                    run(() => setCourseCompleted(card.id, false), "הסימון כהושלם בוטל")
                  }
                >
                  <UndoIcon />
                  ביטול הסימון כהושלם
                </DropdownMenuItem>
              )
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                if (!confirm(`להסיר את "${card.name}" מהקורסים שלך?`)) return;
                run(() => unenrollFromCourse(card.id), "הקורס הוסר מהקורסים שלך");
              }}
            >
              <Trash2Icon />
              הסרת הקורס
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={() => run(() => enrollInCourse(card.id), "נרשמת לקורס")}>
            <UserPlusIcon />
            הרשמה לקורס
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// A course card (Figma "כרטיסיות קורסים", 07.11.2026): name, code and year,
// progress in topics, classmates, a status badge and "כניסה לקורס".
export function CourseCard({ card }: { card: Card }) {
  const [roomOpen, setRoomOpen] = useState(false);
  const sub = [card.code, card.year ?? card.departmentName].filter(Boolean).join("  •  ");
  const p = card.progress;
  const done = card.completed;

  return (
    <article className="relative flex flex-col gap-[18px] rounded-[23px] bg-white p-6 shadow-[0_1.9px_9.6px_rgba(161,161,161,.25)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(120,140,170,.22)]">
      <div className="flex min-h-[53px] items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[22px] leading-tight font-bold">
            <Link href={`/courses/${card.id}`} className="hover:text-primary">
              {card.name}
            </Link>
          </h3>
          {sub && <p className="mt-0.5 text-[13px] whitespace-pre">{sub}</p>}
        </div>
        <CardMenu card={card} onOpenRoom={() => setRoomOpen(true)} />
      </div>

      {p ? (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-[14px] px-3.5 pt-3 pb-3.5",
            done ? "bg-[#e0f7e8]" : "bg-[#ecf1fe]",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium">{done ? "סיום הקורס" : "התקדמות בקורס"}</p>
              <p className="text-xs text-[#737885]">
                {p.total > 0 ? `${p.done} מתוך ${p.total} נושאים` : "עוד אין סילבוס לקורס"}
              </p>
            </div>
            <span className={cn("text-[22px] font-bold", done ? "text-[#0d9952]" : "text-primary")}>
              {done ? 100 : p.pct}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="התקדמות בקורס"
            aria-valuenow={done ? 100 : p.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className={cn("h-2 overflow-hidden rounded", done ? "bg-[#c7ebd4]" : "bg-[#d9e3fa]")}
          >
            <div
              className={cn("h-full rounded", done ? "bg-[#0d9952]" : "bg-primary")}
              style={{ width: `${done ? 100 : p.pct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 rounded-[14px] bg-[#f5f7fb] px-3.5 py-3">
          <p className="text-[13px] font-medium">עוד לא נרשמת לקורס</p>
          <p className="text-xs text-[#737885]">הירשמו כדי לעקוב אחרי ההתקדמות ולפתוח חדרי לימוד</p>
        </div>
      )}

      <div className="flex min-h-[22px] items-center justify-between gap-2">
        <Students card={card} />
        <Badge card={card} />
      </div>

      <Link
        href={`/courses/${card.id}`}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-primary bg-white text-[15px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
      >
        {done ? "חזרה לחומרים" : "כניסה לקורס"}
        <ArrowLeftIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
      </Link>

      {card.enrolled && (
        <CreateRoomForm
          courseId={card.id}
          trigger="none"
          open={roomOpen}
          onOpenChange={setRoomOpen}
        />
      )}
    </article>
  );
}
