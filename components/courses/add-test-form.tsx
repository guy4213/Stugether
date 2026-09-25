"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { addTestForCourse } from "@/lib/courses/actions";
import type { EventKind } from "@/lib/repositories/tests";
import { EVENT_KIND_LABEL } from "@/lib/ui/labels";

// Adds a course event: a test, a workshop or a group study session.
export function AddTestForm({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<EventKind>("workshop");
  const [dueAt, setDueAt] = useState("");
  const [location, setLocation] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addTestForCourse(
        courseId,
        title,
        dueAt ? new Date(dueAt).toISOString() : "",
        kind,
        location,
      );
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      setOpen(false);
      setTitle("");
      setDueAt("");
      setLocation("");
      toast.success("האירוע נוסף וחברי הקורס קיבלו התראה");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="quiet" size="icon-md" aria-label="הוספת אירוע לקורס" className="rounded-[13px] text-primary-strong">
          <PlusIcon strokeWidth={2.4} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת אירוע לקורס</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2" role="radiogroup" aria-label="סוג האירוע">
            {(Object.keys(EVENT_KIND_LABEL) as EventKind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={
                  kind === k
                    ? "h-9 rounded-[10px] bg-primary px-3 text-[13px] font-semibold text-white"
                    : "h-9 rounded-[10px] border border-border bg-white px-3 text-[13px] font-semibold text-ink-2"
                }
              >
                {EVENT_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <Input
            placeholder="כותרת (למשל: סדנת לופיטל)"
            aria-label="כותרת"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />
          <Input
            type="datetime-local"
            aria-label="מועד"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            required
          />
          <Input
            placeholder="מיקום (לא חובה)"
            aria-label="מיקום"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={200}
          />
          <DialogFooter>
            <Button type="submit" variant="brand" size="md" disabled={isPending || !title.trim() || !dueAt}>
              {isPending ? "מוסיף..." : "הוספה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
