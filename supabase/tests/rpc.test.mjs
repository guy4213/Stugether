// supabase/tests/rpc.test.mjs
// TECHNICAL_SPEC.md §11 — concurrency / mechanism tests 11-16 plus extra RPC checks.
//
// PGlite is a single connection: true parallel races (two accepts at the same
// instant, two @AI 100ms apart) cannot be run. They are simulated sequentially
// (the second call runs after the first committed), and the locking mechanism
// is asserted by inspecting the function definitions.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb, expectError } from "./db.mjs";
import { U, ROOM, MSG, INV, COURSE, become } from "./fixtures.mjs";

let base;
before(async () => {
  base = await createDb();
});
after(async () => {
  await base?.close();
});

/** Fresh isolated copy of the seeded database for tests that commit. */
async function fresh(t) {
  const db = await base.fork();
  t.after(() => db.close());
  return db;
}

const START_AI = "select public.start_ai_run($1, $2, $3, $4, $5) as r";
const startAi = (tx, { room = ROOM.r1, msg = MSG.r1_a3_trigger, by = U.a3, userLimit = 100, roomLimit = 100 } = {}) =>
  tx.one(START_AI, [room, msg, by, userLimit, roomLimit]).then((row) => row.r);

const activeRuns = (q, room = ROOM.r1) =>
  q("select id::text, status, error_code from public.ai_runs where room_id = $1 and status in ('queued','running')", [room]).then((r) => r.rows);

// ---------------------------------------------------------------------------
// 11. capacity
// ---------------------------------------------------------------------------
test("#11 capacity: second accept into a room that became full -> ROOM_FULL (sequential simulation)", async (t) => {
  const db = await fresh(t);

  // R1 has 3 active members. Two valid pending invitations: I1 (a4, seed) and a new one to a5.
  // The a5 invite first lazily expires the seed's expired I2 via the BEFORE INSERT trigger.
  const invA5 = await db.asUser(
    U.a1,
    (tx) =>
      tx.one(
        "insert into public.room_invitations (room_id, inviter_id, invitee_user_id) values ($1, $2, $3) returning id::text",
        [ROOM.r1, U.a1, U.a5],
      ),
    { commit: true },
  );
  assert.ok(invA5.id);

  const pendingBefore = await db.one(
    "select count(*)::int n from public.room_invitations where room_id = $1 and status = 'pending' and expires_at > now()",
    [ROOM.r1],
  );
  assert.equal(pendingBefore.n, 2, "two valid invitations racing for the last seat");

  // First accept wins (commits).
  const roomId = await db.asUser(
    U.a4,
    (tx) => tx.one("select public.accept_room_invitation($1) as r", [INV.i1_a4_valid]).then((x) => x.r),
    { commit: true },
  );
  assert.equal(roomId, ROOM.r1);

  // Second accept -> ROOM_FULL.
  await expectError(
    db.asUser(U.a5, (tx) => tx.query("select public.accept_room_invitation($1)", [invA5.id]), { commit: true }),
    "ROOM_FULL",
  );

  const members = await db.one(
    "select count(*)::int n from public.room_members where room_id = $1 and left_at is null",
    [ROOM.r1],
  );
  assert.equal(members.n, 4, "exactly 4 active members, never 5");
  const a5 = await db.one("select status from public.room_invitations where id = $1", [invA5.id]);
  assert.equal(a5.status, "pending", "losing invitation is not consumed");
  const a5m = await db.query("select 1 from public.room_members where room_id = $1 and user_id = $2", [ROOM.r1, U.a5]);
  assert.equal(a5m.rows.length, 0);

  // Mechanism: the capacity check runs under a row lock on the room.
  const def = (await db.one("select pg_get_functiondef('public.accept_room_invitation(uuid)'::regprocedure) d")).d;
  const lockIdx = def.search(/from\s+public\.rooms[\s\S]*?for\s+update/i);
  const countIdx = def.search(/count\(\*\)/i);
  assert.ok(lockIdx >= 0, "accept_room_invitation must SELECT ... FROM public.rooms ... FOR UPDATE");
  assert.ok(countIdx > lockIdx, "active-member count must happen after taking the room lock");
  assert.match(def, /ROOM_FULL/);
  assert.match(def, />=\s*4/);
});

