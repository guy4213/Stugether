import type { RoomSessionRow } from "@/lib/repositories/sessions";

// What a room shows about planned sessions: the open one (being voted on or
// scheduled and not over yet), and whether to offer "ללמוד שוב ביחד?".

export interface SessionView {
  id: string;
  status: "proposed" | "scheduled";
  startsAt: string | null;
  durationMin: number;
  note: string | null;
  proposedByName: string;
  /** Proposer or room owner: may pick the time / cancel. */
  canManage: boolean;
  options: { id: string; startsAt: string; votes: number; votedByMe: boolean; voters: string[] }[];
  coming: string[];
  notComing: string[];
  myResponse: "accepted" | "declined" | null;
}

export interface RoomSessions {
  current: SessionView | null;
  /** A session with this group ended (or the room is archived): plan another. */
  studyAgain: boolean;
}

export function shapeRoomSessions(
  rows: RoomSessionRow[],
  ctx: {
    userId: string;
    /** The viewer is the room's current owner (not necessarily its creator). */
    isOwner: boolean;
    roomStatus: string;
    nameById: Map<string, string>;
    now?: number;
  },
): RoomSessions {
  const now = ctx.now ?? Date.now();
  const name = (id: string) => ctx.nameById.get(id) ?? "חבר/ת חדר";
  const endOf = (r: RoomSessionRow) =>
    r.starts_at ? new Date(r.starts_at).getTime() + r.duration_min * 60_000 : 0;

  // One open session per room (20261021000001); an upcoming scheduled one
  // wins over a proposal should older data hold both.
  const open =
    rows.find((r) => r.status === "scheduled" && endOf(r) > now) ??
    rows.find((r) => r.status === "proposed");
  const ended = rows.some((r) => r.status === "scheduled" && endOf(r) <= now);

  const current: SessionView | null = open
    ? {
        id: open.id,
        status: open.status as "proposed" | "scheduled",
        startsAt: open.starts_at,
        durationMin: open.duration_min,
        note: open.note,
        proposedByName: open.proposed_by === ctx.userId ? "את/ה" : name(open.proposed_by),
        canManage: open.proposed_by === ctx.userId || ctx.isOwner,
        options: [...open.options]
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .map((o) => ({
            id: o.id,
            startsAt: o.starts_at,
            votes: o.votes.length,
            votedByMe: o.votes.some((v) => v.user_id === ctx.userId),
            voters: o.votes.map((v) => name(v.user_id)),
          })),
        coming: open.rsvps.filter((r) => r.response === "accepted").map((r) => name(r.user_id)),
        notComing: open.rsvps.filter((r) => r.response === "declined").map((r) => name(r.user_id)),
        myResponse: open.rsvps.find((r) => r.user_id === ctx.userId)?.response ?? null,
      }
    : null;

  return {
    current,
    studyAgain: !current && (ended || ctx.roomStatus === "archived"),
  };
}
