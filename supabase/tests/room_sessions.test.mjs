// supabase/tests/room_sessions.test.mjs
// 20261013000006_room_sessions.sql — propose / vote / schedule / RSVP a
// future study session with the same group.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "./db.mjs";
import { U, ROOM } from "./fixtures.mjs";

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

// R1 (active): a1 creator + a2 + a3. a4 is not a member. R2 is archived.
const inDays = (d, h = 18) =>
  `(date_trunc('day', now()) + interval '${d} days' + interval '${h} hours')`;

test("sessions: propose several times, vote, the proposer schedules; members are notified", async (t) => {
  const db = await fresh(t);
  const session = await db.asUser(
    U.a2,
    (tx) =>
      tx.one(
        `select public.propose_room_session($1, array[${inDays(2)}, ${inDays(3)}]::timestamptz[], 90, ' חזרה לבוחן ') id`,
        [ROOM.r1],
      ),
    { commit: true },
  );
  const s = await db.one(
    "select status, note, duration_min from public.room_sessions where id = $1",
    [session.id],
  );
  assert.deepEqual([s.status, s.note, s.duration_min], ["proposed", "חזרה לבוחן", 90]);

  // a1 and a3 got "session_proposed"; the proposer did not.
  const notified = await db.query(
    "select user_id::text from public.notifications where session_id = $1 and type = 'session_proposed' order by 1",
    [session.id],
  );
  assert.deepEqual(
    notified.rows.map((r) => r.user_id),
    [U.a1, U.a3].sort(),
  );

  const options = (
    await db.query(
      "select id::text from public.room_session_options where session_id = $1 order by starts_at",
      [session.id],
    )
  ).rows.map((r) => r.id);
  await db.asUser(
    U.a3,
    (tx) => tx.query("select public.vote_room_session($1, true)", [options[1]]),
    {
      commit: true,
    },
  );

  // A non-member can neither read nor vote; a plain member cannot schedule.
  await db.asUser(U.a4, async (tx) => {
    assert.equal((await tx.query("select 1 from public.room_sessions")).rows.length, 0);
    await tx.expectError("select public.vote_room_session($1, true)", [options[0]], "NOT_ALLOWED");
  });
  await db.asUser(U.a3, (tx) =>
    tx.expectError("select public.schedule_room_session($1)", [options[1]], "NOT_ALLOWED"),
  );

  await db.asUser(U.a2, (tx) => tx.query("select public.schedule_room_session($1)", [options[1]]), {
    commit: true,
  });
  const scheduled = await db.one(
    `select s.status, s.starts_at = o.starts_at same_time,
            (select array_agg(user_id::text order by user_id) from public.room_session_rsvps r
              where r.session_id = s.id and r.response = 'accepted') coming
       from public.room_sessions s join public.room_session_options o on o.id = $2
      where s.id = $1`,
    [session.id, options[1]],
  );
  assert.equal(scheduled.status, "scheduled");
  assert.equal(scheduled.same_time, true);
  assert.deepEqual(scheduled.coming, [U.a2, U.a3].sort(), "proposer + voters are coming");

  // a1 declines; votes are closed now.
  await db.asUser(U.a1, async (tx) => {
    await tx.query("select public.rsvp_room_session($1, 'declined')", [session.id]);
    await tx.expectError(
      "select public.vote_room_session($1, true)",
      [options[0]],
      "SESSION_NOT_OPEN",
    );
  });
  const sched = await db.one(
    "select count(*)::int n from public.notifications where session_id = $1 and type = 'session_scheduled'",
    [session.id],
  );
  assert.equal(sched.n, 2);
});

test("sessions: one time schedules at once; past times, 6 options and read-only rooms are refused", async (t) => {
  const db = await fresh(t);
  const one = await db.asUser(
    U.a1,
    (tx) =>
      tx.one(
        `select public.propose_room_session($1, array[${inDays(1)}]::timestamptz[], 60, null) id`,
        [ROOM.r1],
      ),
    { commit: true },
  );
  const s = await db.one(
    "select status, starts_at is not null has_time from public.room_sessions where id = $1",
    [one.id],
  );
  assert.deepEqual([s.status, s.has_time], ["scheduled", true]);

  await db.asUser(U.a1, async (tx) => {
    await tx.expectError(
      `select public.propose_room_session('${ROOM.r1}', array[now() - interval '1 hour']::timestamptz[], 60, null)`,
      "OPTION_IN_PAST",
    );
    await tx.expectError(
      `select public.propose_room_session('${ROOM.r1}', array[${[1, 2, 3, 4, 5, 6].map((d) => inDays(d)).join(",")}]::timestamptz[], 60, null)`,
      "BAD_OPTIONS",
    );
    await tx.expectError(
      `insert into public.room_sessions (room_id, proposed_by) values ('${ROOM.r1}', '${U.a1}')`,
      "permission denied",
    );
  });
  // R2 is archived: nobody can plan there until it is reactivated.
  await db.asUser(U.a2, (tx) =>
    tx.expectError(
      `select public.propose_room_session('${ROOM.r2}', array[${inDays(1)}]::timestamptz[], 60, null)`,
      "NOT_ALLOWED",
    ),
  );

  // The creator cancels; unread notifications about it disappear.
  await db.asUser(U.a1, (tx) => tx.query("select public.cancel_room_session($1)", [one.id]), {
    commit: true,
  });
  const left = await db.one(
    "select (select status from public.room_sessions where id = $1) status, (select count(*)::int from public.notifications where session_id = $1) notes",
    [one.id],
  );
  assert.deepEqual([left.status, left.notes], ["cancelled", 0]);
});