// ---------------------------------------------------------------------------
// 12. expired invitation
// ---------------------------------------------------------------------------
test("#12 expired invitation: not in pending list; accept -> INVITATION_EXPIRED (NULL) and status 'expired'", async (t) => {
  const db = await fresh(t);
  const seedRow = await db.one("select status, expires_at < now() past from public.room_invitations where id = $1", [INV.i2_a5_expired]);
  assert.deepEqual(seedRow, { status: "pending", past: true });

  await db.asUser(U.a5, async (tx) => {
    const { rows } = await tx.query("select id::text from public.get_pending_invitations()");
    assert.ok(!rows.some((r) => r.id === INV.i2_a5_expired), "expired invitation must not be listed");
    // Also the documented direct read filter.
    const direct = await tx.query(
      "select id from public.room_invitations where invitee_user_id = auth.uid() and status = 'pending' and expires_at > now()",
    );
    assert.equal(direct.rows.length, 0);
  });
  // Control: a4's valid invitation is listed.
  const a4list = await db.asUser(U.a4, (tx) => tx.query("select id::text from public.get_pending_invitations()"));
  assert.deepEqual(a4list.rows.map((r) => r.id), [INV.i1_a4_valid]);

  // Documented convention: accept returns NULL == INVITATION_EXPIRED, and the status update persists.
  const res = await db.asUser(
    U.a5,
    (tx) => tx.one("select public.accept_room_invitation($1) as r", [INV.i2_a5_expired]).then((x) => x.r),
    { commit: true },
  );
  assert.equal(res, null, "INVITATION_EXPIRED is signalled by a NULL return");
  const after = await db.one("select status from public.room_invitations where id = $1", [INV.i2_a5_expired]);
  assert.equal(after.status, "expired");
  const m = await db.query("select 1 from public.room_members where room_id = $1 and user_id = $2", [ROOM.r1, U.a5]);
  assert.equal(m.rows.length, 0, "expired invitation must not grant membership");

  // Calling again still reports expired.
  const again = await db.asUser(U.a5, (tx) =>
    tx.one("select public.accept_room_invitation($1) as r", [INV.i2_a5_expired]).then((x) => x.r),
  );
  assert.equal(again, null);
});

// ---------------------------------------------------------------------------
// 13. busy
// ---------------------------------------------------------------------------
test("#13 second start_ai_run while one is active -> busy; one active run, one placeholder", async (t) => {
  const db = await fresh(t);
  const first = await db.asService((tx) => startAi(tx), { commit: true });
  assert.equal(first.ai_status, "started");
  assert.ok(first.run_id && first.placeholder_message_id);

  // Second trigger from another member (a1's own message) a moment later.
  const second = await db.asService((tx) => startAi(tx, { msg: MSG.r1_a1_newest, by: U.a1 }), { commit: true });
  assert.deepEqual(second, { run_id: null, placeholder_message_id: null, ai_status: "busy" });
  const third = await db.asService((tx) => startAi(tx), { commit: true });
  assert.equal(third.ai_status, "busy");

  const runs = await activeRuns((s, p) => db.query(s, p));
  assert.equal(runs.length, 1);
  assert.equal(runs[0].id, first.run_id);
  const ph = await db.query(
    "select id::text, ai_run_id::text, status, content from public.messages where room_id = $1 and sender_type = 'ai' and status = 'streaming'",
    [ROOM.r1],
  );
  assert.equal(ph.rows.length, 1);
  assert.deepEqual(ph.rows[0], { id: first.placeholder_message_id, ai_run_id: first.run_id, status: "streaming", content: "" });

  // Mechanism: partial unique index exists.
  const idx = await db.one("select indexdef from pg_indexes where indexname = 'ai_runs_one_active_per_room'");
  assert.match(idx.indexdef, /UNIQUE/);
  assert.match(idx.indexdef, /queued/);
  assert.match(idx.indexdef, /running/);
});

