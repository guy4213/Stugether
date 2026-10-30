"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "cn";
import { Pill } from "@/components/ui/pill";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { ChatPanel, upsertMessage, type ChatMode } from "@/components/rooms/chat-panel";
import { ExercisePanel } from "@/components/rooms/exercise-panel";
import { CallPanel, type RoomLayout } from "@/components/rooms/call-panel";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { useRoomCall } from "@/hooks/useRoomCall";
import { useWhiteboard } from "@/hooks/useWhiteboard";
import type { Message } from "@/lib/repositories/messages";
import type { RoomExercise } from "@/lib/repositories/exercises";
import type { RoomPageData } from "@/lib/rooms/queries";

const LAYOUT_KEY = "stugether.room-layout";
const LAYOUT_EVENT = "stugether:room-layout";
type MobileTab = "chat" | "exercise" | "people";

// "רגיל" / "ריכוז", remembered per browser. Server render is always "רגיל".
function readLayout(): RoomLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "focus" ? "focus" : "normal";
  } catch {
    return "normal";
  }
}
function subscribeLayout(onChange: () => void) {
  window.addEventListener(LAYOUT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LAYOUT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
function saveLayout(layout: RoomLayout) {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(LAYOUT_EVENT));
}

// The study room (Figma "חדר למידה", Change Request 30.10.2026): chat on the
// right, the shared exercise + whiteboard in the middle, participants and the
// call on the left. "ריכוז" narrows the participants to a column of circles.
// Below lg the three columns become tabs.
export function RoomScreen({ data, currentUserId }: { data: RoomPageData; currentUserId: string }) {
  const { room, course, isMember, aiAvailable } = data;
  const isActive = room.status === "active";
  // Demo mode (lib/demo): no realtime, no writes — sending is simulated.
  const demo = data.demoPresence !== null;
  const canPost = isMember && isActive;

  const [messages, setMessages] = useState<Message[]>(data.messages);
  const [exercises, setExercises] = useState<RoomExercise[]>(data.exercises);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    data.exercises.at(-1)?.id ?? null,
  );
  const [chatMode, setChatMode] = useState<ChatMode>("group");
  const [draft, setDraft] = useState<{ id: number; text: string } | null>(null);
  const layout = useSyncExternalStore(subscribeLayout, readLayout, () => "normal" as const);
  const [mobileTab, setMobileTab] = useState<MobileTab>("exercise");

  const membersById = useMemo(
    () => new Map(data.members.map((m) => [m.user_id, m])),
    [data.members],
  );
  const activeMembers = data.members.filter((m) => !m.left_at);

  // The call and the whiteboard need the channel's broadcast, and the
  // channel needs their handlers: they meet through these refs.
  const callSignal = useRef<(p: Record<string, unknown>) => void>(() => {});
  const whiteboardSignal = useRef<(p: Record<string, unknown>) => void>(() => {});

  const channel = useRoomChannel(
    room.id,
    isMember ? currentUserId : null,
    {
      onMessageInsert: (row) =>
        setMessages((prev) => upsertMessage(prev, row as unknown as Message)),
      onMessageUpdate: (row) =>
        setMessages((prev) => upsertMessage(prev, row as unknown as Message)),
      onMessageDeleted: (id) =>
        setMessages((prev) =>
          prev.flatMap((m) => {
            if (m.id !== id) return [m];
            // My own deleted message stays as a "deleted" stub; others' vanish
            // (RLS hides deleted rows from everyone but the sender).
            return m.sender_id === currentUserId
              ? [{ ...m, deleted_at: m.deleted_at ?? new Date().toISOString() }]
              : [];
          }),
        ),
      onExerciseInsert: (row) => addExercise(row as unknown as RoomExercise, false),
      onCallSignal: (p) => callSignal.current(p),
      onWhiteboard: (p) => whiteboardSignal.current(p),
    },
    { enabled: !demo },
  );
  const onlineUserIds = data.demoPresence ?? channel.onlineUserIds;
  const online = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);
  const ready = channel.status === "subscribed";

  const call = useRoomCall({
    userId: currentUserId,
    enabled: canPost && !demo,
    ready,
    onlineUserIds,
    iceServers: data.iceServers,
    broadcast: channel.broadcast,
  });
  const whiteboard = useWhiteboard({
    userId: currentUserId,
    enabled: canPost && !demo,
    ready,
    broadcast: channel.broadcast,
  });
  useEffect(() => {
    callSignal.current = call.onCallSignal;
    whiteboardSignal.current = whiteboard.onWhiteboard;
  });

  function addExercise(exercise: RoomExercise, select: boolean) {
    setExercises((prev) =>
      prev.some((e) => e.id === exercise.id)
        ? prev
        : [...prev, exercise].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
    // Someone else's new exercise becomes the shown one only if nothing was
    // picked; my own always does.
    if (select) setSelectedExerciseId(exercise.id);
    else setSelectedExerciseId((cur) => cur ?? exercise.id);
  }

  const exercise = exercises.find((e) => e.id === selectedExerciseId) ?? exercises.at(-1) ?? null;
  const boardKey = exercise?.id ?? "blank";

  const askAboutExercise = useCallback(() => {
    setChatMode("ai");
    setMobileTab("chat");
    setDraft({
      id: Date.now(),
      text: exercise ? `עזור לנו להבין איך לגשת לתרגיל "${exercise.title}"` : "",
    });
  }, [exercise]);

  const readOnlyReason = !isMember
    ? "רק משתתפי החדר יכולים לכתוב בו."
    : room.status === "closed"
      ? "החדר סגור — ניתן לקרוא בלבד."
      : "החדר מאורכב — ניתן לקרוא בלבד.";

  const focus = layout === "focus";
  const show = (tab: MobileTab) => (mobileTab === tab ? "flex" : "max-lg:hidden");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 sm:px-0">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={course ? `/courses/${course.id}` : "/rooms"}
            className="mb-1 w-fit rounded-lg p-1 text-foreground hover:bg-muted"
            aria-label="חזרה"
          >
            <ArrowRightIcon className="size-7" />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-2xl font-bold sm:text-[28px]">{room.name}</h1>
            {room.status === "archived" && <Pill tone="warning">מאורכב</Pill>}
            {room.status === "closed" && <Pill tone="neutral">סגור</Pill>}
          </div>
          <p className="flex items-center gap-2 text-lg text-foreground">
            {activeMembers.length} משתתפים
            <AvatarStack
              people={activeMembers.map((m) => ({
                id: m.user_id,
                name: m.profile?.full_name ?? "?",
              }))}
              max={4}
              size="md"
              borderClassName="border-foreground border"
            />
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="תצוגת החדר"
          className="flex h-10 items-center rounded-full bg-card p-1 shadow-soft max-lg:hidden"
        >
          {(
            [
              { id: "normal", label: "רגיל" },
              { id: "focus", label: "ריכוז" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={layout === o.id}
              onClick={() => saveLayout(o.id)}
              className={cn(
                "h-8 rounded-full px-4 text-sm transition-colors",
                layout === o.id ? "bg-primary font-bold text-white" : "text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: one column at a time. */}
      <div
        role="tablist"
        aria-label="אזורי החדר"
        className="mx-4 grid grid-cols-3 gap-1 rounded-full bg-card p-1 shadow-soft sm:mx-0 lg:hidden"
      >
        {(
          [
            { id: "chat", label: "צ'אט" },
            { id: "exercise", label: "תרגיל" },
            { id: "people", label: "משתתפים" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mobileTab === t.id}
            onClick={() => setMobileTab(t.id)}
            className={cn(
              "h-9 rounded-full text-sm",
              mobileTab === t.id ? "bg-primary font-bold text-white" : "text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4 sm:px-0 sm:pb-0 lg:gap-[18px]">
        <ChatPanel
          roomId={room.id}
          currentUserId={currentUserId}
          messages={messages}
          setMessages={setMessages}
          initialHasMore={data.hasMoreMessages}
          membersById={membersById}
          online={online}
          isMember={isMember}
          canPost={canPost}
          aiAvailable={aiAvailable && isActive}
          readOnlyReason={readOnlyReason}
          demo={demo}
          mode={chatMode}
          onModeChange={setChatMode}
          exerciseTitle={exercise?.title ?? null}
          draft={draft}
          className={cn(
            "w-full shrink-0 lg:flex",
            focus ? "lg:w-[425px]" : "lg:w-[335px]",
            show("chat"),
          )}
        />
        <ExercisePanel
          roomId={room.id}
          exercises={exercises}
          selectedId={exercise?.id ?? null}
          onSelect={setSelectedExerciseId}
          onAdded={(ex) => addExercise(ex, true)}
          canPost={canPost}
          board={{
            items: whiteboard.boards[boardKey] ?? [],
            add: (item) => whiteboard.add(boardKey, item),
            undo: () => whiteboard.undo(boardKey),
            redo: () => whiteboard.redo(boardKey),
            clear: () => whiteboard.clear(boardKey),
          }}
          onAskAi={canPost && aiAvailable ? askAboutExercise : null}
          className={cn("min-w-0 flex-1 lg:flex", show("exercise"))}
        />
        <CallPanel
          data={data}
          currentUserId={currentUserId}
          members={activeMembers}
          online={online}
          onlineUserIds={onlineUserIds}
          call={call}
          canPost={canPost && !demo}
          layout={focus ? "focus" : "normal"}
          className={cn(
            "shrink-0 lg:flex",
            focus ? "lg:w-[60px]" : "w-full lg:w-[277px]",
            show("people"),
          )}
        />
      </div>
    </div>
  );
}
