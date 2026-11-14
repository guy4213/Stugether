"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ClockIcon,
  UserRoundCheckIcon,
  UserRoundPlusIcon,
  UserRoundXIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  removeFriendAction,
  respondFriendRequestAction,
  sendFriendRequestAction,
  type FriendActionResult,
} from "@/lib/friends/actions";
import type { MyFriendState } from "@/lib/friends/queries";
import type { FriendStatus } from "@/lib/repositories/friends";

const LOOK: Record<FriendStatus, { icon: LucideIcon; label: string; tone: string }> = {
  none: { icon: UserRoundPlusIcon, label: "הוספת חבר/ה", tone: "bg-surface-2 text-primary" },
  outgoing: { icon: ClockIcon, label: "הבקשה נשלחה", tone: "bg-warning-soft text-warning-ink" },
  incoming: {
    icon: UserRoundPlusIcon,
    label: "רוצה להיות חבר/ה שלך",
    tone: "bg-primary text-white",
  },
  friends: { icon: UserRoundCheckIcon, label: "חברים", tone: "bg-success-soft text-success-ink" },
};

// "הוספת חבר" (client QA 11.2026): request → the other student approves.
// `compact` is the 38px icon button of student cards; otherwise a labelled
// button (the student's profile page).
export function FriendButton({
  studentId,
  studentName,
  initial,
  compact = false,
  className,
}: {
  studentId: string;
  studentName: string;
  initial?: MyFriendState;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<MyFriendState>(
    initial ?? { status: "none", friendshipId: null },
  );
  const [pending, startTransition] = useTransition();
  const look = LOOK[state.status];

  function run(
    action: () => Promise<FriendActionResult>,
    success: (r: FriendActionResult) => string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      setState((s) => ({ ...s, status: result.status ?? s.status }));
      toast.success(success(result));
      router.refresh();
    });
  }

  const add = () =>
    run(
      () => sendFriendRequestAction(studentId),
      (r) =>
        r.status === "friends"
          ? `את/ה ו${studentName} חברים עכשיו`
          : `נשלחה בקשת חברות ל${studentName}`,
    );

  const trigger = (
    <span className="flex items-center gap-2">
      <look.icon className={compact ? "size-[18px]" : "size-4"} aria-hidden />
      {!compact && <span>{look.label}</span>}
    </span>
  );
  const buttonClass = cn(
    "flex shrink-0 items-center justify-center font-bold transition-[filter] hover:brightness-95 disabled:opacity-60",
    compact ? "size-[38px] rounded-[10px]" : "h-11 rounded-full px-5 text-sm",
    look.tone,
    className,
  );
  const aria = `${look.label}: ${studentName}`;

  if (state.status === "none") {
    return (
      <button
        type="button"
        onClick={add}
        disabled={pending}
        aria-label={compact ? `הוספת ${studentName} לחברים` : undefined}
        title={compact ? "הוספת חבר/ה" : undefined}
        className={buttonClass}
      >
        {trigger}
      </button>
    );
  }

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger
        disabled={pending}
        aria-label={compact ? aria : undefined}
        title={compact ? look.label : undefined}
        className={buttonClass}
      >
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {state.status === "friends"
            ? `את/ה ו${studentName} חברים`
            : state.status === "outgoing"
              ? `מחכים לאישור של ${studentName}`
              : `${studentName} רוצה להיות חבר/ה שלך`}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {state.status === "incoming" && state.friendshipId && (
          <>
            <DropdownMenuItem
              onSelect={() =>
                run(
                  () => respondFriendRequestAction(state.friendshipId!, true),
                  () => `את/ה ו${studentName} חברים עכשיו`,
                )
              }
            >
              <UserRoundCheckIcon />
              אישור החברות
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                run(
                  () => respondFriendRequestAction(state.friendshipId!, false),
                  () => "הבקשה נדחתה",
                )
              }
            >
              <UserRoundXIcon />
              דחייה
            </DropdownMenuItem>
          </>
        )}
        {state.status === "outgoing" && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              run(
                () => removeFriendAction(studentId),
                () => "הבקשה בוטלה",
              )
            }
          >
            <UserRoundXIcon />
            ביטול הבקשה
          </DropdownMenuItem>
        )}
        {state.status === "friends" && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              if (!confirm(`להסיר את ${studentName} מהחברים?`)) return;
              run(
                () => removeFriendAction(studentId),
                () => `${studentName} הוסר/ה מהחברים`,
              );
            }}
          >
            <UserRoundXIcon />
            הסרה מהחברים
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