// ---------------------------------------------------------------------------
// 14 / 15. stale runs
// ---------------------------------------------------------------------------
for (const [num, status, startedSql] of [
  ["#14", "running", "now() - interval '2 minutes'"],
  ["#15", "queued", "null"],
]) {
  test(`${num} stale '${status}' run created 2 minutes ago -> released, new run started`, async (t) => {
    const db = await fresh(t);
    const stale = await db.asOwner(
      async (tx) => {
        const run = await tx.one(
          `insert into public.ai_runs (room_id, trigger_message_id, requested_by, status, created_at, started_at)
           values ($1, $2, $3, $4, now() - interval '2 minutes', ${startedSql}) returning id::text, started_at`,
          [ROOM.r1, MSG.r1_a3_trigger, U.a3, status],
        );
        const msg = await tx.one(
          `insert into public.messages (room_id, sender_type, content, status, ai_run_id, created_at)
           values ($1, 'ai', '', 'streaming', $2, now() - interval '2 minutes') returning id::text`,
          [ROOM.r1, run.id],
        );
        return { ...run, msgId: msg.id };
      },
      { commit: true },
    );
    if (status === "queued") assert.equal(stale.started_at, null);

    // Precondition: the stale run holds the lock (a fresh one would be busy).
    assert.equal((await activeRuns((s, p) => db.query(s, p))).length, 1);

    const res = await db.asService((tx) => startAi(tx), { commit: true });
    assert.equal(res.ai_status, "started");
    assert.notEqual(res.run_id, stale.id);

    const old = await db.one("select status, error_code, finished_at from public.ai_runs where id = $1", [stale.id]);
    assert.equal(old.status, "failed");
    assert.equal(old.error_code, "stale");
    assert.notEqual(old.finished_at, null);
    const runs = await activeRuns((s, p) => db.query(s, p));
    assert.deepEqual(runs.map((r) => r.id), [res.run_id]);
    const oldMsg = await db.one("select status from public.messages where id = $1", [stale.msgId]);
    assert.notEqual(oldMsg.status, "streaming", "old placeholder must not keep streaming");
  });
}

test("#14/#15 control: an active run created 60 seconds ago is NOT stale -> busy", async (t) => {
  const db = await fresh(t);
  await db.exec(
    `insert into public.ai_runs (room_id, trigger_message_id, requested_by, status, created_at)
     values ('${ROOM.r1}', '${MSG.r1_a3_trigger}', '${U.a3}', 'queued', now() - interval '60 seconds')`,
  );
  const res = await db.asService((tx) => startAi(tx));
  assert.equal(res.ai_status, "busy");
});

// ---------------------------------------------------------------------------
// 16. atomicity
// ---------------------------------------------------------------------------
test("#16 start_ai_run failing after the run insert -> no active run, no orphan placeholder", async (t) => {
  const db = await fresh(t);
  // Make the placeholder insert (the step AFTER inserting ai_runs) fail.
  await db.exec(`
    create function public.test_reject_ai_message() returns trigger language plpgsql as $$
    begin
      if new.sender_type = 'ai' then raise exception 'TEST_PLACEHOLDER_FAIL'; end if;
      return new;
    end $$;
    create trigger test_reject_ai_message before insert on public.messages
      for each row execute function public.test_reject_ai_message();
  `);
  const aiBefore = (await db.one("select count(*)::int n from public.messages where sender_type = 'ai'")).n;
  const runsBefore = (await db.one("select count(*)::int n from public.ai_runs")).n;

  // Like a PostgREST RPC call: one transaction that errors -> rolled back.
  await expectError(db.asService((tx) => startAi(tx), { commit: true }), "TEST_PLACEHOLDER_FAIL");

  assert.equal((await activeRuns((s, p) => db.query(s, p))).length, 0, "no active run left behind");
  assert.equal((await db.one("select count(*)::int n from public.ai_runs")).n, runsBefore);
  assert.equal((await db.one("select count(*)::int n from public.messages where sender_type = 'ai'")).n, aiBefore, "no orphan placeholder");

  // After the fault is removed, the room is not stuck "busy".
  await db.exec("drop trigger test_reject_ai_message on public.messages; drop function public.test_reject_ai_message();");
  const ok = await db.asService((tx) => startAi(tx), { commit: true });
  assert.equal(ok.ai_status, "started");
});

