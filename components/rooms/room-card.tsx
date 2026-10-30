"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, BellIcon, ClockIcon, TargetIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { JoinRoomButton } from "@/components/rooms/join-room-button";
import { watchRoomSeatAction } from "@/lib/rooms/actions";
import { rsvpSessionAction } from "@/lib/rooms/session-actions";
import { relativeTimeHe, timeHe } from "@/lib/ui/format";
import type { RoomCardData } from "@/lib/rooms/directory-queries";

const PRIMARY_BTN =
  "inline-flex h-[42px] items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold transition-colors disabled:opacity-60";

function StatusPill({ room }: { room: RoomCardData }) {
  const base = "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold";
  switch (room.status) {
    case "live":
      return (
        <span className={cn(base, "bg-success-soft text-success-ink")}>
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          פעיל
        </span>
      );
    case "full":
      return (
        <span className={cn(base, "bg-surface-2 text-muted-foreground")}>
          <span className="size-1.5 rounded-full bg-muted-foreground" aria-hidden />
          החדר מלא
        </span>
      );
    case "upcoming":
      return (
        <span className={cn(base, "px-0 text-primary")}>
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          מתחיל ב-{timeHe(room.session!.startsAt)}
        </span>
      );
    case "waiting":
      return (
        <span className={cn(base, "bg-warning-soft text-warning-ink")}>
          <span className="size-1.5 rounded-full bg-warning" aria-hidden />
          ממתין למשתתפים
        </span>
      );
    default:
      return null;
  }
}

function RoomAction({ room }: { room: RoomCardData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [watching, setWatching] = useState(room.watching);
  const [rsvp, setRsvp] = useState(room.session?.myRsvp ?? null);

  if (!room.isMember) {
    if (room.status === "full") {
      return (
        <button
          type="button"
          disabled={pending}
          aria-pressed={watching}
          onClick={() =>
            startTransition(async () => {
              const result = await watchRoomSeatAction(room.id, !watching);
              if (!result.ok) {
                toast.error(result.error ?? "משהו השתבש");
                return;
              }
              setWatching(!watching);
              toast.success(watching ? "לא נעדכן עוד על החדר הזה" : "נעדכן אותך כשיתפנה מקום");
            })
          }
          className={cn(
            PRIMARY_BTN,
            watching
              ? "border-[1.5px] border-success bg-success-soft text-success-ink"
              : "border-[1.5px] border-primary bg-white text-primary hover:bg-primary-soft",
          )}
        >
          <BellIcon className="size-4" aria-hidden />
          {watching ? "נעדכן כשמתפנה" : "עדכנו כשמתפנה"}
        </button>
      );
    }
    return (
      <JoinRoomButton
        roomId={room.id}
        live={room.live}
        requested={room.requested}
        className={cn(PRIMARY_BTN, "bg-primary text-white hover:bg-primary-strong")}
      >
        כניסה לחדר
        <ArrowLeftIcon className="size-4" aria-hidden />
      </JoinRoomButton>
    );
  }

  // My room with a session coming up (not in session yet): "רישום תזכורת".
  if (room.session && !room.live) {
    const coming = rsvp === "accepted";
    return (
      <button
        type="button"
        disabled={pending}
        aria-pressed={coming}
        onClick={() =>
          startTransition(async () => {
            const next = coming ? "declined" : "accepted";
            const result = await rsvpSessionAction(room.id, room.session!.id, next);
            if (!result.ok) {
              toast.error(result.error ?? "משהו השתבש");
              return;
            }
            setRsvp(next);
            toast.success(coming ? "ביטלת את ההרשמה למפגש" : "נרשמת למפגש");
            router.refresh();
          })
        }
        className={cn(
          PRIMARY_BTN,
          coming
            ? "border-[1.5px] border-success bg-success-soft text-success-ink"
            : "border-[1.5px] border-primary bg-white text-primary hover:bg-primary-soft",
        )}
      >
        <BellIcon className="size-4" aria-hidden />
        {coming ? "נרשמת+תזכורת" : "רישום תזכורת"}
      </button>
    );
  }

  return (
    <Link
      prefetch={false}
      href={`/rooms/${room.id}`}
      className={cn(PRIMARY_BTN, "bg-primary text-white hover:bg-primary-strong")}
    >
      כניסה לחדר
      <ArrowLeftIcon className="size-4" aria-hidden />
    </Link>
  );
}

// A room on the rooms page (Figma "כרטיסיות טאב חדרי לימוד").
export function RoomCard({ room }: { room: RoomCardData }) {
  const title = room.topic ?? room.name;
  const goal = room.session?.note ?? (room.topic ? room.name : null);
  const time = room.session
    ? `${timeHe(room.session.startsAt)}–${timeHe(room.session.endsAt)}`
    : room.lastActivityAt
      ? `פעילות אחרונה ${relativeTimeHe(room.lastActivityAt)}`
      : null;
  const extra = Math.max(0, room.memberCount - room.people.length);

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-[22px] bg-card px-7 pt-7 pb-6 shadow-card",
        room.status === "live" && "border-[1.5px] border-primary",
        room.status === "full" && "border-[1.5px] border-muted-foreground/60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {room.courseName && (
          <span className="truncate rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-primary-strong">
            {room.courseName}
          </span>
        )}
        <StatusPill room={room} />
      </div>

      <p className="mt-5 text-[11px] text-muted-foreground">נושא המפגש</p>
      <h3 className="truncate text-xl leading-tight font-bold">
        {room.isMember ? (
          <Link prefetch={false} href={`/rooms/${room.id}`} className="hover:text-primary">
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-foreground">
        {goal && (
          <li className="flex items-center gap-1.5">
            <TargetIcon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">
              <span className="font-medium">מטרת המפגש:</span> {goal}
            </span>
          </li>
        )}
        {time && (
          <li className="flex items-center gap-1.5">
            <ClockIcon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{time}</span>
          </li>
        )}
        {!room.isMember && room.creatorName && (
          <li className="truncate text-xs text-muted-foreground">
            נפתח ע״י {room.creatorName} · {room.memberCount}/4 משתתפים
          </li>
        )}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-divider pt-5">
        <span className="flex items-center" aria-label={`${room.memberCount} משתתפים`}>
          {room.people.slice(0, 4).map((p) => (
            <PersonAvatar
              key={p.id}
              id={p.id}
              name={p.name}
              avatarPath={p.avatarPath}
              className="-ms-2 size-8 border-2 border-white text-[11px] first:ms-0"
            />
          ))}
          {extra > 0 && (
            <span className="-ms-2 flex size-8 items-center justify-center rounded-full border-2 border-white bg-violet-soft text-[11px] font-bold text-violet">
              +{extra}
            </span>
          )}
        </span>
        <RoomAction room={room} />
      </div>
    </article>
  );
}
