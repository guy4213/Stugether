import type { CourseTopic, TopicProgress } from "@/lib/repositories/topics";

// mastered · current (the one being learned now) · started (in progress, not
// the current one) · upcoming (not started).
export type TopicState = "mastered" | "current" | "started" | "upcoming";

export interface TopicWithState extends CourseTopic {
  state: TopicState;
}

export interface CourseTopicSummary {
  topics: TopicWithState[];
  total: number;
  mastered: number;
  current: TopicWithState | null;
  currentIndex: number; // 1-based position among topics, 0 when none
}

// The current topic is the first one in progress, otherwise the first one not
// yet mastered.
export function summarizeTopics(
  topics: CourseTopic[],
  progress: TopicProgress[],
): CourseTopicSummary {
  const statusById = new Map(progress.map((p) => [p.topic_id, p.status]));
  const sorted = [...topics].sort((a, b) => a.position - b.position);
  const currentTopic =
    sorted.find((t) => statusById.get(t.id) === "in_progress") ??
    sorted.find((t) => statusById.get(t.id) !== "mastered") ??
    null;

  const withState: TopicWithState[] = sorted.map((t) => {
    const status = statusById.get(t.id);
    let state: TopicState = "upcoming";
    if (status === "mastered") state = "mastered";
    else if (t.id === currentTopic?.id) state = "current";
    else if (status === "in_progress") state = "started";
    return { ...t, state };
  });

  const current = withState.find((t) => t.state === "current") ?? null;
  return {
    topics: withState,
    total: withState.length,
    mastered: withState.filter((t) => t.state === "mastered").length,
    current,
    currentIndex: current ? withState.indexOf(current) + 1 : 0,
  };
}