test("#16b start_ai_run with a trigger message from another room -> rejected, nothing created", async (t) => {
  const db = await fresh(t);
  const aiBefore = (await db.one("select count(*)::int n from public.messages where sender_type = 'ai'")).n;
  const runsBefore = (await db.one("select count(*)::int n from public.ai_runs")).n;
  // a2 is a member of R1 and authored R2 message ...011.
  await expectError(
    db.asService((tx) => startAi(tx, { msg: MSG.r2_a2, by: U.a2 }), { commit: true }),
    "NOT_ALLOWED",
  );
  // Someone else's message in the right room.
  await expectError(
    db.asService((tx) => startAi(tx, { msg: MSG.r1_a1, by: U.a3 }), { commit: true }),
    "NOT_ALLOWED",
  );
  // Requester not a member (a4).
  await expectError(
    db.asService((tx) => startAi(tx, { msg: MSG.r1_a3_trigger, by: U.a4 }), { commit: true }),
    "NOT_ALLOWED",
  );
  assert.equal((await db.one("select count(*)::int n from public.ai_runs")).n, runsBefore);
  assert.equal((await db.one("select count(*)::int n from public.messages where sender_type = 'ai'")).n, aiBefore);
});

// ---------------------------------------------------------------------------
// Extras
// ---------------------------------------------------------------------------
test("extra: authenticated/anon calling start_ai_run directly -> permission denied", async () => {
  await expectError(base.asUser(U.a3, (tx) => startAi(tx)), "permission denied");
  await expectError(base.asAnon((tx) => startAi(tx)), "permission denied");
  const priv = await base.one(`
    select has_function_privilege('anon', 'public.start_ai_run(uuid,uuid,uuid,int,int)', 'EXECUTE') anon,
           has_function_privilege('authenticated', 'public.start_ai_run(uuid,uuid,uuid,int,int)', 'EXECUTE') auth,
           has_function_privilege('service_role', 'public.start_ai_run(uuid,uuid,uuid,int,int)', 'EXECUTE') svc`);
  assert.deepEqual(priv, { anon: false, auth: false, svc: true });
});

test("extra: rate limit -> 'rate_limited'", async (t) => {
  const db = await fresh(t);
  // Seed run is ~2.75h old, so the per-user counter starts at 0.
  const first = await db.asService((tx) => startAi(tx, { userLimit: 1 }), { commit: true });
  assert.equal(first.ai_status, "started");
  await db.query("update public.ai_runs set status = 'succeeded', finished_at = now() where id = $1", [first.run_id]);

  const userLimited = await db.asService((tx) => startAi(tx, { userLimit: 1 }));
  assert.deepEqual(userLimited, { run_id: null, placeholder_message_id: null, ai_status: "rate_limited" });

  // Room limit applies to other members too.
  const roomLimited = await db.asService((tx) => startAi(tx, { msg: MSG.r1_a1_newest, by: U.a1, roomLimit: 1 }));
  assert.equal(roomLimited.ai_status, "rate_limited");

  // Different user, room limit not reached -> started.
  const other = await db.asService((tx) => startAi(tx, { msg: MSG.r1_a1_newest, by: U.a1, userLimit: 1, roomLimit: 5 }));
  assert.equal(other.ai_status, "started");
});

test("extra: AI disabled (global or room) -> 'disabled'", async (t) => {
  const db = await fresh(t);
  await db.asOwner(async (tx) => {
    await tx.query("update public.rooms set ai_enabled = false where id = $1", [ROOM.r1]);
    await become(tx, "service_role");
    assert.equal((await startAi(tx)).ai_status, "disabled");
  });
  await db.asOwner(async (tx) => {
    await tx.query("update public.app_settings set ai_enabled = false where id = 1");
    await become(tx, "service_role");
    assert.equal((await startAi(tx)).ai_status, "disabled");
  });
  assert.equal((await db.one("select count(*)::int n from public.ai_runs where status in ('queued','running')")).n, 0);
});

