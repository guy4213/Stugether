"use client";

import { Fragment, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { updateTopicStatus } from "@/lib/topics/actions";
import type { TopicStatus } from "@/lib/repositories/topics";
import type { TopicWithState } from "@/lib/courses/topic-state";

// Course banner stepper (Course.dc.html): ✓ mastered → current (white pill)
// → dashed upcoming, joined by lines. Each step opens a small menu to update
// the topic (enrolled students only).
export function TopicStepper({
  courseId,
  topics,
  editable,
}: {
  courseId: string;
  topics: TopicWithState[];
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function setStatus(topicId: string, status: TopicStatus | null) {
    startTransition(async () => {
      const result = await updateTopicStatus(courseId, topicId, status);
      if (!result.ok) toast.error(result.error);
    });
  }

  if (topics.length === 0) return null;

  return (
    <ol
      aria-label="נושאי הקורס"
      aria-busy={pending}
      className="relative mx-3 mb-3 flex items-center gap-2.5 overflow-x-auto rounded-[20px] border border-white/22 bg-white/14 px-4 py-[18px] sm:mx-5 sm:mb-5 sm:px-6"
    >
      {topics.map((topic, i) => {
        const next = topics[i + 1];
        const line =
          topic.state === "mastered"
            ? next?.state === "mastered"
              ? "bg-white"
              : "bg-[linear-gradient(270deg,#fff_50%,rgba(255,255,255,.3)_50%)]"
            : "bg-white/30";

        const step = (
          <span
            className={cn(
              "flex items-center gap-2 text-sm whitespace-nowrap",
              topic.state === "current"
                ? "rounded-full bg-white py-1.5 ps-3.5 pe-3 text-[15px] font-extrabold text-primary-strong"
                : topic.state === "mastered"
                  ? "font-semibold"
                  : "font-medium text-white/85",
            )}
          >
            {topic.state === "mastered" ? (
              <span className="flex size-[26px] items-center justify-center rounded-full bg-white text-[#0F9F82]">
                <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
            ) : topic.state === "current" ? (
              <span className="size-2.5 rounded-full bg-primary shadow-[0_0_0_5px_rgba(37,99,235,.2)]" />
            ) : (
              <span
                className={cn(
                  "size-[26px] rounded-full border-2",
                  topic.state === "started"
                    ? "border-white bg-white/25"
                    : "border-dashed border-white/60",
                )}
              />
            )}
            {topic.title}
            {topic.state === "current" && " · עכשיו"}
            <span className="sr-only">
              {topic.state === "mastered"
                ? "(נשלט)"
                : topic.state === "upcoming"
                  ? "(בהמשך)"
                  : "(בתהליך)"}
            </span>
          </span>
        );

        return (
          <Fragment key={topic.id}>
            <li className="shrink-0">
              {editable ? (
                <Popover>
                  <PopoverTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-white/60">
                    {step}
                  </PopoverTrigger>
                  <PopoverContent align="center" className="w-48 p-1.5">
                    <p className="px-2 py-1.5 text-sm font-semibold">{topic.title}</p>
                    <StepAction
                      disabled={topic.state === "mastered"}
                      onClick={() => setStatus(topic.id, "mastered")}
                    >
                      סימון כנשלט
                    </StepAction>
                    <StepAction
                      disabled={topic.state === "current" || topic.state === "started"}
                      onClick={() => setStatus(topic.id, "in_progress")}
                    >
                      התחלת הנושא
                    </StepAction>
                    <StepAction
                      disabled={topic.state === "upcoming"}
                      onClick={() => setStatus(topic.id, null)}
                    >
                      איפוס
                    </StepAction>
                  </PopoverContent>
                </Popover>
              ) : (
                step
              )}
            </li>
            {next && (
              <li aria-hidden className={cn("h-[3px] min-w-6 grow rounded-sm", line)} />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

function StepAction({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full rounded-md px-2 py-1.5 text-start text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
