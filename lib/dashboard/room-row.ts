import type { Room } from "@/lib/repositories/rooms";
import { isRoomLive } from "@/lib/stats/live";
import { eventDayLabelHe, shortDateHe, timeHe } from "@/lib/ui/format";

const MAX_MEMBERS = 4;
const MIN_MS = 60_000;
/** A session this close shows "מתחיל בעוד N דקות". */
const SOON_MS = 60 * MIN_MS;
const WEEK_MS = 7 * 24 * 60 * MIN_MS;

export interface RoomPerson {
  id: string;
  name: string;
  avatarPath: string | null;
}

/** The "סטטוס" column of the dashboard rooms table. */
export type RoomRowStatus =
  | { kind: "live" }
  | { kind: "soon"; minutes: number }
  | { kind: "seats"; free: number }
  | { kind: "scheduled" }
  | { kind: "waiting" }
  | { kind: "closed" }
  | null;

function rowStatus(
  r: {
    status: Room["status"];
    live: boolean;
    isOpen: boolean;
    memberCount: number;
    nextSessionAt: string | null;
  },
  now: number,
): RoomRowStatus {
  if (r.status === "closed") return { kind: "closed" };
  if (r.live) return { kind: "live" };
  const untilSession = r.nextSessionAt ? new Date(r.nextSessionAt).getTime() - now : null;
  if (untilSession !== null && untilSession < SOON_MS) {
    return { kind: "soon", minutes: Math.max(1, Math.round(untilSession / MIN_MS)) };
  }
  if (r.isOpen && r.memberCount < MAX_MEMBERS) {
    return { kind: "seats", free: MAX_MEMBERS - r.memberCount };
  }
  if (untilSession !== null) return { kind: "scheduled" };
  if (r.memberCount < 2) return { kind: "waiting" };
  return null;
}

// "עכשיו" / "היום 19:00" / "מחר 17:30" / "חמישי 18:00" / "28 באוק׳ 18:00".
function whenLabel(live: boolean, nextSessionAt: string | null, now: number): string | null {
  if (live) return "עכשיו";
  if (!nextSessionAt) return null;
  const day =
    new Date(nextSessionAt).getTime() - now < WEEK_MS
      ? eventDayLabelHe(nextSessionAt, new Date(now))
      : shortDateHe(nextSessionAt);
  return `${day} ${timeHe(nextSessionAt)}`;
}

// One row of "חדרי למידה" on the dashboard. Labels are computed here, on the
// server, so the client table renders the same text it was sent.
export function dashboardRoom({
  room,
  courseName,
  unread,
  lastMessageAt,
  nextSessionAt,
  people,
  now,
  onlineOthers = 0,
}: {
  room: Room;
  courseName: string | null;
  unread: number;
  lastMessageAt: string | null;
  nextSessionAt: string | null;
  people: RoomPerson[];
  now: number;
  /** Members other than me online now: they make the room live too. */
  onlineOthers?: number;
}) {
  const live = room.status === "active" && isRoomLive(room, now, onlineOthers);
  const memberCount = Math.max(1, people.length);
  return {
    id: room.id,
    name: room.name,
    topic: room.topic,
    courseId: room.course_id,
    courseName,
    status: room.status,
    unread,
    lastMessageAt,
    live,
    nextSessionAt,
    memberCount,
    people,
    when: whenLabel(live, nextSessionAt, now),
    rowStatus: rowStatus(
      { status: room.status, live, isOpen: room.is_open, memberCount, nextSessionAt },
      now,
    ),
  };
}

export type DashboardRoom = ReturnType<typeof dashboardRoom>;
