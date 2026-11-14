// Grant (or revoke) Super Admin for an existing account, by email.
//
//   npm run admin:grant -- user@example.com            # -> super_admin
//   npm run admin:grant -- user@example.com --revoke   # -> student
//
// Bootstraps the first admin: inside the app only a Super Admin can change a
// role (/admin/users). Uses the service role key from .env.local (or the
// environment), so it targets whatever NEXT_PUBLIC_SUPABASE_URL points at.
// The guard_profile_privileged_columns trigger allows the change because a
// service-role request has no auth.uid().
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const email = args
  .find((a) => !a.startsWith("--"))
  ?.trim()
  .toLowerCase();

if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:grant -- <email> [--revoke]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(target) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 1000) return null;
  }
}

const userId = await findUserId(email);
if (!userId) {
  console.error(`No account with email ${email} at ${url}. Sign up first, then rerun.`);
  process.exit(1);
}

const role = revoke ? "student" : "super_admin";
const { data, error } = await supabase
  .from("profiles")
  .update(revoke ? { role } : { role, is_active: true })
  .eq("id", userId)
  .select("id, full_name, role, is_active")
  .single();
if (error) {
  console.error(`Update failed: ${error.message}`);
  process.exit(1);
}

console.log(
  `${email} (${data.full_name}) at ${url} -> role=${data.role}, active=${data.is_active}`,
);
