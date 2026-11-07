"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUserNotifications, type NotificationRow } from "@/hooks/useRoomChannel";

const REFRESH_THROTTLE_MS = 1500;

function targetOf(row: NotificationRow): string {
  if (row.type === "direct_message" && row.conversation_id) {
    return `/messages/${row.conversation_id}`;
  }
  if (row.room_id) return `/rooms/${row.room_id}`;
  return "/notifications";
}

// In-site notifications, live: every new notification row for me pops a
// toast (with a link to what it is about) and refreshes the nav badges.
// A private message isn't toasted while that very chat is on screen.
export function LiveNotifications({ userId }: { userId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const lastRefresh = useRef(0);
  const pendingRefresh = useRef<number | null>(null);

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

  useUserNotifications(userId, (row) => {
    const href = targetOf(row);
    const watching = pathnameRef.current === href && document.visibilityState === "visible";
    if (row.type === "direct_message" && watching) return;

    toast(row.title, {
      description: row.body ?? undefined,
      action: {
        label: row.type === "direct_message" ? "לשיחה" : "לצפייה",
        onClick: () => router.push(href),
      },
    });
    refreshBadges();
  });

  return null;
}
