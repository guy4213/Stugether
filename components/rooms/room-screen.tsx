"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, MaximizeIcon, MinimizeIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Pill } from "@/components/ui/pill";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { RoomMembersDialog } from "@/components/rooms/room-members-dialog";
import { RoomSettingsDialog } from "@/components/rooms/room-settings-dialog";
import { useFullscreen } from "@/hooks/useFullscreen";
import { ChatPanel, upsertMessage, type ChatMode } from "@/components/rooms/chat-panel";
import { ExercisePanel } from "@/components/rooms/exercise-panel";
import { CallPanel, type RoomLayout, type ScreenSharer } from "@/components/rooms/call-panel";
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
  const router = useRouter();

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
  const [membersOpen, setMembersOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(rootRef);

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
      // The owner left and the room was deleted: nothing left to show here.
      onRoomDeleted: () => {
        toast.error("החדר נמחק כי יוצר/ת החדר עזב/ה");
        router.replace("/dashboard");
        router.refresh();
      },
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
    : "החדר סגור — ניתן לקרוא בלבד.";
  // Alone in the room: say it's fine to start without the others.
  const solo = canPost && activeMembers.length === 1;

  // A shared screen takes the middle (the exercise's place) and the exercise
  // moves to the call's column; when sharing stops everything goes back. A
  // remote screen wins over mine; the sharer sees their own screen too.
  const sharer = useMemo<ScreenSharer | null>(() => {
    const remote = call.peers.find((p) => p.screen);
    if (remote) {
      return {
        userId: remote.userId,
        name: membersById.get(remote.userId)?.profile?.full_name ?? "סטודנט/ית",
        isMe: false,
        stream: remote.stream,
      };
    }
    if (call.local.screen && call.localStream) {
      return { userId: currentUserId, name: "", isMe: true, stream: call.localStream };
    }
    return null;
  }, [call.peers, call.local.screen, call.localStream, membersById, currentUserId]);
  const sharing = sharer !== null;

  // Sharing overrides "ריכוז" for as long as it lasts (the saved choice stays).
  const focus = !sharing && layout === "focus";
  const show = (tab: MobileTab) => (mobileTab === tab ? "flex" : "max-lg:hidden");

  return (
    // md+ (tablets and up): the room fills one screen below the nav (73px)
    // and the page's vertical padding (main pt-5 + pb-6 = 44px), so the
    // whiteboard has room for its toolbar. Banners above it (join requests,
    // the next session) push it down instead of squeezing the columns; the
    // page scrolls by their height.
    <div
      ref={rootRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 bg-background",
        fullscreen.active
          ? // Full screen (or its CSS stand-in on iPhone): the room alone.
            "h-dvh p-3 sm:p-4" + (fullscreen.pseudo ? " fixed inset-0 z-[60]" : "")
          : "md:h-[calc(100dvh-117px)] md:min-h-[600px] md:flex-none",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-0">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={course ? `/courses/${course.id}` : "/rooms"}
              className="-ms-1 shrink-0 rounded-lg p-1 text-foreground hover:bg-muted"
              aria-label="חזרה"
            >
              <ArrowRightIcon className="size-6" />
            </Link>
            <h1 className="truncate text-2xl leading-tight font-bold sm:text-[26px]">
              {room.name}
            </h1>
            {room.status === "closed" && <Pill tone="neutral">סגור</Pill>}
          </div>
          {/* Who is here: photos under the name (client QA 12.11.2026); opens
              the participants dialog. */}
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            aria-label={`${activeMembers.length} משתתפים — לרשימת המשתתפים`}
            className="flex items-center gap-2 self-start rounded-full py-0.5 ps-9 pe-2 text-start text-sm text-foreground hover:bg-muted"
          >
            <span className="flex" aria-hidden>
              {activeMembers.slice(0, 4).map((m) => (
                <span
                  key={m.user_id}
                  title={m.profile?.full_name ?? undefined}
                  className="-ms-2 first:ms-0"
                >
                  <PersonAvatar
                    id={m.user_id}
                    name={m.profile?.full_name ?? "סטודנט/ית"}
                    avatarPath={m.profile?.avatar_url}
                    online={online.has(m.user_id)}
                    className="size-8 border-2 border-white"
                  />
                </span>
              ))}
            </span>
            <span className="font-medium">
              {activeMembers.length === 1 ? "משתתף/ת אחד/ת" : `${activeMembers.length} משתתפים`}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
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
          {/* "מסך מלא" ⇄ "חזרה למסך רגיל" (client QA 12.11.2026). */}
          <button
            type="button"
            onClick={fullscreen.toggle}
            aria-pressed={fullscreen.active}
            className={cn(
              "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-soft transition-colors",
              fullscreen.active
                ? "bg-primary text-white hover:bg-primary-strong"
                : "bg-card text-foreground hover:bg-surface-2",
            )}
          >
            {fullscreen.active ? (
              <MinimizeIcon className="size-4" aria-hidden />
            ) : (
              <MaximizeIcon className="size-4" aria-hidden />
            )}
            <span className={fullscreen.active ? undefined : "max-sm:sr-only"}>
              {fullscreen.active ? "חזרה למסך רגיל" : "מסך מלא"}
            </span>
          </button>
          <RoomSettingsDialog data={data} onOpenMembers={() => setMembersOpen(true)} />
        </div>
      </div>

      <RoomMembersDialog
        data={data}
        currentUserId={currentUserId}
        onlineUserIds={onlineUserIds}
        trigger={null}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />

      {solo && (
        <p className="mx-4 flex items-center gap-2 rounded-[16px] bg-primary-tint px-4 py-2.5 text-sm text-primary-strong sm:mx-0">
          <SparklesIcon className="size-4 shrink-0" aria-hidden />
          <span>
            <b>לא חייבים לחכות:</b> אפשר כבר להתחיל ללמוד לבד עם העוזר, ושותפים יצטרפו כשיענו
            להזמנה.
          </span>
        </p>
      )}

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

      {/* lg-xl (tablet landscape): narrower side columns, so the exercise in
          the middle keeps ~420px instead of being squeezed to ~310px. */}
      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4 sm:px-0 sm:pb-0 lg:gap-3 xl:gap-[18px]">
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
            focus ? "lg:w-[380px] xl:w-[425px]" : "lg:w-[300px] xl:w-[335px]",
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
          compact={sharing}
          className={cn(
            "min-w-0 lg:flex",
            // `order` swaps the columns without remounting either panel.
            sharing ? "flex-1 lg:order-3 lg:w-[340px] lg:flex-none xl:w-[400px]" : "flex-1",
            show("exercise"),
          )}
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
          sharer={sharer}
          className={cn(
            "lg:flex",
            sharing
              ? "w-full min-w-0 lg:order-2 lg:w-auto lg:flex-1"
              : focus
                ? "shrink-0 lg:w-[60px]"
                : "w-full shrink-0 lg:w-[220px] xl:w-[277px]",
            show("people"),
          )}
        />
      </div>
    </div>
  );
}
