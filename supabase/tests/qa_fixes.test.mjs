// supabase/tests/qa_fixes.test.mjs
// 20261021000001_qa_fixes.sql — fixes from the QA pass on the 13.10.2026
// changes: join approval cannot be skipped, the current owner decides,
// read-only rooms drop what was waiting, one open study session per room.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "./db.mjs";
import { U, ROOM, COURSE } from "./fixtures.mjs";

let base;
before(async () => {
  base = await createDb();
});
after(async () => {
  await base?.close();
});

async function fresh(t) {
  const db = await base.fork();
  t.after(() => db.close());
  return db;
}

// R1: CS-201, a1 owner + a2 + a3, open and in session. a4 is enrolled in CS-201.
async function liveRoom(t) {
  const db = await fresh(t);
  await db.asOwner(
    (tx) =>
      tx.query(
        `update public.rooms set is_open = true, created_at = now() - interval '1 day',
                last_message_at = now() - interval '5 minutes'
          where id = $1`,
        [ROOM.r1],
      ),
    { commit: true },
  );
  return db;
}

const isMember = (db, user, room = ROOM.r1) =>
  db
    .one(
      "select count(*)::int n from public.room_members where room_id = $1 and user_id = $2 and left_at is null",
      [room, user],
    )
    .then((r) => r.n === 1);

const request = (db, user) =>
  db.asUser(user, (tx) => tx.one("select public.request_room_join($1) s", [ROOM.r1]), {
    commit: true,
  });

const pendingId = (db, user) =>
  db
    .one(
      "select id::text from public.room_join_requests where user_id = $1 and status = 'pending'",
      [user],
    )
    .then((r) => r?.id);

const inDays = (d, h = 18) =>
  `(date_trunc('day', now()) + interval '${d} days' + interval '${h} hours')`;

const propose = (db, user, days, room = ROOM.r1) =>
  db.asUser(
    user,
    (tx) =>
      tx.one(
        `select public.propose_room_session($1, array[${days.map((d) => inDays(d)).join(",")}]::timestamptz[], 60, null) id`,
        [room],
      ),
    { commit: true },
  );

test("qa: join_open_room cannot be called directly to skip the approval", async (t) => {
  const db = await liveRoom(t);
  await db.asUser(U.a4, (tx) =>
    tx.expectError("select public.join_open_room($1)", [ROOM.r1], "permission denied"),
  );
  assert.equal((await request(db, U.a4)).s, "requested");
  assert.equal(await isMember(db, U.a4), false);
});

test("qa: after the creator leaves, the new owner decides; the creator does not", async (t) => {
  const db = await liveRoom(t);
  await db.asUser(U.a1, (tx) => tx.query("select public.leave_room($1)", [ROOM.r1]), {
    commit: true,
  });
  const owner = await db.one(
    "select user_id::text from public.room_members where room_id = $1 and role = 'owner' and left_at is null",
    [ROOM.r1],
  );
  assert.notEqual(owner.user_id, U.a1);

  await request(db, U.a4);
  const req = await pendingId(db, U.a4);
  const note = await db.one(
    "select user_id::text from public.notifications where request_id = $1 and type = 'room_join_request'",
    [req],
  );
  assert.equal(note.user_id, owner.user_id, "the request goes to the current owner");

  await db.asUser(U.a1, (tx) =>
    tx.expectError("select public.decide_room_join_request($1, true)", [req], "NOT_ROOM_OWNER"),
  );
  await db.asUser(owner.user_id, async (tx) => {
    assert.equal((await tx.query("select 1 from public.room_join_requests")).rows.length, 1);
  });
  const r = await db.asUser(
    owner.user_id,
    (tx) => tx.one("select public.decide_room_join_request($1, true) s", [req]),
    { commit: true },
  );
  assert.equal(r.s, "approved");
  assert.equal(await isMember(db, U.a4), true);
});

test("qa: approval re-checks enrollment; a declined requester waits before asking again", async (t) => {
  const db = await liveRoom(t);
  await request(db, U.a4);
  const req = await pendingId(db, U.a4);
  await db.asOwner(
    (tx) =>
      tx.query(
        "update public.enrollments set status = 'archived' where user_id = $1 and course_id = $2",
        [U.a4, COURSE.cs201],
      ),
    { commit: true },
  );
  const r = await db.asUser(
    U.a1,
    (tx) => tx.one("select public.decide_room_join_request($1, true) s", [req]),
    { commit: true },
  );
  assert.equal(r.s, "unavailable");
  assert.equal(await isMember(db, U.a4), false);
  const left = await db.one(
    "select status, (select count(*)::int from public.notifications where request_id = $1 and type = 'room_join_request') notes from public.room_join_requests where id = $1",
    [req],
  );
  assert.deepEqual([left.status, left.notes], ["cancelled", 0]);

  // Back in the course; declined → no new request for a while.
  await db.asOwner(
    (tx) =>
      tx.query(
        "update public.enrollments set status = 'active' where user_id = $1 and course_id = $2",
        [U.a4, COURSE.cs201],
      ),
    { commit: true },
  );
  await request(db, U.a4);
  await db.asUser(
    U.a1,
    async (tx) =>
      tx.query("select public.decide_room_join_request($1, false)", [await pendingId(db, U.a4)]),
    { commit: true },
  );
  await db.asUser(U.a4, (tx) =>
    tx.expectError("select public.request_room_join($1)", [ROOM.r1], "REQUEST_DECLINED_RECENTLY"),
  );
});

