import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  friendStatusFor,
  listFriendshipsOf,
  otherSide,
  type FriendStatus,
} from "@/lib/repositories/friends";
import { listPublicProfiles } from "@/lib/repositories/profiles";
import { isOnline } from "@/lib/ui/people";
import { getDemoScenario } from "@/lib/demo/state";

export interface FriendPerson {
  id: string;
  name: string;
  avatarPath: string | null;
  online: boolean;
  lastSeenAt: string | null;
}

export type MyFriendState = { status: FriendStatus; friendshipId: string | null };

// My view of every student I have a friendship row with (for the buttons on
// student cards): id -> status, plus the row id to answer a request in place.
export async function getMyFriendStates(meId: string): Promise<Record<string, MyFriendState>> {
  if (await getDemoScenario()) return {};
  const supabase = await createClient();
  const rows = await listFriendshipsOf(supabase, meId);
  return Object.fromEntries(
    rows.map((f) => [
      otherSide(f, meId),
      { status: friendStatusFor(f, meId), friendshipId: f.id } satisfies MyFriendState,
    ]),
  );
}

// The accepted friends of a student (mine on /profile, theirs on
// /students/[id]); on my own profile also the requests waiting for me.
export async function getFriendsOf(
  userId: string,
  meId: string,
): Promise<{ friends: FriendPerson[]; incoming: (FriendPerson & { friendshipId: string })[] }> {
  if (await getDemoScenario()) return { friends: [], incoming: [] };
  const supabase = await createClient();
  const rows = await listFriendshipsOf(supabase, userId);
  const accepted = rows.filter((f) => f.status === "accepted");
  const incoming =
    userId === meId ? rows.filter((f) => f.status === "pending" && f.addressee_id === meId) : [];
  const ids = [...new Set([...accepted, ...incoming].map((f) => otherSide(f, userId)))];
  const profiles = await listPublicProfiles(supabase, ids);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const now = Date.now();
  const person = (id: string): FriendPerson | null => {
    const p = byId.get(id);
    return p
      ? {
          id,
          name: p.full_name,
          avatarPath: p.avatar_url,
          online: isOnline(p.last_seen_at, now),
          lastSeenAt: p.last_seen_at,
        }
      : null;
  };
  return {
    friends: accepted
      .map((f) => person(otherSide(f, userId)))
      .filter((p): p is FriendPerson => p !== null)
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "he")),
    incoming: incoming
      .map((f) => {
        const p = person(otherSide(f, userId));
        return p ? { ...p, friendshipId: f.id } : null;
      })
      .filter((p): p is FriendPerson & { friendshipId: string } => p !== null),
  };
}
