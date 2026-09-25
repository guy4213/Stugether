import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType =
  | "room_invitation"
  | "room_opened"
  | "room_joined"
  | "event_scheduled"
  | "course_recommendation"
  | "system";

export type NotificationCategory = "invitations" | "rooms" | "courses" | "system";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  category: NotificationCategory;
  actor_id: string | null;
  course_id: string | null;
  room_id: string | null;
  invitation_id: string | null;
  event_id: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  live_rooms: boolean;
  messages_invites: boolean;
  course_recs: boolean;
  system_updates: boolean;
}

export type NotificationPreferenceKey = keyof NotificationPreferences;

// Same defaults as the table / notification_enabled() (no row = defaults).
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  live_rooms: true,
  messages_invites: true,
  course_recs: false,
  system_updates: true,
};

export async function listNotifications(
  client: SupabaseClient,
  userId: string,
  options: { category?: NotificationCategory; limit?: number } = {},
): Promise<AppNotification[]> {
  let query = client
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.category) query = query.eq("category", options.category);
  const { data, error } = await query;
  if (error) throw error;
  return data as AppNotification[];
}

export async function countUnreadNotifications(
  client: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export type NotificationSummary = Record<NotificationCategory, { total: number; unread: number }>;

// Wraps get_notification_summary(p_since): per-category totals for the
// caller. `since` null = all time.
export async function getNotificationSummary(
  client: SupabaseClient,
  since: Date | null,
): Promise<NotificationSummary> {
  const { data, error } = await client.rpc("get_notification_summary", {
    p_since: since ? since.toISOString() : null,
  });
  if (error) throw error;
  const summary: NotificationSummary = {
    invitations: { total: 0, unread: 0 },
    rooms: { total: 0, unread: 0 },
    courses: { total: 0, unread: 0 },
    system: { total: 0, unread: 0 },
  };
  for (const row of data as { category: NotificationCategory; total: number; unread: number }[]) {
    summary[row.category] = { total: Number(row.total), unread: Number(row.unread) };
  }
  return summary;
}

// Wraps mark_notifications_read(p_ids): omit ids to mark everything read.
export async function markNotificationsRead(
  client: SupabaseClient,
  ids?: string[],
): Promise<number> {
  const { data, error } = await client.rpc("mark_notifications_read", {
    p_ids: ids ?? null,
  });
  if (error) throw error;
  return data as number;
}

export async function getNotificationPreferences(
  client: SupabaseClient,
  userId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await client
    .from("notification_preferences")
    .select("live_rooms, messages_invites, course_recs, system_updates")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as NotificationPreferences | null) ?? DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function setNotificationPreference(
  client: SupabaseClient,
  userId: string,
  key: NotificationPreferenceKey,
  value: boolean,
): Promise<void> {
  const current = await getNotificationPreferences(client, userId);
  const { error } = await client
    .from("notification_preferences")
    .upsert({ user_id: userId, ...current, [key]: value }, { onConflict: "user_id" });
  if (error) throw error;
}
