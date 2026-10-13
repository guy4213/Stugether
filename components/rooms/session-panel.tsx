"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  CheckIcon,
  PlusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelSessionAction,
  proposeSessionAction,
  reactivateRoomAction,
  rsvpSessionAction,
  scheduleSessionAction,
  voteSessionAction,
  type SessionActionResult,
} from "@/lib/rooms/session-actions";
import type { RoomSessions, SessionView } from "@/lib/rooms/sessions";

const MAX_OPTIONS = 5;
const DURATIONS = [30, 60, 90, 120];

const whenHe = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(iso));

const dayHe = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(iso));

const timeOnly = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(iso));

const gcalStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

function googleCalendarUrl(roomName: string, s: SessionView, roomUrl: string) {
  const start = new Date(s.startsAt!);
  const end = new Date(start.getTime() + s.durationMin * 60_000);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `מפגש לימוד: ${roomName}`,
    dates: `${gcalStamp(start)}/${gcalStamp(end)}`,
    details: `${s.note ? `${s.note}\n` : ""}${roomUrl}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

// A room's planned session: propose times, vote, pick one, accept / decline,
// add to calendar — and "רוצים ללמוד שוב ביחד?" once a session is over.
export function SessionPanel({
  roomId,
  roomName,
  roomStatus,
  isOwner,
  sessions,
}: {
  roomId: string;
  roomName: string;
  roomStatus: string;
  isOwner: boolean;
  sessions: RoomSessions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const s = sessions.current;
  const archived = roomStatus === "archived";

  const act = (fn: () => Promise<SessionActionResult>, success?: string) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });

  if (roomStatus === "closed") return null;

  const proposeButton = (label: string) => (
    <Button
      size="chip"
      variant="outline-primary"
      disabled={pending}
      onClick={() => {
        if (!archived) return setDialogOpen(true);
        act(() => reactivateRoomAction(roomId), "החדר הופעל מחדש");
        setDialogOpen(true);
      }}
    >
      <CalendarPlusIcon className="size-4" aria-hidden />
      {label}
    </Button>
  );

  return (
    <>
      {s?.status === "scheduled" ? (
        <section
          aria-label="המפגש הבא"
          className="mx-3 mb-3 flex flex-col gap-2.5 rounded-[18px] border border-primary-line bg-primary-soft p-3.5 sm:mx-0"
        >
          <div className="flex flex-wrap items-center gap-2">
            <CalendarCheckIcon className="size-5 text-primary" aria-hidden />
            <span className="font-bold">
              המפגש הבא: {dayHe(s.startsAt!)} ·{" "}
              {/* Times read left-to-right inside the Hebrew line. */}
              <bdi dir="ltr">
                {timeOnly(s.startsAt!)}–
                {timeOnly(
                  new Date(new Date(s.startsAt!).getTime() + s.durationMin * 60_000).toISOString(),
                )}
              </bdi>
            </span>
            {s.note && <span className="text-sm text-muted-foreground">· {s.note}</span>}
          </div>
          <p className="text-[13px] text-ink-2">
            {s.coming.length > 0 ? `מגיעים: ${s.coming.join(", ")}` : "עוד אין אישורי הגעה"}
            {s.notComing.length > 0 && ` · לא מגיעים: ${s.notComing.join(", ")}`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="chip"
              variant={s.myResponse === "accepted" ? "solid" : "outline-primary"}
              disabled={pending}
              aria-pressed={s.myResponse === "accepted"}
              onClick={() =>
                act(() => rsvpSessionAction(roomId, s.id, "accepted"), "מעולה, נתראה!")
              }
            >
              <CheckIcon className="size-4" aria-hidden />
              מגיע/ה
            </Button>
            <Button
              size="chip"
              variant={s.myResponse === "declined" ? "solid" : "quiet"}
              disabled={pending}
              aria-pressed={s.myResponse === "declined"}
              onClick={() => act(() => rsvpSessionAction(roomId, s.id, "declined"))}
            >
              <XIcon className="size-4" aria-hidden />
              לא מגיע/ה
            </Button>
            <Button asChild size="chip" variant="soft">
              <a href={`/api/rooms/${roomId}/sessions/${s.id}/ics`} download>
                <CalendarPlusIcon className="size-4" aria-hidden />
                הוספה ליומן
              </a>
            </Button>
            <Button
              size="chip"
              variant="soft"
              onClick={() =>
                window.open(
                  googleCalendarUrl(roomName, s, `${window.location.origin}/rooms/${roomId}`),
                  "_blank",
                  "noopener",
                )
              }
            >
              Google Calendar
            </Button>
            {s.canManage && (
              <Button
                size="chip"
                variant="quiet"
                disabled={pending}
                onClick={() => act(() => cancelSessionAction(roomId, s.id), "המפגש בוטל")}
              >
                ביטול המפגש
              </Button>
            )}
          </div>
        </section>
      ) : s?.status === "proposed" ? (
        <section
          aria-label="הצעה למפגש"
          className="mx-3 mb-3 flex flex-col gap-2.5 rounded-[18px] border border-primary-line bg-primary-soft p-3.5 sm:mx-0"
        >
          <p className="flex items-center gap-2 font-bold">
            <CalendarClockIcon className="size-5 text-primary" aria-hidden />
            {s.proposedByName} הציע/ה מפגש נוסף — סמנו מועדים שמתאימים לכם
          </p>
          <ul className="flex flex-col gap-1.5">
            {s.options.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2"
              >
                <button
                  type="button"
                  aria-pressed={o.votedByMe}
                  disabled={pending}
                  onClick={() => act(() => voteSessionAction(roomId, o.id, !o.votedByMe))}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md border",
                    o.votedByMe ? "border-primary bg-primary text-white" : "border-border bg-white",
                  )}
                  aria-label={`מתאים לי: ${whenHe(o.startsAt)}`}
                >
                  {o.votedByMe && <CheckIcon className="size-4" strokeWidth={3} />}
                </button>
                <span className="grow text-sm font-semibold">{whenHe(o.startsAt)}</span>
                <span className="text-xs text-muted-foreground" title={o.voters.join(", ")}>
                  {o.votes === 1 ? "מתאים לאחד" : `מתאים ל-${o.votes}`}
                </span>
                {s.canManage && (
                  <Button
                    size="chip"
                    variant="outline-primary"
                    disabled={pending}
                    onClick={() => act(() => scheduleSessionAction(roomId, o.id), "המפגש נקבע")}
                  >
                    לקבוע
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {s.canManage && (
            <Button
              size="chip"
              variant="quiet"
              className="self-start"
              disabled={pending}
              onClick={() => act(() => cancelSessionAction(roomId, s.id), "ההצעה בוטלה")}
            >
              ביטול ההצעה
            </Button>
          )}
        </section>
      ) : sessions.studyAgain ? (
        <section
          aria-label="ללמוד שוב ביחד"
          className="mx-3 mb-3 flex flex-wrap items-center gap-3 rounded-[18px] border border-success/30 bg-success-soft p-3.5 sm:mx-0"
        >
          <RotateCcwIcon className="size-5 text-success-ink" aria-hidden />
          <span className="grow">
            <span className="block font-bold text-success-ink">רוצים ללמוד שוב ביחד?</span>
            <span className="text-[13px] text-ink-2">
              {archived && !isOwner
                ? "בקשו מיוצר/ת החדר להפעיל אותו מחדש ולקבוע מפגש."
                : "קבעו מפגש נוסף עם אותה קבוצה — אפשר להציע כמה מועדים ולבחור יחד."}
            </span>
          </span>
          {(!archived || isOwner) &&
            proposeButton(archived ? "להפעיל מחדש ולקבוע מפגש" : "קביעת מפגש")}
        </section>
      ) : (
        !archived && (
          <div className="mx-3 mb-3 flex justify-end sm:mx-0">
            {proposeButton("קביעת מפגש עתידי")}
          </div>
        )
      )}

      <ProposeDialog open={dialogOpen} onOpenChange={setDialogOpen} roomId={roomId} />
    </>
  );
}

function ProposeDialog({
  open,
  onOpenChange,
  roomId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [options, setOptions] = useState<string[]>([""]);
  const [duration, setDuration] = useState(60);
  const [note, setNote] = useState("");
  const filled = options.filter(Boolean);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await proposeSessionAction(roomId, {
        // datetime-local is the viewer's local time.
        options: filled.map((v) => new Date(v).toISOString()),
        durationMin: duration,
        note: note.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      toast.success(
        filled.length === 1 ? "המפגש נקבע וחברי החדר קיבלו התראה" : "ההצעה נשלחה לחברי החדר",
      );
      onOpenChange(false);
      setOptions([""]);
      setNote("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>קביעת מפגש לימוד</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            מועד אחד נקבע מיד. כמה מועדים — חברי החדר מסמנים מה מתאים, ואת/ה בוחר/ת.
          </p>
          {options.map((value, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="datetime-local"
                aria-label={`מועד ${i + 1}`}
                value={value}
                onChange={(e) =>
                  setOptions((cur) => cur.map((v, j) => (j === i ? e.target.value : v)))
                }
                required={i === 0}
              />
              {options.length > 1 && (
                <Button
                  type="button"
                  variant="quiet"
                  size="icon-sm"
                  aria-label={`הסרת מועד ${i + 1}`}
                  onClick={() => setOptions((cur) => cur.filter((_, j) => j !== i))}
                >
                  <XIcon />
                </Button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <Button
              type="button"
              variant="soft"
              size="chip"
              className="self-start"
              onClick={() => setOptions((cur) => [...cur, ""])}
            >
              <PlusIcon className="size-4" aria-hidden />
              מועד נוסף
            </Button>
          )}
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="משך המפגש">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={duration === d}
                onClick={() => setDuration(d)}
                className={cn(
                  "h-9 rounded-[10px] px-3 text-[13px] font-semibold",
                  duration === d
                    ? "bg-primary text-white"
                    : "border border-border bg-white text-ink-2",
                )}
              >
                {d < 60 ? `${d} דק׳` : d === 60 ? "שעה" : d === 90 ? "שעה וחצי" : "שעתיים"}
              </button>
            ))}
          </div>
          <Input
            placeholder="על מה נלמד? (לא חובה)"
            aria-label="הערה"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
          <DialogFooter>
            <Button
              type="submit"
              variant="brand"
              size="md"
              disabled={pending || filled.length === 0}
            >
              {pending ? "שולח..." : filled.length > 1 ? "שליחת ההצעה" : "קביעת המפגש"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
