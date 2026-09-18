// supabase/tests/load.test.mjs
// Smoke test: shim + all migrations + seed load in PGlite, and every public
// table has RLS ENABLED and FORCED.
import test from "node:test";
import assert from "node:assert/strict";
import { createDb } from "./db.mjs";

test("database loads and every public table has RLS enabled + forced", async (t) => {
  const db = await createDb();
  t.after(() => db.close());

  t.diagnostic(`loaded: ${db.loaded.join(", ")}`);
  t.diagnostic(`pgcrypto: ${db.hasPgcrypto ? "real" : "stub"}`);

  const { rows: tables } = await db.query(`
    select c.relname, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    order by c.relname`);

  const bad = tables
    .filter((r) => !r.relrowsecurity || !r.relforcerowsecurity)
    .map((r) => `${r.relname} (enabled=${r.relrowsecurity}, forced=${r.relforcerowsecurity})`);
  assert.deepEqual(bad, [], `tables without RLS ENABLE + FORCE:\n  ${bad.join("\n  ")}`);
});

test("JWT helpers: auth.uid()/auth.role() follow asUser/asAnon/asService and reset after rollback", async (t) => {
  const db = await createDb({ seedFile: null });
  t.after(() => db.close());
  const uid = "00000000-0000-4000-8000-000000000001";

  const u = await db.asUser(uid, (tx) =>
    tx.one("select auth.uid()::text uid, auth.role() role, current_user cu"),
  );
  assert.deepEqual(u, { uid, role: "authenticated", cu: "authenticated" });

  const a = await db.asAnon((tx) =>
    tx.one("select auth.uid() uid, auth.role() role, current_user cu"),
  );
  assert.deepEqual(a, { uid: null, role: "anon", cu: "anon" });

  const s = await db.asService((tx) => tx.one("select auth.role() role, current_user cu"));
  assert.deepEqual(s, { role: "service_role", cu: "service_role" });

  const after = await db.one("select auth.uid() uid, current_user cu");
  assert.deepEqual(after, { uid: null, cu: "postgres" });

  const topic = await db.asUser(uid, async (tx) => {
    await tx.withTopic("room:abc");
    return tx.one("select realtime.topic() topic");
  });
  assert.equal(topic.topic, "room:abc");
  assert.deepEqual(await db.one("select storage.foldername($1) f", [`${uid}/avatar.png`]), {
    f: [uid],
  });
});
