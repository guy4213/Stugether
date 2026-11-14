"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUserNotifications, type NotificationRow } from "@/hooks/useRoomChannel";
import { InvitationDialog } from "@/components/notifications/invitation-dialog";
import { listMyPendingInvitationsAction } from "@/lib/notifications/actions";
import { respondFriendRequestAction } from "@/lib/friends/actions";
import { playNotifySound, unlockNotifySound } from "@/lib/ui/notify-sound";
import type { PendingInvitation } from "@/lib/repositories/invitations";

const REFRESH_THROTTLE_MS = 1500;
// Invitations already shown (and put off with "לא עכשיו") in this visit.
const SEEN_KEY = "stugether:invites-seen";

function targetOf(row: NotificationRow): string {
  if (row.type === "direct_message" && row.conversation_id) {
    return `/messages/${row.conversation_id}`;
  }
  if ((row.type === "friend_request" || row.type === "friend_accepted") && row.actor_id) {
    return `/students/${row.actor_id}`;
  }
  if (row.room_id) return `/rooms/${row.room_id}`;
  return "/notifications";
}

function seenInvites(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function markInviteSeen(id: string) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seenInvites(), id]));
  } catch {
    // Storage blocked: it may pop up once more.
  }
}

// In-site notifications, live: every new notification row for me pops a
// toast (with a link to what it is about), a short sound, and refreshes the
// nav badges. A private message isn't toasted while that very chat is on
// screen. A room invitation opens a dialog instead (client QA 12.11.2026),
// and a pending one is shown once per visit too, so it can't be missed.
export function LiveNotifications({ userId }: { userId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const lastRefresh = useRef(0);
  const pendingRefresh = useRef<number | null>(null);
  const [invite, setInvite] = useState<{
    invitation: PendingInvitation;
    notificationId: string | null;
  } | null>(null);

  function refreshBadges() {
    const wait = lastRefresh.current + REFRESH_THROTTLE_MS - Date.now();
    if (pendingRefresh.current !== null) return;
    pendingRefresh.current = window.setTimeout(
      () => {
        pendingRefresh.current = null;
        lastRefresh.current = Date.now();
        router.refresh();
      },
      Math.max(0, wait),
    );
  }
  const refreshRef = useRef(refreshBadges);
  useEffect(() => {
    refreshRef.current = refreshBadges;
  });

  // Sound needs a first interaction; badges catch up when the tab or the
  // network comes back (a notification may have arrived while away).
  useEffect(() => {
    if (!userId) return;
    const resume = unlockNotifySound();
    const catchUp = () => {
      if (document.visibilityState === "visible") refreshRef.current();
    };
    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("online", catchUp);
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      document.removeEventListener("visibilitychange", catchUp);
      window.removeEventListener("online", catchUp);
    };
  }, [userId]);

  // A pending invitation from before this visit: shown once.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void listMyPendingInvitationsAction().then((list) => {
      if (cancelled) return;
      const seen = seenInvites();
      const next = list.find((i) => !seen.has(i.id));
      if (next) setInvite((cur) => cur ?? { invitation: next, notificationId: null });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function openInvitation(row: NotificationRow) {
    const list = await listMyPendingInvitationsAction();
    const invitation =
      list.find((i) => i.id === row.invitation_id) ??
      list.find((i) => i.room_id === row.room_id) ??
      null;
    if (invitation) setInvite({ invitation, notificationId: row.id });
    else toast(row.title, { description: row.body ?? undefined });
  }

  useUserNotifications(
    userId,
    (row) => {
      const href = targetOf(row);
      const watching = pathnameRef.current === href && document.visibilityState === "visible";
      if (row.type === "direct_message" && watching) return;

      playNotifySound();
      refreshBadges();

      if (row.type === "room_invitation") {
        void openInvitation(row);
        return;
      }
      if (row.type === "friend_request" && row.friendship_id) {
        const friendshipId = row.friendship_id;
        toast(row.title, {
          description: row.body ?? undefined,
          duration: 10_000,
          action: {
            label: "אישור",
            onClick: () =>
              void respondFriendRequestAction(friendshipId, true).then((r) => {
                if (r.ok) toast.success("אתם חברים עכשיו");
                else toast.error(r.error ?? "משהו השתבש");
                router.refresh();
              }),
          },
        });
        return;
      }
      toast(row.title, {
        description: row.body ?? undefined,
        action: {
          label: row.type === "direct_message" ? "לשיחה" : "לצפייה",
          onClick: () => router.push(href),
        },
      });
    },
    () => refreshBadges(),
  );

  return (
    <InvitationDialog
      invitation={invite?.invitation ?? null}
      notificationId={invite?.notificationId}
      onClose={() => {
        if (invite) markInviteSeen(invite.invitation.id);
        setInvite(null);
      }}
    />
  );
}
