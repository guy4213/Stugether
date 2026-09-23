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

export function AddTestForm({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addTestForCourse(
        courseId,
        title,
        dueAt ? new Date(dueAt).toISOString() : "",
      );
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      setOpen(false);
      setTitle("");
      setDueAt("");
      toast.success("המבחן נוסף");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PlusIcon data-icon="inline-start" />
          הוספת מבחן
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת מבחן לקורס</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="שם המבחן"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          <DialogFooter>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? "מוסיף..." : "הוסף"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
