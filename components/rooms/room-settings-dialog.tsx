"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon, SettingsIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LEAVE_CONFIRM_OWNER } from "@/components/rooms/room-members-dialog";
import {
  leaveRoomAction,
  setRoomAiEnabled,
  setRoomStatusAction,
  updateRoomDetailsAction,
} from "@/lib/rooms/actions";
import type { RoomPageData } from "@/lib/rooms/queries";

const LEAVE_CONFIRM_MEMBER = "לעזוב את החדר? לא תהיה לך גישה להיסטוריה שלו.";

// ⚙ "הגדרות החדר" in the room header (client QA 12.11.2026). The settings used
// to hide inside the members dialog, reachable only through "הזמנת חברים" —
// gone once the room was full. Owner of an active room: name, topic, open to
// classmates, the AI tutor, closing. Everyone: participants, leaving.
export function RoomSettingsDialog({
  data,
  onOpenMembers,
}: {
  data: RoomPageData;
  onOpenMembers: () => void;
}) {
  const router = useRouter();
  const { room, isOwner, isMember } = data;
  const isActive = room.status === "active";
  const canEdit = isOwner && isActive;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(room.name);
  const [topic, setTopic] = useState(room.topic ?? "");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string } | void>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });
  }

  const dirty = name.trim() !== room.name || topic.trim() !== (room.topic ?? "");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(room.name);
          setTopic(room.topic ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="הגדרות החדר"
          title="הגדרות החדר"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-soft transition-colors hover:bg-surface-2"
        >
          <SettingsIcon className="size-5" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto rounded-[24px] p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">הגדרות החדר</DialogTitle>
          <DialogDescription>
            {canEdit
              ? "רק יוצר/ת החדר יכול/ה לשנות את ההגדרות."
              : isActive
                ? "את ההגדרות משנה יוצר/ת החדר."
                : "החדר סגור — ניתן לקרוא בלבד."}
          </DialogDescription>
        </DialogHeader>

        {canEdit ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!dirty) return;
              run(
                () => updateRoomDetailsAction(room.id, { name: name.trim(), topic: topic.trim() }),
                "ההגדרות נשמרו",
              );
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              שם החדר
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                className="h-11 rounded-[12px]"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              נושא / מטרת המפגש
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="לדוגמה: חזרה על פרק 3 לפני המבחן"
                className="rounded-[12px]"
              />
            </label>
            <Button type="submit" variant="brand" size="md" disabled={pending || !dirty}>
              שמירה
            </Button>
          </form>
        ) : (
          <dl className="flex flex-col gap-2 rounded-[14px] bg-surface-2 p-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">שם החדר</dt>
              <dd className="font-semibold">{room.name}</dd>
            </div>
            {room.topic && (
              <div>
                <dt className="text-xs text-muted-foreground">נושא</dt>
                <dd>{room.topic}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted-foreground">מצב</dt>
              <dd>{!isActive ? "סגור" : room.is_open ? "פתוח לחברי הקורס" : "בהזמנה בלבד"}</dd>
            </div>
          </dl>
        )}

        {canEdit && (
          <section className="flex flex-col gap-3 border-t border-divider pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span id="room-open-toggle" className="text-sm font-semibold">
                  פתוח לחברי הקורס
                </span>
                <span className="text-xs text-muted-foreground">
                  כל מי שרשום לקורס יכול לבקש להצטרף בלי הזמנה
                </span>
              </div>
              <Switch
                checked={room.is_open}
                disabled={pending}
                onCheckedChange={(v) =>
                  run(
                    () => updateRoomDetailsAction(room.id, { isOpen: v }),
                    v ? "החדר פתוח לחברי הקורס" : "החדר בהזמנה בלבד",
                  )
                }
                aria-labelledby="room-open-toggle"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span id="room-ai-toggle" className="text-sm font-semibold">
                  עוזר AI בחדר
                </span>
                {!data.globalAiEnabled && (
                  <span className="text-xs text-muted-foreground">העוזר כבוי כרגע בכל המערכת</span>
                )}
              </div>
              <Switch
                checked={room.ai_enabled}
                disabled={pending}
                onCheckedChange={(v) => run(() => setRoomAiEnabled(room.id, v))}
                aria-labelledby="room-ai-toggle"
              />
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2 border-t border-divider pt-4">
          <Button
            variant="quiet"
            className="justify-start"
            onClick={() => {
              setOpen(false);
              onOpenMembers();
            }}
          >
            <UsersIcon aria-hidden />
            משתתפים והזמנות
          </Button>
          {canEdit && (
            <Button
              variant="quiet"
              className="justify-start text-rose-ink"
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    "לסגור את החדר? חדר סגור נשאר לקריאה בלבד ולא נפתח מחדש. (כדי למחוק אותו לגמרי — עזבו אותו.)",
                  )
                ) {
                  run(() => setRoomStatusAction(room.id, "closed"), "החדר נסגר");
                }
              }}
            >
              סגירת החדר (קריאה בלבד)
            </Button>
          )}
          {isMember && (
            <Button
              variant="ghost"
              className="justify-start text-destructive"
              disabled={pending}
              onClick={() => {
                if (!confirm(isOwner ? LEAVE_CONFIRM_OWNER : LEAVE_CONFIRM_MEMBER)) return;
                run(() => leaveRoomAction(room.id));
              }}
            >
              <LogOutIcon aria-hidden />
              {isOwner ? "עזיבה ומחיקת החדר" : "עזיבת החדר"}
            </Button>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
