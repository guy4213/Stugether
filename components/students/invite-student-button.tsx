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

// "הזמן ללמידה" from a student's profile / card. An invitation belongs to a
// room of a course both students are enrolled in, so the button needs a
// shared course; with several, the student picks one.
export function InviteStudentButton({
  inviteeId,
  inviteeName,
  sharedCourses,
  className,
}: {
  inviteeId: string;
  inviteeName: string;
  sharedCourses: { id: string; name: string }[];
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [courseId, setCourseId] = useState(sharedCourses[0]?.id ?? "");

  if (sharedCourses.length === 0) {
    return (
      <div className={className}>
        <Button type="button" variant="brand" size="xl" className="w-full" disabled>
          הזמן ללמידה
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          אפשר להזמין רק סטודנטים שרשומים איתך לאותו קורס
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {sharedCourses.length > 1 && (
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
        variant="brand"
        size="xl"
        className="w-full"
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
        {sent ? "ההזמנה נשלחה" : pending ? "שולח..." : "הזמן ללמידה"}
      </Button>
    </div>
  );
}
