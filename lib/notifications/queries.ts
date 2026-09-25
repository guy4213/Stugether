import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listPendingInvitations, type PendingInvitation } from "@/lib/repositories/invitations";
import {
  getNotificationPreferences,
  getNotificationSummary,
  listNotifications,
  type AppNotification,
  type NotificationCategory,
} from "@/lib/repositories/notifications";
import { listMyActiveRooms, listOpenRooms } from "@/lib/repositories/rooms";
import { listMyEnrollments } from "@/lib/repositories/enrollments";
import { israelDayKey } from "@/lib/stats/streak";

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "invitations",
  "rooms",
  "courses",
  "system",
];

export function parseNotificationCategory(value: string | undefined): NotificationCategory | null {
  return NOTIFICATION_CATEGORIES.includes(value as NotificationCategory)
    ? (value as NotificationCategory)
    : null;
}

export type NotificationAction =
  | { kind: "invitation"; invitation: PendingInvitation }
  | { kind: "join"; roomId: string }
  | { kind: "room"; roomId: string }
  | { kind: "course"; courseId: string; label: string }
  | null;

export interface NotificationItem extends AppNotification {
  action: NotificationAction;
}

export async function getNotificationsData(userId: string, category: NotificationCategory | null) {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [notifications, invitations, summaryAll, summaryWeek, preferences, myRooms, enrollments] =
    await Promise.all([
      listNotifications(supabase, userId, { category: category ?? undefined, limit: 100 }),
      listPendingInvitations(supabase),
      getNotificationSummary(supabase, null),
      getNotificationSummary(supabase, weekAgo),
      getNotificationPreferences(supabase, userId),
      listMyActiveRooms(supabase, userId),
      listMyEnrollments(supabase, userId),
    ]);

  const courseIds = enrollments.filter((e) => e.status === "active").map((e) => e.course_id);
  const openRooms = await listOpenRooms(supabase, courseIds);
  const joinable = new Set(
    openRooms.filter((r) => !r.is_member && r.member_count < 4).map((r) => r.room_id),
  );
  const myRoomIds = new Set(myRooms.map((r) => r.id));
  const invitationById = new Map(invitations.map((i) => [i.id, i]));

  const items: NotificationItem[] = notifications.map((n) => {
    let action: NotificationAction = null;
    if (n.type === "room_invitation" && n.invitation_id && invitationById.has(n.invitation_id)) {
      action = { kind: "invitation", invitation: invitationById.get(n.invitation_id)! };
    } else if (n.room_id && myRoomIds.has(n.room_id)) {
      action = { kind: "room", roomId: n.room_id };
    } else if (n.type === "room_opened" && n.room_id && joinable.has(n.room_id)) {
      action = { kind: "join", roomId: n.room_id };
    } else if (n.type === "event_scheduled" && n.course_id) {
      action = { kind: "course", courseId: n.course_id, label: "צפייה" };
    } else if (n.type === "course_recommendation" && n.course_id) {
      action = { kind: "course", courseId: n.course_id, label: "לקורס" };
    }
    return { ...n, action };
  });

  // Day buckets in Israel time: "היום" / "אתמול" / "מוקדם יותר".
  const today = israelDayKey(new Date());
  const yesterday = israelDayKey(new Date(Date.now() - 86_400_000));
  const groups: { label: string; items: NotificationItem[] }[] = [
    { label: "היום", items: [] },
    { label: "אתמול", items: [] },
    { label: "מוקדם יותר", items: [] },
  ];
  for (const item of items) {
    const key = israelDayKey(new Date(item.created_at));
    groups[key === today ? 0 : key === yesterday ? 1 : 2].items.push(item);
  }

  const total = (s: typeof summaryAll) =>
    NOTIFICATION_CATEGORIES.reduce((sum, c) => sum + s[c].total, 0);
  const unread = NOTIFICATION_CATEGORIES.reduce((sum, c) => sum + summaryAll[c].unread, 0);

  return {
    groups: groups.filter((g) => g.items.length > 0),
    counts: {
      all: total(summaryAll),
      ...Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, summaryAll[c].total])),
    } as Record<"all" | NotificationCategory, number>,
    unread,
    week: {
      total: total(summaryWeek),
      byCategory: Object.fromEntries(
        NOTIFICATION_CATEGORIES.map((c) => [c, summaryWeek[c].total]),
      ) as Record<NotificationCategory, number>,
    },
    preferences,
  };
}
