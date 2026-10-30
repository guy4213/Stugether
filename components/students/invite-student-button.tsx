"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteToStudy } from "@/lib/rooms/actions";

// "הזמנה ללמידה" from a student's profile / card. An invitation belongs to a
// room of a course both students are enrolled in, so the button needs a
// shared course; with several, the student picks one.
export function InviteStudentButton({
  inviteeId,
  inviteeName,
  sharedCourses,
  className,
  compact = false,
  buttonClassName,
}: {
  inviteeId: string;
  inviteeName: string;
  sharedCourses: { id: string; name: string }[];
  className?: string;
  /** Small outline button for cards; invites to the first shared course. */
  compact?: boolean;
  /** Restyles the button itself (student cards). */
  buttonClassName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [courseId, setCourseId] = useState(sharedCourses[0]?.id ?? "");

  if (sharedCourses.length === 0 && compact) return null;
  if (sharedCourses.length === 0) {
    return (
      <div className={className}>
        <Button type="button" variant="brand" size="xl" className="w-full" disabled>
          הזמנה ללמידה
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          אפשר להזמין רק סטודנטים שרשומים איתך לאותו קורס
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {sharedCourses.length > 1 && !compact && (
        <Select value={courseId} onValueChange={(v) => v && setCourseId(v)}>
          <SelectTrigger
            aria-label="קורס ללמידה משותפת"
            className="mb-2.5 h-11 w-full rounded-[14px] bg-white"
          >
            <SelectValue placeholder="בחר/י קורס">
              {sharedCourses.find((c) => c.id === courseId)?.name ?? "בחר/י קורס"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sharedCourses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        type="button"
        variant={compact ? "outline-primary" : "brand"}
        size={compact ? "md" : "xl"}
        className={buttonClassName ?? "w-full"}
        disabled={pending || sent || !courseId}
        onClick={() =>
          startTransition(async () => {
            const result = await inviteToStudy(courseId, inviteeId, null);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setSent(true);
            toast.success(`נשלחה הזמנה ל${inviteeName}`);
          })
        }
      >
        {sent ? "ההזמנה נשלחה" : pending ? "שולח..." : "הזמנה ללמידה"}
      </Button>
    </div>
  );
}