test("qa: archiving a room cancels its pending requests and open sessions", async (t) => {
  const db = await liveRoom(t);
  await request(db, U.a4);
  const req = await pendingId(db, U.a4);
  const session = await propose(db, U.a2, [2]);

  await db.asUser(
    U.a1,
    (tx) => tx.query("select public.set_room_status($1, 'archived')", [ROOM.r1]),
    {
      commit: true,
    },
  );
  const after = await db.one(
    `select (select status from public.room_join_requests where id = $1) req,
            (select count(*)::int from public.notifications where request_id = $1 and type = 'room_join_request') req_notes,
            (select status from public.room_sessions where id = $2) session,
            (select count(*)::int from public.notifications where session_id = $2 and read_at is null) session_notes`,
    [req, session.id],
  );
  assert.deepEqual(
    [after.req, after.req_notes, after.session, after.session_notes],
    ["cancelled", 0, "cancelled", 0],
  );

  // Back to active: the old request cannot be approved.
  await db.asUser(
    U.a1,
    (tx) => tx.query("select public.set_room_status($1, 'active')", [ROOM.r1]),
    {
      commit: true,
    },
  );
  await db.asUser(U.a1, (tx) =>
    tx.expectError(
      "select public.decide_room_join_request($1, true)",
      [req],
      "REQUEST_NOT_PENDING",
    ),
  );
});

test("qa: one open session per room; only the proposer or the owner replaces a proposal", async (t) => {
  const db = await fresh(t);
  const scheduled = await propose(db, U.a2, [2]);
  await db.asUser(U.a3, (tx) =>
    tx.expectError(
      `select public.propose_room_session('${ROOM.r1}', array[${inDays(3)}, ${inDays(4)}]::timestamptz[], 60, null)`,
      "SESSION_EXISTS",
    ),
  );
  await db.asUser(U.a2, (tx) => tx.query("select public.cancel_room_session($1)", [scheduled.id]), {
    commit: true,
  });
  await db.asUser(U.a2, (tx) =>
    tx.expectError("select public.cancel_room_session($1)", [scheduled.id], "SESSION_NOT_OPEN"),
  );

  const proposal = await propose(db, U.a2, [3, 4]);
  await db.asUser(U.a3, (tx) =>
    tx.expectError(
      `select public.propose_room_session('${ROOM.r1}', array[${inDays(5)}, ${inDays(6)}]::timestamptz[], 60, null)`,
      "PROPOSAL_EXISTS",
    ),
  );
  // The owner may replace it; the old proposal's unread notifications go.
  await propose(db, U.a1, [5, 6]);
  const old = await db.one(
    "select status, (select count(*)::int from public.notifications where session_id = $1 and read_at is null) notes from public.room_sessions where id = $1",
    [proposal.id],
  );
  assert.deepEqual([old.status, old.notes], ["cancelled", 0]);

  const open = await db.one(
    "select count(*)::int n from public.room_sessions where room_id = $1 and status <> 'cancelled'",
    [ROOM.r1],
  );
  assert.equal(open.n, 1);
});

test("qa: sessions — NULL times, votes on past times, RSVP in a read-only room", async (t) => {
  const db = await fresh(t);
  await db.asUser(U.a1, (tx) =>
    tx.expectError(
      `select public.propose_room_session('${ROOM.r1}', array[${inDays(2)}, null]::timestamptz[], 60, null)`,
      "BAD_OPTIONS",
    ),
  );

  const proposal = await propose(db, U.a1, [2, 3]);
  const option = await db.one(
    "select id::text from public.room_session_options where session_id = $1 order by starts_at limit 1",
    [proposal.id],
  );
  await db.asOwner(
    (tx) =>
      tx.query(
        "update public.room_session_options set starts_at = now() - interval '1 hour' where id = $1",
        [option.id],
      ),
    { commit: true },
  );
  await db.asUser(U.a3, (tx) =>
    tx.expectError("select public.vote_room_session($1, true)", [option.id], "OPTION_IN_PAST"),
  );

  // A scheduled session in a room that is closed behind the RPCs' back
  // (status set directly) still refuses RSVP: active rooms only.
  await db.asUser(U.a1, (tx) => tx.query("select public.cancel_room_session($1)", [proposal.id]), {
    commit: true,
  });
  const one = await propose(db, U.a1, [4]);
  await db.asOwner(
    async (tx) => {
      await tx.exec("alter table public.rooms disable trigger rooms_release_on_read_only");
      await tx.query("update public.rooms set status = 'archived' where id = $1", [ROOM.r1]);
    },
    { commit: true },
  );
  await db.asUser(U.a2, async (tx) => {
    await tx.expectError(
      "select public.rsvp_room_session($1, 'declined')",
      [one.id],
      "NOT_ALLOWED",
    );
    await tx.expectError("select public.cancel_room_session($1)", [one.id], "NOT_ALLOWED");
  });
});
