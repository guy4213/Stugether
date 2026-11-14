import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { listHiddenUserIds, listMyBlockedUsers } from "@/lib/repositories/blocks";
import { listPublicProfiles } from "@/lib/repositories/profiles";
import { getDemoScenario } from "@/lib/demo/state";

// Students hidden from my lists: those I blocked and those who blocked me
// (client QA 14.11.2026). One query per request; an error hides nobody
// rather than breaking the page (the DB still enforces the block itself).
export const getHiddenUserIds = cache(async (): Promise<Set<string>> => {
  if (await getDemoScenario()) return new Set();
  try {
    return new Set(await listHiddenUserIds(await createClient()));
  } catch (err) {
    console.error("[blocks] list_hidden_user_ids failed", err);
    return new Set();
  }
});

export interface BlockedPerson {
  id: string;
  name: string;
  avatarPath: string | null;
  blockedAt: string;
}

// "משתמשים חסומים" on my profile: the only place to lift a block, since a
// blocked student no longer shows up anywhere else.
export async function getMyBlockedUsers(): Promise<BlockedPerson[]> {
  if (await getDemoScenario()) return [];
  const supabase = await createClient();
  const rows = await listMyBlockedUsers(supabase);
  const profiles = await listPublicProfiles(
    supabase,
    rows.map((r) => r.blocked_id),
  );
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => ({
    id: r.blocked_id,
    name: byId.get(r.blocked_id)?.full_name ?? "סטודנט/ית",
    avatarPath: byId.get(r.blocked_id)?.avatar_url ?? null,
    blockedAt: r.created_at,
  }));
}

// On a student's profile: did I block them? (They blocked me → not found.)
export async function getBlockStateWith(
  otherId: string,
): Promise<"none" | "blocked_by_me" | "blocked_me"> {
  const hidden = await getHiddenUserIds();
  if (!hidden.has(otherId)) return "none";
  if (await getDemoScenario()) return "none";
  const mine = await listMyBlockedUsers(await createClient());
  return mine.some((r) => r.blocked_id === otherId) ? "blocked_by_me" : "blocked_me";
}
