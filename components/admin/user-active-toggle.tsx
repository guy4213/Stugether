"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setUserActiveAction } from "@/lib/admin/actions";

export function UserActiveToggle({
  userId,
  name,
  isActive,
}: {
  userId: string;
  name: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !isActive;
    if (
      !next &&
      !confirm(`להשבית את ${name}? המשתמש/ת יוצא/ת מכל החדרים וההזמנות שלו/ה מבוטלות.`)
    ) {
      return;
    }
    startTransition(async () => {
      const result = await setUserActiveAction(userId, next);
      if (!result.ok) toast.error(result.error ?? "הפעולה נכשלה");
      else toast.success(next ? `${name} הופעל/ה` : `${name} הושבת/ה`);
    });
  }

  return (
    <Button
      variant={isActive ? "quiet" : "outline-primary"}
      size="xs"
      className="h-8 px-3"
      disabled={pending}
      onClick={toggle}
    >
      {isActive ? "השבתה" : "הפעלה"}
    </Button>
  );
}
