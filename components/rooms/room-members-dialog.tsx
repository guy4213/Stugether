"use client";

import { useState, useTransition } from "react";
import { UsersIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Pill } from "@/components/ui/pill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  inviteToRoom,
  leaveRoomAction,
  removeRoomMember,
  revokeRoomInvitation,
  setRoomAiEnabled,
  setRoomStatusAction,
} from "@/lib/rooms/actions";
import { shortDateHe } from "@/lib/ui/format";
import type { RoomPageData } from "@/lib/rooms/queries";

// "משתתפים" panel of a room (SPEC §4.5-4.6): who is in, who is connected, the
// pending invitations, inviting 1-3 classmates of the course, and — for the
// owner — the AI toggle, archive/close. Everyone can leave.
export function RoomMembersDialog({
  data,
  currentUserId,
  onlineUserIds,
}: {
  data: RoomPageData;
  currentUserId: string;
  onlineUserIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const { room, isOwner, isMember } = data;
  const isActive = room.status === "active";
  const activeMembers = data.members.filter((m) => !m.left_at);
  const online = new Set(onlineUserIds);
  const maxSelect = Math.min(3, data.openSeats);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      if (success) toast.success(success);
    });
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelected((prev) =>
      checked ? (prev.length < maxSelect ? [...prev, id] : prev) : prev.filter((x) => x !== id),
    );
  }

  function sendInvites() {
    const ids = selected;
    startTransition(async () => {
      const result = await inviteToRoom(room.id, ids);
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      setSelected([]);
      toast.success(result.sent === 1 ? "ההזמנה נשלחה" : `נשלחו ${result.sent} הזמנות`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="quiet" size="chip" aria-label="משתתפים והזמנות">
          <UsersIcon aria-hidden />
          <span className="max-sm:hidden">משתתפים</span>
          <span className="rounded-full bg-muted px-1.5 text-xs">{activeMembers.length}/4</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">משתתפים בחדר</DialogTitle>
          <DialogDescription>
            {activeMembers.length} מתוך 4 · {online.size > 0 ? `${online.size} מחוברים עכשיו` : ""}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-1">
          {activeMembers.map((m) => {
            const name = m.profile?.full_name ?? "סטודנט/ית";
            const isMe = m.user_id === currentUserId;
            return (
              <li key={m.user_id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <PersonAvatar
                  id={m.user_id}
                  name={name}
                  avatarPath={m.profile?.avatar_url}
                  online={online.has(m.user_id)}
                  className="size-9 text-xs"
                />
                <div className="flex min-w-0 grow flex-col">
                  <span className="truncate text-sm font-semibold">
                    {name}
                    {isMe && <span className="font-normal text-muted-foreground"> (את/ה)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {online.has(m.user_id) ? "מחובר/ת עכשיו" : "לא מחובר/ת"}
                  </span>
                </div>
                {m.role === "owner" && <Pill tone="blue">יוצר/ת החדר</Pill>}
                {isOwner && !isMe && isActive && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    aria-label={`הסרת ${name} מהחדר`}
                    onClick={() => {
                      if (confirm(`להסיר את ${name} מהחדר?`)) {
                        run(() => removeRoomMember(room.id, m.user_id), "המשתתף/ת הוסר/ה");
                      }
                    }}
                  >
                    <XIcon />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        {data.invitations.length > 0 && (
          <section className="flex flex-col gap-2 border-t border-divider pt-3">
            <h3 className="text-sm font-bold">הזמנות ממתינות</h3>
            <ul className="flex flex-col gap-1.5">
              {data.invitations.map((inv) => (
                <li key={inv.id} className="flex items-center gap-2 text-sm">
                  <span className="grow truncate">{inv.inviteeName}</span>
                  <span className="text-xs text-muted-foreground">
                    בתוקף עד {shortDateHe(inv.expiresAt)}
                  </span>
                  {inv.inviterId === currentUserId && (
                    <Button
                      variant="quiet"
                      size="xs"
                      disabled={pending}
                      onClick={() =>
                        run(() => revokeRoomInvitation(room.id, inv.id), "ההזמנה בוטלה")
                      }
                    >
                      ביטול
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {isMember && isActive && (
          <section className="flex flex-col gap-2 border-t border-divider pt-3">
            <h3 className="text-sm font-bold">הזמנת סטודנטים מהקורס</h3>
            {data.openSeats === 0 ? (
              <p className="text-sm text-muted-foreground">
                החדר מלא (4 משתתפים כולל הזמנות ממתינות).
              </p>
            ) : data.inviteCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                אין עוד סטודנטים רשומים לקורס שאפשר להזמין.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  אפשר לבחור עד {maxSelect}. ההזמנה בתוקף 7 ימים.
                </p>
                <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
                  {data.inviteCandidates.map((c) => {
                    const checked = selected.includes(c.id);
                    const disabled = !checked && selected.length >= maxSelect;
                    return (
                      <li key={c.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-muted",
                            disabled && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled || pending}
                            onCheckedChange={(v) => toggleSelected(c.id, v === true)}
                          />
                          <PersonAvatar
                            id={c.id}
                            name={c.name}
                            avatarPath={c.avatarPath}
                            className="size-8 text-[11px]"
                          />
                          <span className="truncate text-sm">{c.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  variant="brand"
                  size="md"
                  disabled={pending || selected.length === 0}
                  onClick={sendInvites}
                >
                  {selected.length > 1 ? `שליחת ${selected.length} הזמנות` : "שליחת הזמנה"}
                </Button>
              </>
            )}
          </section>
        )}

        {isOwner && isActive && (
          <section className="flex flex-col gap-3 border-t border-divider pt-3">
            <h3 className="text-sm font-bold">הגדרות החדר</h3>
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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="quiet"
                size="chip"
                disabled={pending}
                onClick={() => {
                  if (confirm("לארכב את החדר? הוא יישאר גלוי לקריאה בלבד.")) {
                    run(() => setRoomStatusAction(room.id, "archived"), "החדר אורכב");
                  }
                }}
              >
                ארכוב החדר
              </Button>
              <Button
                variant="danger"
                size="chip"
                disabled={pending}
                onClick={() => {
                  if (confirm("לסגור את החדר? חדר סגור לא נפתח מחדש.")) {
                    run(() => setRoomStatusAction(room.id, "closed"), "החדר נסגר");
                  }
                }}
              >
                סגירת החדר
              </Button>
            </div>
          </section>
        )}

        {isMember && (
          <div className="border-t border-divider pt-3">
            <Button
              variant="ghost"
              size="chip"
              className="text-destructive"
              disabled={pending}
              onClick={() => {
                if (confirm("לעזוב את החדר? לא תהיה לך גישה להיסטוריה שלו.")) {
                  run(() => leaveRoomAction(room.id));
                }
              }}
            >
              עזיבת החדר
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
