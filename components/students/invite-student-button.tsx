"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteToStudy } from "@/lib/rooms/actions";

type Course = { id: string; name: string };

// "הזמנה ללמידה" from a student's profile / card. An invitation belongs to a
// room of one of my courses. A shared course comes first; any other course
// of mine works too (Change Request 07.11.2026): accepting enrolls the
// invitee in it.
export function InviteStudentButton({
  inviteeId,
  inviteeName,
  sharedCourses,
  myCourses = [],
  className,
  compact = false,
  buttonClassName,
}: {
  inviteeId: string;
  inviteeName: string;
  sharedCourses: Course[];
  /** All my active courses (shared ones included; they are de-duplicated). */
  myCourses?: Course[];
  className?: string;
  /** Card button: one course invites right away, several open a menu. */
  compact?: boolean;
  /** Restyles the button itself (student cards). */
  buttonClassName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const sharedIds = new Set(sharedCourses.map((c) => c.id));
  const otherCourses = myCourses.filter((c) => !sharedIds.has(c.id));
  const all = [...sharedCourses, ...otherCourses];
  const [courseId, setCourseId] = useState(all[0]?.id ?? "");

  function invite(id: string) {
    startTransition(async () => {
      const result = await inviteToStudy(id, inviteeId, null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSent(true);
      toast.success(`נשלחה הזמנה ל${inviteeName}`);
    });
  }

  const label = sent ? "ההזמנה נשלחה" : pending ? "שולח..." : "הזמנה ללמידה";

  if (all.length === 0) {
    return (
      <div className={className}>
        <Button
          type="button"
          variant={compact ? "outline-primary" : "brand"}
          size={compact ? "md" : "xl"}
          className={buttonClassName ?? "w-full"}
          disabled
          title="כדי להזמין ללמידה צריך להירשם לפחות לקורס אחד"
        >
          הזמנה ללמידה
        </Button>
        {!compact && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            כדי להזמין ללמידה צריך להירשם לפחות לקורס אחד
          </p>
        )}
      </div>
    );
  }

  if (compact) {
    if (all.length === 1) {
      return (
        <div className={className}>
          <Button
            type="button"
            variant="outline-primary"
            size="md"
            className={buttonClassName}
            disabled={pending || sent}
            onClick={() => invite(all[0].id)}
          >
            {label}
          </Button>
        </div>
      );
    }
    return (
      <div className={className}>
        <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild disabled={pending || sent}>
            <Button type="button" variant="outline-primary" size="md" className={buttonClassName}>
              {label}
              {!sent && !pending && <ChevronDownIcon className="size-4" aria-hidden />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="max-h-80 w-60 overflow-y-auto">
            <CourseMenuGroup title="קורסים משותפים" courses={sharedCourses} onPick={invite} />
            {sharedCourses.length > 0 && otherCourses.length > 0 && <DropdownMenuSeparator />}
            <CourseMenuGroup
              title={`הקורסים שלי (${inviteeName} יירשם/תירשם בעת האישור)`}
              courses={otherCourses}
              onPick={invite}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  const pickedIsShared = sharedIds.has(courseId);
  return (
    <div className={className}>
      {all.length > 1 && (
        <Select value={courseId} onValueChange={(v) => v && setCourseId(v)}>
          <SelectTrigger
            aria-label="קורס ללמידה משותפת"
            className="mb-2.5 h-11 w-full rounded-[14px] bg-white"
          >
            <SelectValue placeholder="בחר/י קורס">
              {all.find((c) => c.id === courseId)?.name ?? "בחר/י קורס"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sharedCourses.length > 0 && (
              <SelectGroup>
                <SelectLabel>קורסים משותפים</SelectLabel>
                {sharedCourses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {otherCourses.length > 0 && (
              <SelectGroup>
                <SelectLabel>הקורסים שלי</SelectLabel>
                {otherCourses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      )}
      <Button
        type="button"
        variant="brand"
        size="xl"
        className={buttonClassName ?? "w-full"}
        disabled={pending || sent || !courseId}
        onClick={() => invite(courseId)}
      >
        {label}
      </Button>
      {!pickedIsShared && courseId && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {inviteeName} לא רשום/ה לקורס הזה — באישור ההזמנה יירשם/תירשם אליו אוטומטית
        </p>
      )}
    </div>
  );
}

function CourseMenuGroup({
  title,
  courses,
  onPick,
}: {
  title: string;
  courses: Course[];
  onPick: (id: string) => void;
}) {
  if (courses.length === 0) return null;
  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {title}
      </DropdownMenuLabel>
      {courses.map((c) => (
        <DropdownMenuItem key={c.id} onSelect={() => onPick(c.id)}>
          <span className="truncate">{c.name}</span>
        </DropdownMenuItem>
      ))}
    </>
  );
}
