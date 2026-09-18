import { createBrowserClient } from "@supabase/ssr";

// Browser client. Import only from lib/repositories, lib/storage or hooks/useRoomChannel.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
