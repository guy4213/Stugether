"use client";

import { useEffect, useRef, useTransition } from "react";
import {
  LogOutIcon,
  MaximizeIcon,
  MicIcon,
  MicOffIcon,
  MonitorUpIcon,
  PhoneOffIcon,
  PlusIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { LEAVE_CONFIRM_OWNER, RoomMembersDialog } from "@/components/rooms/room-members-dialog";
import type { MediaState, RemotePeer } from "@/hooks/useRoomCall";
import { leaveRoomAction } from "@/lib/rooms/actions";
import type { RoomMember } from "@/lib/repositories/rooms";
import type { RoomPageData } from "@/lib/rooms/queries";

export type RoomLayout = "normal" | "focus";

/** Whoever's screen is shown on the stage (see RoomScreen). */
export type ScreenSharer = { userId: string; name: string; isMe: boolean; stream: MediaStream };

type Call = {
  supported: boolean;
  local: MediaState;
  localStream: MediaStream | null;
  peers: RemotePeer[];
  error: string | null;
  toggleMic: () => void;
  toggleCam: () => void;
  toggleScreen: () => void;
};

function MediaVideo({
  stream,
  muted,
  fit = "cover",
}: {
  stream: MediaStream;
  muted?: boolean;
  fit?: "cover" | "contain";
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn("size-full", fit === "contain" ? "object-contain" : "object-cover")}
    />
  );
}

// Remote audio plays from its own hidden element, whatever the layout shows.
function PeerAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream]);
  return <audio ref={ref} autoPlay className="hidden" />;
}

