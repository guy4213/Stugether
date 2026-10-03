import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/repositories/profiles";
import { listMyActiveRooms } from "@/lib/repositories/rooms";
import { countUnreadNotifications } from "@/lib/repositories/notifications";
import { timed } from "@/lib/perf/timing";

// Reads that both the (app) shell (top nav) and most pages need. cache()
// dedupes them within one server request, so the layout and the page — which
// render in parallel — share one query instead of each running its own.
// Arguments must be primitives for cache() to match.

// Timed: one plain single-row query — its duration is the raw round trip
// from the function region to Supabase.
export const getCachedOwnProfile = cache(async (userId: string) =>
  timed("query.ownProfile", getOwnProfile(await createClient(), userId)),
);

export const getCachedMyActiveRooms = cache(async (userId: string) =>
  listMyActiveRooms(await createClient(), userId),
);

export const getCachedUnreadNotificationCount = cache(async (userId: string) =>
  countUnreadNotifications(await createClient(), userId),
);