test("extra: invitation INSERT for a user not enrolled in the course -> denied", async () => {
  await base.asOwner(async (tx) => {
    // Control: a1 can invite a5 (enrolled in CS-201, not a member).
    await become(tx, U.a1);
    await tx.savepoint(async () => {
      const ok = await tx.query(
        "insert into public.room_invitations (room_id, inviter_id, invitee_user_id) values ($1, $2, $3) returning id",
        [ROOM.r1, U.a1, U.a5],
      );
      assert.equal(ok.rows.length, 1);
      throw new Error("rollback-savepoint");
    }).catch((e) => {
      if (e.message !== "rollback-savepoint") throw e;
    });

    // Admin has no enrollments at all.
    await tx.expectError(
      "insert into public.room_invitations (room_id, inviter_id, invitee_user_id) values ($1, $2, $3)",
      [ROOM.r1, U.a1, U.admin],
      "row-level security",
    );

    // a5's CS-201 enrollment archived -> no longer invitable.
    await become(tx, "owner");
    await tx.query("update public.enrollments set status = 'archived' where user_id = $1 and course_id = $2", [U.a5, COURSE.cs201]);
    await become(tx, U.a1);
    await tx.expectError(
      "insert into public.room_invitations (room_id, inviter_id, invitee_user_id) values ($1, $2, $3)",
      [ROOM.r1, U.a1, U.a5],
      "row-level security",
    );

    // Non-member (a4) cannot invite into R1.
    await become(tx, "owner");
    await tx.query("update public.enrollments set status = 'active' where user_id = $1 and course_id = $2", [U.a5, COURSE.cs201]);
    await become(tx, U.a4);
    await tx.expectError(
      "insert into public.room_invitations (room_id, inviter_id, invitee_user_id) values ($1, $2, $3)",
      [ROOM.r1, U.a4, U.a5],
      "row-level security",
    );
  });
  // Nothing persisted, I2 untouched.
  const i2 = await base.one("select status from public.room_invitations where id = $1", [INV.i2_a5_expired]);
  assert.equal(i2.status, "pending");
});

test("extra: accept by an invitee no longer enrolled -> NOT_ALLOWED", async () => {
  await base.asOwner(async (tx) => {
    await tx.query("update public.enrollments set status = 'archived' where user_id = $1 and course_id = $2", [U.a4, COURSE.cs201]);
    await become(tx, U.a4);
    await tx.expectError("select public.accept_room_invitation($1)", [INV.i1_a4_valid], "NOT_ALLOWED");
  });
});

test("extra: room INSERT makes the creator an active 'owner' member atomically", async () => {
  await base.asUser(U.a4, async (tx) => {
    const id = "11111111-1111-4111-8111-111111111111";
    await tx.query(
      "insert into public.rooms (id, course_id, created_by, name) values ($1, $2, $3, 'Study group')",
      [id, COURSE.cs201, U.a4],
    );
    const { rows } = await tx.query(
      "select user_id::text, role, left_at from public.room_members where room_id = $1",
      [id],
    );
    assert.deepEqual(rows, [{ user_id: U.a4, role: "owner", left_at: null }]);
    // Creator can post immediately.
    const m = await tx.query(
      "insert into public.messages (room_id, sender_id, sender_type, content) values ($1, $2, 'user', 'hi') returning id",
      [id, U.a4],
    );
    assert.equal(m.rows.length, 1);
    // Cannot create a room as someone else, or in a course one is not enrolled in.
    await tx.expectError(
      "insert into public.rooms (course_id, created_by, name) values ($1, $2, 'x')",
      [COURSE.cs201, U.a1],
      "row-level security",
    );
    await tx.expectError(
      "insert into public.rooms (course_id, created_by, name) values ($1, $2, 'x')",
      [COURSE.math110, U.a4],
      "row-level security",
    );
  });
});

test("extra: leave_room then messages are invisible (and ownership hands off)", async () => {
  await base.asUser(U.a1, async (tx) => {
    const beforeN = (await tx.one("select count(*)::int n from public.messages where room_id = $1", [ROOM.r1])).n;
    assert.equal(beforeN, 5);
    await tx.query("select public.leave_room($1)", [ROOM.r1]);
    const afterN = (await tx.one("select count(*)::int n from public.messages where room_id = $1", [ROOM.r1])).n;
    assert.equal(afterN, 0);
    await tx.expectError(
      "insert into public.messages (room_id, sender_id, sender_type, content) values ($1, $2, 'user', 'back?')",
      [ROOM.r1, U.a1],
      "row-level security",
    );
    await become(tx, "owner");
    const owners = await tx.query(
      "select user_id::text from public.room_members where room_id = $1 and role = 'owner' and left_at is null",
      [ROOM.r1],
    );
    assert.equal(owners.rows.length, 1);
    assert.notEqual(owners.rows[0].user_id, U.a1);
  });
});

test("extra: accepting someone else's invitation -> INVITATION_NOT_FOUND", async () => {
  await base.asUser(U.a5, async (tx) => {
    await tx.expectError("select public.accept_room_invitation($1)", [INV.i1_a4_valid], "INVITATION_NOT_FOUND");
  });
});
