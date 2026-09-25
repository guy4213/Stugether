import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Kept out of components/**, app/**/page.tsx and app/**/layout.tsx per the
// ESLint Supabase boundary (eslint.config.mjs) — those may only import this
// wrapper, never @/lib/supabase/* directly.
// cache(): the (app) layout, the page and query modules all ask "who is
// signed in" during one request — dedupe to a single GoTrue round trip.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});
