// supabase/tests/fixtures.mjs
// Seed fixture ids (supabase/seed.sql) and small helpers shared by the test files.
// Not a test file (no .test.mjs suffix).

export const U = {
  a1: "00000000-0000-0000-0000-0000000000a1", // noa: owner R1
  a2: "00000000-0000-0000-0000-0000000000a2", // itai: member R1, owner R2 (archived)
  a3: "00000000-0000-0000-0000-0000000000a3", // maya: member R1
  a4: "00000000-0000-0000-0000-0000000000a4", // yonatan: CS-201, NOT member of R1; invited (I1)
  a5: "00000000-0000-0000-0000-0000000000a5", // shira: member R2 (archived); expired invite I2 to R1
  admin: "00000000-0000-0000-0000-0000000000ad",
};

export const COURSE = {
  cs101: "00000000-0000-0000-0003-000000000001",
  cs201: "00000000-0000-0000-0003-000000000002",
  math110: "00000000-0000-0000-0003-000000000004",
};

export const ROOM = {
  r1: "00000000-0000-0000-0005-000000000001", // active, CS-201, a1 owner + a2 + a3
  r2: "00000000-0000-0000-0005-000000000002", // archived, MATH-110, a2 owner + a5
};

export const MSG = {
  r1_a1: "00000000-0000-0000-0006-000000000001",
  r1_a2: "00000000-0000-0000-0006-000000000002",
  r1_a3_trigger: "00000000-0000-0000-0006-000000000003",
  r1_ai: "00000000-0000-0000-0006-000000000004",
  r1_a1_newest: "00000000-0000-0000-0006-000000000005",
  r2_a2: "00000000-0000-0000-0006-000000000011",
  r2_a5: "00000000-0000-0000-0006-000000000012",
  r2_a2b: "00000000-0000-0000-0006-000000000013",
};

export const INV = {
  i1_a4_valid: "00000000-0000-0000-0007-000000000001",
  i2_a5_expired: "00000000-0000-0000-0007-000000000002",
};

export const AI_RUN_SEED = "00000000-0000-0000-0008-000000000001";

/**
 * Switch the current transaction to a role/identity.
 *   who = user uuid -> authenticated with sub
 *   who = 'service_role' | 'anon' | 'owner' (back to the superuser, claims cleared)
 * SET LOCAL ROLE is permitted from any role because permission is checked
 * against the session user (postgres).
 */
export async function become(ctx, who) {
  if (who === "owner") {
    await ctx.exec("RESET ROLE");
    await ctx.query(`select set_config('request.jwt.claims', '', true)`);
    return;
  }
  await ctx.exec("RESET ROLE");
  if (who === "service_role" || who === "anon") {
    await ctx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ role: who }),
    ]);
    await ctx.exec(`SET LOCAL ROLE ${who}`);
    return;
  }
  await ctx.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: who, role: "authenticated", aud: "authenticated" }),
  ]);
  await ctx.exec("SET LOCAL ROLE authenticated");
}
