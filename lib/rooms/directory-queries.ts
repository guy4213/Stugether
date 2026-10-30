import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCachedMyActiveRooms } from "@/lib/app/cached";
import { listMyEnrollments } from "@/lib/repositories/enrollments";
import {
  listActiveMembersOfRooms,
  listMySeatWatches,
  listOpenRooms,
  type OpenRoom,
  type Room,
} from "@/lib/repositories/rooms";
import {
  listUpcomingSessionDetails,
  type UpcomingSessionDetail,
} from "@/lib/repositories/sessions";
import { listPendingJoinRequests } from "@/lib/repositories/join-requests";
import { isRoomLive } from "@/lib/stats/live";
import { getDemoScenario } from "@/lib/demo/state";
import { demoRoomsInputs } from "@/lib/demo/fixtures";

const MAX_MEMBERS = 4;
/** A session this close counts as "starting" on the card (Figma "מתחיל ב-18:00"). */
const SOON_MS = 24 * 60 * 60 * 1000;

export type RoomsView = "all" | "live" | "mine";

export interface RoomsFilters {
  view?: RoomsView;
  q?: string;
  courseId?: string;
}

// Everything the rooms page needs, from the DB or from the demo.
export interface RoomsInputs {
  userId: string;
  courses: { id: string; name: string }[];
  myRooms: Room[];
  openRooms: OpenRoom[];
  members: { room_id: string; user_id: string; full_name: string; avatar_url: string | null }[];
  sessions: UpcomingSessionDetail[];
  requestedRoomIds: string[];
  watchedRoomIds: string[];
}

async function loadInputs(userId: string): Promise<RoomsInputs> {
  const supabase = await createClient();
  const enrollments = await listMyEnrollments(supabase, userId);
  const courses = enrollments
    .filter((e) => e.status === "active")
    .map((e) => ({ id: e.course_id, name: e.course.name }));
  const myRooms = (await getCachedMyActiveRooms(userId)).filter((r) => r.status === "active");
  const myRoomIds = myRooms.map((r) => r.id);
  const [openRooms, members, sessions, requests, watches] = await Promise.all([
    listOpenRooms(
      supabase,
      courses.map((c) => c.id),
    ),
    listActiveMembersOfRooms(supabase, myRoomIds),
    listUpcomingSessionDetails(supabase, myRoomIds),
    listPendingJoinRequests(supabase, { userId }),
    listMySeatWatches(supabase),
  ]);
  return {
    userId,
    courses,
    myRooms,
    openRooms,
    members,
    sessions,
    requestedRoomIds: requests.map((q) => q.room_id),
    watchedRoomIds: watches,
  };
}

export async function getRoomsPageData(userId: string, filters: RoomsFilters) {
  const demo = await getDemoScenario();
  return shapeRooms(demo ? demoRoomsInputs(demo) : await loadInputs(userId), filters);
}

/**
 * The card's state, in the Figma's words:
 *  live     "פעיל"             — a message in the last 30 minutes
 *  full     "החדר מלא"         — 4 members and I am not one of them
 *  upcoming "מתחיל ב-HH:MM"    — my room's next session is within a day
 *  waiting  "ממתין למשתתפים"  — only the creator is in
 *  open     no badge
 */
export type RoomCardStatus = "live" | "full" | "upcoming" | "waiting" | "open";

function shapeRooms(inputs: RoomsInputs, filters: RoomsFilters) {
  const now = Date.now();
  const courseName = new Map(inputs.courses.map((c) => [c.id, c.name]));
  const requested = new Set(inputs.requestedRoomIds);
  const watched = new Set(inputs.watchedRoomIds);
  const nextSession = new Map<string, UpcomingSessionDetail>();
  for (const s of inputs.sessions) if (!nextSession.has(s.room_id)) nextSession.set(s.room_id, s);
  const membersByRoom = new Map<string, RoomsInputs["members"]>();
  for (const m of inputs.members) {
    membersByRoom.set(m.room_id, [...(membersByRoom.get(m.room_id) ?? []), m]);
  }

  const mine = inputs.myRooms.map((r) => {
    const people = (membersByRoom.get(r.id) ?? []).map((m) => ({
      id: m.user_id,
      name: m.full_name,
      avatarPath: m.avatar_url,
    }));
    const s = nextSession.get(r.id);
    return {
      id: r.id,
      name: r.name,
      topic: r.topic,
      courseId: r.course_id,
      courseName: courseName.get(r.course_id) ?? null,
      isMember: true,
      requested: false,
      watching: false,
      live: isRoomLive(r, now),
      memberCount: people.length || 1,
      people,
      creatorName: null as string | null,
      lastActivityAt: r.last_message_at ?? r.created_at,
      session: s
        ? {
            id: s.id,
            startsAt: s.starts_at,
            endsAt: new Date(
              new Date(s.starts_at).getTime() + s.duration_min * 60_000,
            ).toISOString(),
            note: s.note,
            myRsvp: s.rsvps.find((x) => x.user_id === inputs.userId)?.response ?? null,
          }
        : null,
    };
  });
  const myIds = new Set(mine.map((r) => r.id));
  const others = inputs.openRooms
    .filter((r) => !r.is_member && !myIds.has(r.room_id))
    .map((r) => ({
      id: r.room_id,
      name: r.name,
      topic: r.topic,
      courseId: r.course_id,
      courseName: courseName.get(r.course_id) ?? null,
      isMember: false,
      requested: requested.has(r.room_id),
      watching: watched.has(r.room_id),
      live: isRoomLive(
        { status: "active", last_message_at: r.last_message_at, created_at: r.created_at },
        now,
      ),
      memberCount: r.member_count,
      // RLS shows a non-member only the creator (list_open_rooms).
      people: [{ id: r.created_by, name: r.creator_name, avatarPath: null as string | null }],
      creatorName: r.creator_name,
      lastActivityAt: r.last_message_at ?? r.created_at,
      session: null,
    }));

  const all = [...mine, ...others].map((r) => {
    const status: RoomCardStatus = r.live
      ? "live"
      : !r.isMember && r.memberCount >= MAX_MEMBERS
        ? "full"
        : r.session && new Date(r.session.startsAt).getTime() - now < SOON_MS
          ? "upcoming"
          : r.memberCount < 2
            ? "waiting"
            : "open";
    // A full room I'm not in is still "full" even while live.
    return { ...r, status: !r.isMember && r.memberCount >= MAX_MEMBERS ? "full" : status };
  });

  const q = filters.q?.trim().toLowerCase();
  const view = filters.view ?? "all";
  const matching = all
    .filter((r) => {
      if (view === "live" && !r.live) return false;
      if (view === "mine" && !r.isMember) return false;
      if (filters.courseId && r.courseId !== filters.courseId) return false;
      if (q) {
        const hay = [r.name, r.topic, r.courseName, ...r.people.map((p) => p.name)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        Number(b.isMember) - Number(a.isMember) ||
        (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""),
    );

  return {
    liveRooms: matching.filter((r) => r.live),
    otherRooms: matching.filter((r) => !r.live),
    courses: inputs.courses,
    totals: { all: all.length, live: all.filter((r) => r.live).length },
  };
}

export type RoomsPageData = Awaited<ReturnType<typeof getRoomsPageData>>;
export type RoomCardData = RoomsPageData["liveRooms"][number];
