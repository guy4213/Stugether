// supabase/tests/admin_usage.test.mjs
// 20261111000001_admin_usage_stats.sql — Super Admin "שימוש" (SPEC §4.9, CR 11.11.2026)
// plus Super Admin role management from the users screen (no schema change:
// RLS profiles_update_super_admin + guard_profile_privileged_columns).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "./db.mjs";
import { U } from "./fixtures.mjs";

let base;
before(async () => {
  base = await createDb();
});
after(async () => {
  await base?.close();
});

const USAGE = "select public.admin_usage_stats($1) as r";
const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key]), 0);

test("admin_usage_stats: a student gets NOT_ALLOWED", async () => {
  await base.asUser(U.a1, async (tx) => {
    await tx.expectError(USAGE, [30], "NOT_ALLOWED");
  });
});

test("admin_usage_stats: daily series matches the raw tables", async () => {
  const usage = await base.asUser(U.admin, (tx) => tx.one(USAGE, [30]).then((row) => row.r));

  assert.equal(usage.days, 30);
  assert.equal(usage.daily.length, 30);
  const days = usage.daily.map((d) => d.day);
  assert.deepEqual(days, [...days].sort(), "days ascending");

  const since = usage.since;
  const raw = await base.one(
    `select
       (select count(*)::int from public.messages
         where created_at >= $1 and sender_type = 'user' and deleted_at is null) as room_messages,
       (select count(*)::int from public.direct_messages
         where created_at >= $1 and deleted_at is null) as direct_messages,
       (select count(*)::int from public.ai_runs where created_at >= $1) as ai_runs,
       (select coalesce(sum(prompt_tokens), 0)::int from public.ai_runs
         where created_at >= $1) as prompt_tokens,
       (select count(*)::int from public.rooms where created_at >= $1) as rooms_created,
       (select count(*)::int from public.profiles where created_at >= $1) as signups`,
    [since],
  );
  assert.ok(raw.room_messages > 0, "seed has recent room messages");
  assert.ok(raw.ai_runs > 0, "seed has a recent AI run");

  for (const key of [
    "room_messages",
    "direct_messages",
    "ai_runs",
    "prompt_tokens",
    "rooms_created",
    "signups",
  ]) {
    assert.equal(sum(usage.daily, key), raw[key], key);
  }

  // Period active users: distinct, so never more than the sum of the days.
  assert.ok(Number(usage.active_users) >= 1);
  assert.ok(Number(usage.active_users) <= sum(usage.daily, "active_users"));

  // The seed's AI run was requested by a3 (850 prompt tokens).
  const a3 = usage.top_ai_users.find((u) => u.id === U.a3);
  assert.ok(a3, "a3 is listed as an AI consumer");
  assert.ok(Number(a3.prompt_tokens) >= 850);
  assert.ok(usage.top_users.length > 0 && usage.top_users.length <= 10);
  assert.ok(usage.top_courses.length > 0 && usage.top_courses.length <= 10);
});

test("admin_usage_stats: never returns message content", async () => {
  const usage = await base.asUser(U.admin, (tx) => tx.one(USAGE, [365]).then((row) => row.r));
  const json = JSON.stringify(usage);
  assert.ok(!json.includes('"content"'), "no content key");
  const sample = await base.one(
    "select content from public.messages where sender_type = 'user' order by created_at limit 1",
  );
  assert.ok(!json.includes(sample.content), "no message text");
});

test("admin_usage_stats: p_days is clamped to 1..365", async () => {
  await base.asUser(U.admin, async (tx) => {
    assert.equal((await tx.one(USAGE, [0])).r.daily.length, 1);
    assert.equal((await tx.one(USAGE, [5000])).r.daily.length, 365);
    assert.equal((await tx.one("select public.admin_usage_stats(null) as r")).r.days, 30);
  });
});

test("role management: super_admin promotes and demotes; a student cannot", async (t) => {
  const db = await base.fork();
  t.after(() => db.close());

  await db.asUser(
    U.admin,
    async (tx) => {
      const up = await tx.query("update public.profiles set role = 'super_admin' where id = $1", [
        U.a4,
      ]);
      assert.equal(up.affectedRows, 1);
    },
    { commit: true },
  );
  assert.equal(
    (await db.one("select role from public.profiles where id = $1", [U.a4])).role,
    "super_admin",
  );

  // The promoted user now passes the admin check.
  await db.asUser(U.a4, async (tx) => {
    const r = await tx.one(USAGE, [7]);
    assert.equal(r.r.days, 7);
  });

  await db.asUser(
    U.admin,
    async (tx) => {
      const down = await tx.query("update public.profiles set role = 'student' where id = $1", [
        U.a4,
      ]);
      assert.equal(down.affectedRows, 1);
    },
    { commit: true },
  );
  assert.equal(
    (await db.one("select role from public.profiles where id = $1", [U.a4])).role,
    "student",
  );

  // A student cannot promote anyone (RLS hides other rows; own row hits the trigger).
  await db.asUser(U.a1, async (tx) => {
    const other = await tx.query("update public.profiles set role = 'super_admin' where id = $1", [
      U.a4,
    ]);
    assert.equal(other.affectedRows ?? 0, 0);
    await tx.expectError(
      "update public.profiles set role = 'super_admin' where id = $1",
      [U.a1],
      "PROFILE_PRIVILEGED_COLUMN",
    );
  });
});

