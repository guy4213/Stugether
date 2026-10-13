"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DoorOpenIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { decideJoinRequestAction } from "@/lib/rooms/actions";

// Room creator only: classmates asking to join while the room is in session.
export function JoinRequestsBanner({
  requests,
}: {
  requests: { id: string; userId: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (requests.length === 0) return null;

  const decide = (id: string, approve: boolean) =>
    startTransition(async () => {
      const result = await decideJoinRequestAction(id, approve);
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      toast.success(approve ? "אושרה הכניסה לחדר" : "הבקשה נדחתה");
      router.refresh();
    });

  return (
    <section
      aria-label="בקשות הצטרפות"
      className="mx-3 mb-3 flex flex-col gap-2 rounded-[18px] border border-warning/40 bg-warning-soft p-3 sm:mx-0"
    >
      <p className="flex items-center gap-2 text-sm font-bold text-warning-ink">
        <DoorOpenIcon className="size-4" aria-hidden />
        {requests.length === 1
          ? "סטודנט/ית מבקש/ת להצטרף למפגש"
          : `${requests.length} סטודנטים מבקשים להצטרף למפגש`}
      </p>
      <ul className="flex flex-col gap-2">
        {requests.map((q) => (
          <li key={q.id} className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2">
            <PersonAvatar id={q.userId} name={q.name} className="size-8 text-xs" />
            <span className="grow truncate text-sm font-semibold">{q.name}</span>
            <Button
              size="chip"
              variant="outline-primary"
              disabled={pending}
              onClick={() => decide(q.id, true)}
            >
              אישור
            </Button>
            <Button
              size="chip"
              variant="quiet"
              disabled={pending}
              onClick={() => decide(q.id, false)}
            >
              דחייה
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
