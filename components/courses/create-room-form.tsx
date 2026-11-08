"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlusIcon, VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createRoomForCourse } from "@/lib/courses/actions";

// Matches set_room_topics (TOO_MANY_TOPICS above 10).
const MAX_TOPICS = 10;
// The first session's length when an opening time is set.
const SESSION_MINUTES = 90;

const GOALS = [
  "חזרה לקראת מבחן",
  "פתרון תרגילים",
  "למידה בזוגות",
  "הבנת חומר חדש",
  "עבודה / פרויקט משותף",
];

const FIELD =
  "h-12 w-full rounded-[14px] border border-input bg-white px-4 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// "YYYY-MM-DD" / "HH:MM" in the browser's time zone, for the date/time inputs.
const pad = (n: number) => String(n).padStart(2, "0");
const dateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// The next round quarter hour — the default opening time.
function nextQuarterHour(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15);
  return d;
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[15px] font-bold">
        {label}
      </label>
      {children}
    </div>
  );
}

// "חדר לימוד חדש". trigger: glass (course banner) / brand (overview card) /
// soft (rooms tab) / new (rooms page). Open rooms are announced to the course
// and joinable without an invitation (up to 4). A future opening time becomes
// the room's first scheduled session, with the goal as its note.
export function CreateRoomForm({
  courseId: fixedCourseId,
  courses,
  trigger = "soft",
  defaultTopic = "",
  topics = [],
  defaultTopicIds = [],
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  // Either a fixed course (course page) or a list to pick from (dashboard
  // "כניסה מהירה", SPEC §4.2).
  courseId?: string;
  courses?: { id: string; name: string }[];
  /** "none": no button — opened from outside (open / onOpenChange). */
  trigger?: "glass" | "brand" | "soft" | "new" | "none";
  defaultTopic?: string;
  // The course syllabus (fixed-course usage). When present, the room's topics
  // are picked from it instead of typed.
  topics?: { id: string; title: string }[];
  defaultTopicIds?: string[];
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const [pickedCourseId, setPickedCourseId] = useState(courses?.[0]?.id ?? "");
  const courseId = fixedCourseId ?? pickedCourseId;
  const [name, setName] = useState("");
  const [topic, setTopic] = useState(defaultTopic);
  const [topicIds, setTopicIds] = useState<string[]>(defaultTopicIds);
  const [goal, setGoal] = useState(GOALS[0]);
  // Filled when the dialog opens (not on the server: it depends on "now").
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isOpenRoom, setIsOpenRoom] = useState(true);
  const [isPending, startTransition] = useTransition();
  const pickTopics = Boolean(fixedCourseId) && topics.length > 0;

  // Opened from outside (trigger "none"): fill the date and time the same way.
  const [filledFor, setFilledFor] = useState(false);
  if (controlledOpen && !filledFor) {
    setFilledFor(true);
    const at = nextQuarterHour();
    setDate(dateValue(at));
    setTime(timeValue(at));
  } else if (!controlledOpen && filledFor) {
    setFilledFor(false);
  }

  function onOpenChange(next: boolean) {
    if (next) {
      const at = nextQuarterHour();
      setDate(dateValue(at));
      setTime(timeValue(at));
    }
    setOwnOpen(next);
    controlledOnOpenChange?.(next);
  }

  function toggleTopic(id: string, checked: boolean) {
    setTopicIds((ids) =>
      checked ? (ids.length >= MAX_TOPICS ? ids : [...ids, id]) : ids.filter((x) => x !== id),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Local date + time -> an instant. A time that already came (the form was
    // open for a while) opens the room now, without a session.
    const startsAt = date && time ? new Date(`${date}T${time}`) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      toast.error("מועד הפתיחה אינו תקין");
      return;
    }
    const later = startsAt && startsAt.getTime() > Date.now() + 60_000;
    startTransition(async () => {
      const result = await createRoomForCourse(
        courseId,
        name,
        pickTopics ? "" : topic,
        isOpenRoom,
        pickTopics ? topicIds : [],
        later && startsAt
          ? { startsAt: startsAt.toISOString(), durationMin: SESSION_MINUTES, goal: goal || null }
          : null,
      );
      // On success the action redirects and never returns; only a failure
      // (a plain ActionResult) reaches this branch.
      if (result && !result.ok) toast.error(result.error ?? "משהו השתבש");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger !== "none" && (
        <DialogTrigger asChild>
          {trigger === "glass" ? (
            <Button variant="glass" size="md" className={className}>
              <PlusIcon strokeWidth={2.4} />
              פתיחת חדר
            </Button>
          ) : trigger === "new" ? (
            // Rooms page (Figma "חדרי לימוד"): "+ חדר חדש".
            <Button variant="brand" size="xl" className={className}>
              <PlusIcon strokeWidth={2.4} />
              חדר חדש
            </Button>
          ) : trigger === "brand" ? (
            <Button variant="brand" size="xl" className={className}>
              <VideoIcon />
              פתיחת חדר
            </Button>
          ) : (
            <Button variant="soft" size="md" className={className}>
              <PlusIcon />
              חדר לימוד חדש
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-[24px] p-6 sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-[22px] font-extrabold">חדר לימוד חדש</DialogTitle>
          <DialogDescription className="sr-only">
            עד 4 משתתפים, עם עוזר AI בתוך החדר.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="שם החדר" htmlFor="room-name">
            <Input
              id="room-name"
              placeholder="לדוגמה: חזרה לפני המבחן"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              className={FIELD}
            />
          </Field>

          {!fixedCourseId && courses && (
            <Field label="קורס" htmlFor="room-course">
              <select
                id="room-course"
                value={pickedCourseId}
                onChange={(e) => setPickedCourseId(e.target.value)}
                className={FIELD}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {pickTopics ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[15px] font-bold">
                נושאי החדר{" "}
                <span className="font-normal text-muted-foreground">(עד {MAX_TOPICS})</span>
              </legend>
              <div className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-[14px] border border-input p-2">
                {topics.map((t) => {
                  const checked = topicIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex items-start gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!checked && topicIds.length >= MAX_TOPICS}
                        onCheckedChange={(v) => toggleTopic(t.id, v === true)}
                        className="mt-0.5"
                      />
                      <span>{t.title}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <Field label="נושא" htmlFor="room-topic">
              <Input
                id="room-topic"
                placeholder="לדוגמה: רקורסיה"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={500}
                className={FIELD}
              />
            </Field>
          )}

          <Field label="מטרת המפגש" htmlFor="room-goal">
            <select
              id="room-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className={FIELD}
            >
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך פתיחה" htmlFor="room-date">
              <input
                id="room-date"
                type="date"
                value={date}
                min={date ? dateValue(new Date()) : undefined}
                onChange={(e) => setDate(e.target.value)}
                required
                className={FIELD}
              />
            </Field>
            <Field label="שעת פתיחה" htmlFor="room-time">
              <input
                id="room-time"
                type="time"
                step={300}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className={FIELD}
              />
            </Field>
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              checked={isOpenRoom}
              onCheckedChange={(v) => setIsOpenRoom(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">פתוח לחברי הקורס</span>
              <span className="block text-muted-foreground">
                חברי הקורס יקבלו התראה ויוכלו להצטרף בלי הזמנה
              </span>
            </span>
          </label>

          {/* RTL: flex-end = the left side. */}
          <div className="flex justify-end gap-2.5 pt-1">
            <Button
              type="submit"
              variant="brand"
              size="xl"
              className="rounded-[14px] px-6"
              disabled={isPending || !name.trim() || !courseId}
            >
              {isPending ? "יוצר..." : "יצירת חדר"}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="xl" className="rounded-[14px] px-6">
                ביטול
              </Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