// 20261114000001_admin_usage_heatmap.sql — activity by weekday x hour.
const HEATMAP = "select public.admin_usage_heatmap($1) as r";

test("admin_usage_heatmap: a student gets NOT_ALLOWED", async () => {
  await base.asUser(U.a1, async (tx) => {
    await tx.expectError(HEATMAP, [30], "NOT_ALLOWED");
  });
});

test("admin_usage_heatmap: cells add up to the usage totals", async () => {
  await base.asUser(U.admin, async (tx) => {
    for (const days of [7, 30, 365]) {
      const cells = (await tx.one(HEATMAP, [days])).r;
      const usage = (await tx.one(USAGE, [days])).r;
      for (const c of cells) {
        assert.ok(Number.isInteger(c.dow) && c.dow >= 0 && c.dow <= 6, `dow ${c.dow}`);
        assert.ok(Number.isInteger(c.hour) && c.hour >= 0 && c.hour <= 23, `hour ${c.hour}`);
        assert.ok(Number(c.n) > 0, "only non-empty cells");
      }
      const expected =
        sum(usage.daily, "room_messages") +
        sum(usage.daily, "direct_messages") +
        sum(usage.daily, "ai_runs");
      assert.equal(sum(cells, "n"), expected, `days=${days}`);
      assert.ok(!JSON.stringify(cells).includes('"content"'));
    }
  });
});

// 20261114000002_admin_user_details.sql — the user details popup.
const DETAILS = "select public.admin_user_details($1) as r";

test("admin_user_details: a student gets NOT_ALLOWED", async () => {
  await base.asUser(U.a1, async (tx) => {
    await tx.expectError(DETAILS, [U.a2], "NOT_ALLOWED");
  });
});

test("admin_user_details: metadata and counts, never content", async () => {
  // Raw counts first: PGlite has one connection, so no base.* calls inside asUser.
  const raw = await base.one(
    `select
       (select count(*)::int from public.messages
         where sender_id = $1 and sender_type = 'user' and deleted_at is null) as room_messages,
       (select count(*)::int from public.ai_runs where requested_by = $1) as ai_runs,
       (select count(*)::int from public.enrollments where user_id = $1) as courses,
       (select count(*)::int from public.room_members where user_id = $1) as rooms,
       (select content from public.messages
         where sender_id = $1 and sender_type = 'user' limit 1) as sample_content`,
    [U.a3],
  );

  const [d, missing] = await base.asUser(U.admin, async (tx) => [
    (await tx.one(DETAILS, [U.a3])).r,
    (await tx.one(DETAILS, ["00000000-0000-0000-0000-0000000000ff"])).r,
  ]);

  assert.equal(d.id, U.a3);
  assert.equal(d.role, "student");
  assert.ok(d.email && d.email.includes("@"), "email from auth.users");
  assert.equal(Number(d.stats.room_messages), raw.room_messages);
  assert.equal(Number(d.stats.ai_runs), raw.ai_runs);
  assert.ok(Number(d.stats.prompt_tokens) >= 850, "a3's seeded AI run");
  assert.equal(d.courses.length, raw.courses);
  assert.equal(d.rooms.length, raw.rooms);
  assert.ok(d.rooms.every((r) => r.name && r.status && r.role));

  const json = JSON.stringify(d);
  assert.ok(!json.includes('"content"'), "no content key");
  assert.ok(raw.sample_content && !json.includes(raw.sample_content), "no message text");
  assert.equal(missing, null);
});

// 20261114000003_admin_user_emails.sql — emails in the users list.
const EMAILS = "select user_id::text, email from public.admin_user_emails($1::uuid[])";

test("admin_user_emails: a student gets NOT_ALLOWED", async () => {
  await base.asUser(U.a1, async (tx) => {
    await tx.expectError(EMAILS, [[U.a2]], "NOT_ALLOWED");
  });
});

test("admin_user_emails: returns auth.users emails for the requested ids only", async () => {
  const raw = await base.query(
    "select id::text, email from auth.users where id = any($1::uuid[]) order by id",
    [[U.a1, U.a2]],
  );
  const rows = await base.asUser(
    U.admin,
    async (tx) => (await tx.query(EMAILS, [[U.a1, U.a2]])).rows,
  );
  assert.equal(rows.length, 2);
  const byId = new Map(rows.map((r) => [r.user_id, r.email]));
  for (const r of raw.rows) assert.equal(byId.get(r.id), r.email);

  await base.asUser(U.admin, async (tx) => {
    const none = await tx.query(EMAILS, [[]]);
    assert.equal(none.rows.length, 0);
  });
});
