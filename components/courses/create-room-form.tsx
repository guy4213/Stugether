"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlusIcon, VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { createRoomForCourse } from "@/lib/courses/actions";

// Matches set_room_topics (TOO_MANY_TOPICS above 10).
const MAX_TOPICS = 10;

// "פתיחת חדר". trigger: glass (course banner) / brand (overview card) /
// soft (rooms tab). Open rooms are announced to the course and joinable
// without an invitation (up to 4).
export function CreateRoomForm({
  courseId: fixedCourseId,
  courses,
  trigger = "soft",
  defaultTopic = "",
  topics = [],
  defaultTopicIds = [],
  className,
}: {
  // Either a fixed course (course page) or a list to pick from (dashboard
  // "כניסה מהירה", SPEC §4.2).
  courseId?: string;
  courses?: { id: string; name: string }[];
  trigger?: "glass" | "brand" | "soft" | "new";
  defaultTopic?: string;
  // The course syllabus (fixed-course usage). When present, the room's topics
  // are picked from it instead of typed.
  topics?: { id: string; title: string }[];
  defaultTopicIds?: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickedCourseId, setPickedCourseId] = useState(courses?.[0]?.id ?? "");
  const courseId = fixedCourseId ?? pickedCourseId;
  const [name, setName] = useState("");
  const [topic, setTopic] = useState(defaultTopic);
  const [topicIds, setTopicIds] = useState<string[]>(defaultTopicIds);
  const pickTopics = Boolean(fixedCourseId) && topics.length > 0;

  function toggleTopic(id: string, checked: boolean) {
    setTopicIds((ids) =>
      checked ? (ids.length >= MAX_TOPICS ? ids : [...ids, id]) : ids.filter((x) => x !== id),
    );
  }
  const [isOpenRoom, setIsOpenRoom] = useState(true);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createRoomForCourse(
        courseId,
        name,
        pickTopics ? "" : topic,
        isOpenRoom,
        pickTopics ? topicIds : [],
      );
      // On success the action redirects and never returns; only a failure
      // (a plain ActionResult) reaches this branch.
      if (result && !result.ok) toast.error(result.error ?? "משהו השתבש");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>פתיחת חדר לימוד</DialogTitle>
          <DialogDescription>עד 4 משתתפים, עם עוזר AI בתוך החדר.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {!fixedCourseId && courses && (
            <select
              aria-label="קורס"
              value={pickedCourseId}
              onChange={(e) => setPickedCourseId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <Input
            placeholder="שם החדר"
            aria-label="שם החדר"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
          {pickTopics ? (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm font-semibold">
                נושאי החדר{" "}
                <span className="font-normal text-muted-foreground">(עד {MAX_TOPICS})</span>
              </legend>
              <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-input p-2">
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
            <Input
              placeholder="נושא (לא חובה)"
              aria-label="נושא"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
            />
          )}
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
          <DialogFooter>
            <Button
              type="submit"
              variant="brand"
              size="md"
              disabled={isPending || !name.trim() || !courseId}
            >
              {isPending ? "פותח..." : "פתיחת החדר"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
