"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearStudyAvailability, setStudyAvailability } from "@/lib/availability/actions";
import {
  STUDY_DURATIONS,
  type StudyActivity,
  type StudyDuration,
  type StudyMode,
} from "@/lib/repositories/availability";
import { ACTIVITY_LABEL, MODE_LABEL, durationLabel } from "@/lib/ui/labels";

function Choice<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  label,
}: {
  legend: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={cn(
              "h-9 rounded-[10px] px-3 text-[13px] font-semibold transition-colors",
              value === o
                ? "bg-primary text-white"
                : "border border-border bg-white text-ink-2 hover:border-primary-line",
            )}
          >
            {label(o)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// "פנוי/ה ללמוד עכשיו" (Course.dc.html aside): a switch that opens a short
// form (where / how long / what / topic) and publishes availability to
// classmates until it expires.
export function AvailabilityCard({
  courseId,
  isAvailable,
  expiresAt,
  topics,
  defaultTopicId,
}: {
  courseId: string;
  isAvailable: boolean;
  expiresAt: string | null;
  topics: { id: string; title: string }[];
  defaultTopicId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<StudyMode>("online");
  const [duration, setDuration] = useState<StudyDuration>(60);
  const [activity, setActivity] = useState<StudyActivity>("exercises");
  const [topicId, setTopicId] = useState<string>(defaultTopicId ?? "");

  function onToggle(next: boolean) {
    if (next) {
      setOpen(true);
      return;
    }
    startTransition(async () => {
      const result = await clearStudyAvailability(courseId);
      if (!result.ok) toast.error(result.error);
    });
  }

  function publish() {
    startTransition(async () => {
      const result = await setStudyAvailability(courseId, {
        mode,
        durationMinutes: duration,
        activity,
        topicId: topicId || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success("חברי הקורס רואים שאת/ה פנוי/ה");
    });
  }

  const until = expiresAt
    ? new Intl.DateTimeFormat("he-IL", {
        timeZone: "Asia/Jerusalem",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(expiresAt))
    : null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-[22px] border border-[#D9E6FB] bg-brand-soft px-[22px] py-5">
      <div className="flex flex-col gap-0.5">
        <span id="availability-label" className="text-base font-bold">
          פנוי/ה ללמוד עכשיו
        </span>
        <span className="text-[13px] text-ink-2">
          {isAvailable && until ? `מסומן/ת כפנוי/ה עד ${until}` : "חברי הקורס יוכלו להזמין אותך"}
        </span>
      </div>
      <Switch
        checked={isAvailable}
        disabled={pending}
        onCheckedChange={onToggle}
        aria-labelledby="availability-label"
        className="h-8 w-14 [&>span]:size-[26px] [&>span]:data-[state=checked]:-translate-x-6"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>פנוי/ה ללמוד עכשיו</DialogTitle>
            <DialogDescription>
              חברי הקורס יראו אותך ב&quot;זמינים ללמוד עכשיו&quot; ויוכלו להזמין אותך לחדר.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Choice
              legend="איפה"
              options={["online", "campus"] as const}
              value={mode}
              onChange={setMode}
              label={(v) => MODE_LABEL[v]}
            />
            <Choice
              legend="לכמה זמן"
              options={STUDY_DURATIONS}
              value={duration}
              onChange={setDuration}
              label={durationLabel}
            />
            <Choice
              legend="מה בא לך לעשות"
              options={["exercises", "summaries", "review", "exam_prep"] as const}
              value={activity}
              onChange={setActivity}
              label={(v) => ACTIVITY_LABEL[v]}
            />
            {topics.length > 0 && (
              <label className="flex flex-col gap-2 text-sm font-semibold">
                נושא
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="h-11 rounded-xl border-[1.5px] border-border bg-white px-3 text-sm font-normal"
                >
                  <option value="">כללי</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="brand" size="md" onClick={publish} disabled={pending}>
              {pending ? "שומר..." : "סימון כפנוי/ה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
