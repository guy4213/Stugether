"use client";

import { useEffect, useRef, useTransition } from "react";
import {
  LogOutIcon,
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
import { RoomMembersDialog } from "@/components/rooms/room-members-dialog";
import type { MediaState, RemotePeer } from "@/hooks/useRoomCall";
import { leaveRoomAction } from "@/lib/rooms/actions";
import type { RoomMember } from "@/lib/repositories/rooms";
import type { RoomPageData } from "@/lib/rooms/queries";

export type RoomLayout = "normal" | "focus";

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

function MediaVideo({ stream, muted }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className="size-full object-cover" />;
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

// Participants and the call (Change Request 30.10.2026): a tile per member
// (video when their camera or screen is on), mic / camera / screen controls
// and "יציאה מהחדר". In focus mode it shrinks to a narrow column.
export function CallPanel({
  data,
  currentUserId,
  members,
  online,
  onlineUserIds,
  call,
  canPost,
  layout,
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
  className?: string;
}) {
  const [leaving, startLeaving] = useTransition();
  const focus = layout === "focus";
  const peerById = new Map(call.peers.map((p) => [p.userId, p]));

  useEffect(() => {
    if (call.error) toast.error(call.error);
  }, [call.error]);

  function leave() {
    if (!confirm("לצאת מהחדר? תוכלו לחזור רק בהזמנה או בבקשת הצטרפות.")) return;
    startLeaving(async () => {
      const result = await leaveRoomAction(data.room.id);
      if (result && !result.ok) toast.error(result.error ?? "לא ניתן לעזוב את החדר");
    });
  }

  const tiles = members.map((m) => {
    const isMe = m.user_id === currentUserId;
    const peer = peerById.get(m.user_id);
    const state: MediaState = isMe
      ? call.local
      : (peer ?? { mic: false, cam: false, screen: false });
    const stream = isMe ? call.localStream : (peer?.stream ?? null);
    const showVideo = !!stream && (state.cam || state.screen);
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

  return (
    <aside
      aria-label="משתתפים ושיחה"
      className={cn("flex min-h-0 flex-col", focus ? "items-center gap-2" : "gap-4", className)}
    >
      {call.peers.map((p) => (
        <PeerAudio key={p.userId} stream={p.stream} />
      ))}

      {!focus && data.isMember && data.room.status === "active" && data.openSeats > 0 && (
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

      <ul
        className={cn(
          "flex min-h-0 flex-col overflow-y-auto",
          focus ? "items-center gap-1.5 py-1" : "gap-4",
        )}
        aria-label="משתתפים"
      >
        {tiles.map((t) => (
          <li
            key={t.id}
            className={cn(
              "relative shrink-0 overflow-hidden bg-card",
              focus
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
                  className={focus ? "size-full text-xs" : "size-14 text-base"}
                />
              </div>
            )}
            {!focus && (
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-linear-to-t from-black/45 to-transparent px-3 pt-6 pb-2 text-white">
                <span className="truncate text-sm font-semibold drop-shadow">
                  {t.name}
                  {t.isMe && " (את/ה)"}
                </span>
                {t.state.screen && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold">מסך</span>
                )}
                <span className="ms-auto" aria-label={t.state.mic ? "מיקרופון פעיל" : "מושתק/ת"}>
                  {t.state.mic ? (
                    <MicIcon className="size-4" aria-hidden />
                  ) : (
                    <MicOffIcon className="size-4 opacity-80" aria-hidden />
                  )}
                </span>
              </div>
            )}
            {!focus && !t.online && (
              <span className="absolute start-3 top-2 rounded-full bg-white/90 px-2 text-[11px] text-muted-foreground">
                לא מחובר/ת
              </span>
            )}
          </li>
        ))}
      </ul>

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