function ControlButton({
  label,
  active,
  onClick,
  disabled,
  focus,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  focus: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center transition-colors disabled:opacity-40 [&_svg]:size-6",
        focus
          ? "size-[50px] rounded-[10px] border border-foreground bg-white text-foreground"
          : "size-[50px] rounded-[12px] shadow-soft",
        active
          ? "border-primary bg-primary text-white"
          : focus
            ? "hover:bg-surface-2"
            : "bg-white text-foreground hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

const LEAVE_CONFIRM_MEMBER = "לצאת מהחדר? תוכלו לחזור רק בהזמנה או בבקשת הצטרפות.";

// Participants and the call (Change Request 30.10.2026): a tile per member
// (video when their camera or screen is on), mic / camera / screen controls
// and "יציאה מהחדר". In focus mode it shrinks to a narrow column. While a
// screen is shared (`sharer`) it becomes the stage: the shared screen large,
// the participants in a strip below it (RoomScreen moves it to the middle).
export function CallPanel({
  data,
  currentUserId,
  members,
  online,
  onlineUserIds,
  call,
  canPost,
  layout,
  sharer = null,
  className,
}: {
  data: RoomPageData;
  currentUserId: string;
  members: RoomMember[];
  online: Set<string>;
  onlineUserIds: string[];
  call: Call;
  canPost: boolean;
  layout: RoomLayout;
  sharer?: ScreenSharer | null;
  className?: string;
}) {
  const [leaving, startLeaving] = useTransition();
  const stageRef = useRef<HTMLDivElement>(null);
  const stage = sharer !== null;
  const focus = !stage && layout === "focus";
  const peerById = new Map(call.peers.map((p) => [p.userId, p]));

  useEffect(() => {
    if (call.error) toast.error(call.error);
  }, [call.error]);

  function leave() {
    if (!confirm(data.isOwner ? LEAVE_CONFIRM_OWNER : LEAVE_CONFIRM_MEMBER)) return;
    startLeaving(async () => {
      const result = await leaveRoomAction(data.room.id);
      if (result && !result.ok) toast.error(result.error ?? "לא ניתן לעזוב את החדר");
    });
  }

  function toggleStageFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen?.();
  }

  const tiles = members.map((m) => {
    const isMe = m.user_id === currentUserId;
    const peer = peerById.get(m.user_id);
    const state: MediaState = isMe
      ? call.local
      : (peer ?? { mic: false, cam: false, screen: false });
    const stream = isMe ? call.localStream : (peer?.stream ?? null);
    // The sharer's only video track is the screen, already on the stage.
    const onStage = stage && sharer.userId === m.user_id;
    const showVideo = !!stream && (state.cam || state.screen) && !onStage;
    return {
      id: m.user_id,
      name: m.profile?.full_name ?? "סטודנט/ית",
      avatar: m.profile?.avatar_url ?? null,
      isMe,
      online: isMe || online.has(m.user_id),
      state,
      stream,
      showVideo,
    };
  });

  const controls = canPost && call.supported && (
    <>
      <ControlButton
        label={call.local.screen ? "הפסקת שיתוף מסך" : "שיתוף מסך"}
        active={call.local.screen}
        onClick={call.toggleScreen}
        focus={focus}
      >
        <MonitorUpIcon aria-hidden />
      </ControlButton>
      <ControlButton
        label={call.local.cam ? "כיבוי מצלמה" : "הפעלת מצלמה"}
        active={call.local.cam}
        onClick={call.toggleCam}
        focus={focus}
      >
        {call.local.cam ? <VideoIcon aria-hidden /> : <VideoOffIcon aria-hidden />}
      </ControlButton>
      <ControlButton
        label={call.local.mic ? "השתקת מיקרופון" : "הפעלת מיקרופון"}
        active={call.local.mic}
        onClick={call.toggleMic}
        focus={focus}
      >
        {call.local.mic ? <MicIcon aria-hidden /> : <MicOffIcon aria-hidden />}
      </ControlButton>
    </>
  );

  const canInvite = data.isMember && data.room.status === "active" && data.openSeats > 0;

  const tileList = (
    <ul
      className={cn(
        "flex min-h-0",
        stage
          ? "flex-row gap-2 overflow-x-auto"
          : focus
            ? "flex-col items-center gap-1.5 overflow-y-auto py-1"
            : "flex-col gap-4 overflow-y-auto",
      )}
      aria-label="משתתפים"
    >
      {tiles.map((t) => (
        <li
          key={t.id}
          className={cn(
            "relative shrink-0 overflow-hidden bg-card",
            stage
              ? "aspect-[277/156] h-[72px] rounded-[14px] shadow-card"
              : focus
                ? "size-[50px] rounded-full border border-foreground"
                : "aspect-[277/156] w-full rounded-[22px] shadow-card",
            !t.online && "opacity-60",
          )}
        >
          {t.showVideo && t.stream ? (
            <MediaVideo stream={t.stream} muted />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2">
              <PersonAvatar
                id={t.id}
                name={t.name}
                avatarPath={t.avatar}
                className={
                  focus ? "size-full text-xs" : stage ? "size-9 text-xs" : "size-14 text-base"
                }
              />
            </div>
          )}
          {!focus && (
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-linear-to-t from-black/45 to-transparent text-white",
                stage ? "px-2 pt-4 pb-1" : "px-3 pt-6 pb-2",
              )}
            >
              <span
                className={cn(
                  "truncate font-semibold drop-shadow",
                  stage ? "text-[11px]" : "text-sm",
                )}
              >
                {t.name}
                {t.isMe && " (את/ה)"}
              </span>
              {t.state.screen && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold">מסך</span>
              )}
              <span className="ms-auto" aria-label={t.state.mic ? "מיקרופון פעיל" : "מושתק/ת"}>
                {t.state.mic ? (
                  <MicIcon className={stage ? "size-3" : "size-4"} aria-hidden />
                ) : (
                  <MicOffIcon
                    className={cn("opacity-80", stage ? "size-3" : "size-4")}
                    aria-hidden
                  />
                )}
              </span>
            </div>
          )}
          {!focus && !stage && !t.online && (
            <span className="absolute start-3 top-2 rounded-full bg-white/90 px-2 text-[11px] text-muted-foreground">
              לא מחובר/ת
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  const audio = call.peers.map((p) => <PeerAudio key={p.userId} stream={p.stream} />);

  if (stage) {
    return (
      <aside aria-label="שיתוף מסך ושיחה" className={cn("flex min-h-0 flex-col gap-3", className)}>
        {audio}

        <div
          ref={stageRef}
          className="relative aspect-video w-full shrink-0 overflow-hidden rounded-[22px] bg-[#0b1220] shadow-card lg:aspect-auto lg:min-h-0 lg:flex-1"
        >
          <MediaVideo stream={sharer.stream} muted fit="contain" />
          <span className="absolute start-3 top-3 max-w-[70%] truncate rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">
            {sharer.isMe ? "את/ה משתף/ת את המסך" : `${sharer.name} משתף/ת מסך`}
          </span>
          <button
            type="button"
            onClick={toggleStageFullscreen}
            aria-label="מסך מלא"
            title="מסך מלא"
            className="absolute end-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            <MaximizeIcon className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">{tileList}</div>
          <div className="flex items-center gap-[9px]">
            {controls}
            {canInvite && (
              <RoomMembersDialog
                data={data}
                currentUserId={currentUserId}
                onlineUserIds={onlineUserIds}
                trigger={
                  <button
                    type="button"
                    aria-label="הזמנת חברים"
                    title="הזמנת חברים"
                    className="flex size-[50px] items-center justify-center rounded-[12px] bg-primary text-white transition-colors hover:bg-primary-strong"
                  >
                    <PlusIcon className="size-6" aria-hidden />
                  </button>
                }
              />
            )}
            {data.isMember && (
              <button
                type="button"
                onClick={leave}
                disabled={leaving}
                aria-label="יציאה מהחדר"
                title="יציאה מהחדר"
                className="flex size-[50px] items-center justify-center rounded-[12px] bg-rose-soft text-rose transition-colors hover:bg-[#fcd0d5] disabled:opacity-50"
              >
                <PhoneOffIcon className="size-6" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="משתתפים ושיחה"
      className={cn("flex min-h-0 flex-col", focus ? "items-center gap-2" : "gap-4", className)}
    >
      {audio}

      {!focus && canInvite && (
        <RoomMembersDialog
          data={data}
          currentUserId={currentUserId}
          onlineUserIds={onlineUserIds}
          trigger={
            <button
              type="button"
              className="flex h-12 w-full shrink-0 items-center justify-center gap-1.5 rounded-[14px] bg-primary text-base font-bold text-white transition-colors hover:bg-primary-strong"
            >
              <PlusIcon className="size-4" aria-hidden />
              הזמנת חברים
            </button>
          }
        />
      )}

      {tileList}

      <div
        className={cn(
          "mt-auto flex shrink-0",
          focus ? "flex-col items-center gap-2 pt-2" : "flex-col gap-4",
        )}
      >
        {controls && (
          <div className={cn("flex", focus ? "flex-col gap-2" : "justify-center gap-[9px]")}>
            {controls}
          </div>
        )}
        {data.isMember &&
          (focus ? (
            <button
              type="button"
              onClick={leave}
              disabled={leaving}
              aria-label="יציאה מהחדר"
              title="יציאה מהחדר"
              className="flex size-[50px] items-center justify-center rounded-[10px] border border-foreground bg-rose-soft text-rose transition-colors hover:bg-[#fcd0d5] disabled:opacity-50"
            >
              <PhoneOffIcon className="size-6" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={leave}
              disabled={leaving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-rose-soft text-base font-medium text-rose transition-colors hover:bg-[#fcd0d5] disabled:opacity-50"
            >
              יציאה מהחדר
              <LogOutIcon className="size-4 rtl:-scale-x-100" aria-hidden />
            </button>
          ))}
      </div>
    </aside>
  );
}
