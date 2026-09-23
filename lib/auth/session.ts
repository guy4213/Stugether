import "server-only";
import { createClient } from "@/lib/supabase/server";

// Kept out of components/**, app/**/page.tsx and app/**/layout.tsx per the
// ESLint Supabase boundary (eslint.config.mjs) — those may only import this
// wrapper, never @/lib/supabase/* directly.
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
