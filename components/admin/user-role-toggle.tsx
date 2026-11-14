"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setUserRoleAction } from "@/lib/admin/actions";

// Grant / revoke Super Admin from the users list (CR 11.11.2026).
export function UserRoleToggle({
  userId,
  name,
  isSuperAdmin,
}: {
  userId: string;
  name: string;
  isSuperAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    const message = isSuperAdmin
      ? `להסיר את הרשאת האדמין של ${name}? הגישה לפאנל הניהול תיחסם.`
      : `להפוך את ${name} לאדמין? תהיה לו/ה גישה מלאה לפאנל הניהול (משתמשים, קטלוג, חדרים, AI ושימוש). אדמין לא מופיע/ה ברשימות הסטודנטים ולא ניתן להזמין אותו/ה לחדרים.`;
    if (!confirm(message)) return;
    startTransition(async () => {
      const result = await setUserRoleAction(userId, isSuperAdmin ? "student" : "super_admin");
      if (!result.ok) toast.error(result.error ?? "הפעולה נכשלה");
      else toast.success(isSuperAdmin ? `${name} כבר לא אדמין` : `${name} הוגדר/ה כאדמין`);
    });
  }

  return (
    <Button
      variant={isSuperAdmin ? "quiet" : "outline-primary"}
      size="xs"
      className="h-8 px-3"
      disabled={pending}
      onClick={toggle}
    >
      {isSuperAdmin ? "הסרת אדמין" : "הפיכה לאדמין"}
    </Button>
  );
}
