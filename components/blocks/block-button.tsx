"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { blockUserAction, unblockUserAction } from "@/lib/blocks/actions";

// "חסימה" (client QA 14.11.2026): a student who bothers me can't message me
// or send me a friend request, and we no longer see each other in lists.
// Blocking asks for a confirmation; lifting it does not.
export function BlockButton({
  studentId,
  studentName,
  blocked,
  className,
  compact = false,
  onChange,
}: {
  studentId: string;
  studentName: string;
  /** I already blocked this student. */
  blocked: boolean;
  className?: string;
  /** A round icon button (the chat header). */
  compact?: boolean;
  /** After a change (the chat swaps its composer); otherwise the page refreshes. */
  onChange?: (blocked: boolean) => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(block: boolean) {
    startTransition(async () => {
      const r = block ? await blockUserAction(studentId) : await unblockUserAction(studentId);
      if (!r.ok) {
        toast.error(r.error ?? "משהו השתבש");
        return;
      }
      setConfirming(false);
      toast.success(block ? `${studentName} נחסם/ה` : `החסימה של ${studentName} בוטלה`);
      onChange?.(block);
      router.refresh();
    });
  }

  if (blocked && compact) {
    return (
      <button
        type="button"
        onClick={() => run(false)}
        disabled={pending}
        aria-label={`ביטול החסימה של ${studentName}`}
        title="ביטול חסימה"
        className={className}
      >
        <ShieldCheckIcon className="size-[18px]" aria-hidden />
      </button>
    );
  }

  if (blocked) {
    return (
      <Button
        type="button"
        variant="outline"
        className={className}
        disabled={pending}
        onClick={() => run(false)}
      >
        <ShieldCheckIcon aria-hidden />
        {pending ? "מבטלים…" : "ביטול חסימה"}
      </Button>
    );
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`חסימת ${studentName}`}
          title="חסימה"
          className={className}
        >
          <BanIcon className="size-[18px]" aria-hidden />
        </button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className={cn("text-destructive hover:text-destructive", className)}
          onClick={() => setConfirming(true)}
        >
          <BanIcon aria-hidden />
          חסימה
        </Button>
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="gap-4 rounded-[24px] p-6 sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">לחסום את {studentName}?</DialogTitle>
            <DialogDescription asChild>
              <ul className="flex list-disc flex-col gap-1 ps-5 text-start">
                <li>לא תוכלו לשלוח הודעות פרטיות זה לזה</li>
                <li>לא תוכלו לשלוח בקשת חברות, וחברות קיימת תוסר</li>
                <li>לא תופיעו זה לזה ברשימות הסטודנטים</li>
                <li>{studentName} לא יקבל/תקבל הודעה על החסימה. אפשר לבטל אותה בפרופיל שלך</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => run(true)}
            >
              {pending ? "חוסמים…" : "חסימה"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
