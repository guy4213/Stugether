import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  listCourseActivity,
  type CourseActivityKind,
  type CourseActivityRow,
} from "@/lib/repositories/activity";
import { getDemoScenario } from "@/lib/demo/state";

const MAX_MEMBERS = 4;

export interface CourseActivityItem {
  id: string;
  kind: CourseActivityKind;
  at: string;
  actor: { id: string; name: string; avatarPath: string | null };
  title: string;
  subtitle: string | null;
  href: string | null;
  /** An open room I'm not in that still has a seat: "הצטרפות" in place. */
  joinRoomId: string | null;
}

function toItem(r: CourseActivityRow, meId: string, index: number): CourseActivityItem {
  const actor = { id: r.actor_id, name: r.actor_name, avatarPath: r.actor_avatar };
  const room = r.room_name ? `„${r.room_name}“` : "חדר לימוד";
  const roomHref = r.room_id && r.i_am_member ? `/rooms/${r.room_id}` : null;
  let title: string;
  let href: string | null = null;
  let joinRoomId: string | null = null;
  switch (r.kind) {
    case "room_opened":
      title = r.actor_id === meId ? `פתחת חדר פתוח ${room}` : `${r.actor_name} פתח/ה חדר ${room}`;
      href = roomHref ?? (r.course_id ? `/courses/${r.course_id}` : null);
      if (!r.i_am_member && r.room_is_open && r.room_members < MAX_MEMBERS) joinRoomId = r.room_id;
      break;
    case "session_scheduled":
      title = `נקבע מפגש בחדר ${room}`;
      href = roomHref;
      break;
    case "course_joined":
      title = `${r.actor_name} הצטרף/ה לקורס`;
      href = `/students/${r.actor_id}`;
      break;
    case "friend_added":
      title = `את/ה ו${r.actor_name} חברים עכשיו`;
      href = `/students/${r.actor_id}`;
      break;
    case "invited":
      title =
        r.actor_id === meId
          ? `הזמנת את ${r.target_name ?? "סטודנט/ית"} לחדר ${room}`
          : `${r.actor_name} הזמין/ה אותך לחדר ${room}`;
      href = roomHref ?? "/notifications";
      break;
  }
  return {
    id: `${r.kind}:${r.at}:${r.actor_id}:${r.room_id ?? r.course_id ?? ""}:${index}`,
    kind: r.kind,
    at: r.at,
    actor,
    title,
    subtitle: r.course_name,
    href,
    joinRoomId,
  };
}

// The newest activity around me; `before` pages back (keyset on the time).
export async function getCourseActivity(
  meId: string,
  options: { limit?: number; before?: string | null } = {},
): Promise<CourseActivityItem[]> {
  if (await getDemoScenario()) return [];
  const supabase = await createClient();
  const rows = await listCourseActivity(supabase, options);
  return rows.map((r, i) => toItem(r, meId, i));
}
