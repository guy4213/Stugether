// supabase/tests/owner_leave_deletes_room.test.mjs
// 20261112000003_owner_leave_deletes_room.sql — a room lives as long as its
// owner stays: the owner leaving deletes it (and everything in it), the other
// members are notified. A member leaving and an owner being deactivated work
// as before.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "./db.mjs";
import { U, ROOM, INV } from "./fixtures.mjs";

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

const count = async (db, table, roomId) =>
  (await db.one(`select count(*)::int n from public.${table} where room_id = $1`, [roomId])).n;

// R1 (active, CS-201): a1 owner + a2 + a3, 28 messages, invitation I1 (a4).
// R2 (closed, MATH-110): a2 owner + a5.

test("owner leaves: the room and all its content are deleted, the others are notified", async (t) => {
  const db = await fresh(t);
  await db.query(
    `insert into public.room_exercises (room_id, created_by, title, file_path, file_name, file_type)
     values ($1, $2, 'דף עבודה', $3, 'sheet.pdf', 'application/pdf')`,
    [ROOM.r1, U.a1, `${ROOM.r1}/sheet.pdf`],
  );
  await db.query(
    "insert into public.room_exercises (room_id, created_by, title, content) values ($1, $2, 'טקסט', 'פתרו')",
    [ROOM.r1, U.a1],
  );
  assert.ok((await count(db, "messages", ROOM.r1)) > 0);
  assert.ok((await count(db, "room_invitations", ROOM.r1)) > 0);

  const res = await db.asUser(U.a1, (tx) => tx.one("select public.leave_room($1) r", [ROOM.r1]), {
    commit: true,
  });
  assert.deepEqual(res.r, { room_deleted: true, file_paths: [`${ROOM.r1}/sheet.pdf`] });

  assert.equal(
    (await db.query("select 1 from public.rooms where id = $1", [ROOM.r1])).rows.length,
    0,
  );
  for (const table of [
    "room_members",
    "messages",
    "ai_runs",
    "room_invitations",
    "room_exercises",
    "room_sessions",
    "room_join_requests",
    "notifications",
  ]) {
    assert.equal(await count(db, table, ROOM.r1), 0, `${table} of R1 must be gone`);
  }
  assert.equal(
    (await db.query("select 1 from public.room_invitations where id = $1", [INV.i1_a4_valid])).rows
      .length,
    0,
  );

  const notes = await db.query(
    "select user_id::text, actor_id::text, room_id, category, title from public.notifications where type = 'room_deleted' order by user_id",
  );
  assert.deepEqual(
    notes.rows.map((n) => n.user_id),
    [U.a2, U.a3].sort(),
  );
  for (const n of notes.rows) {
    assert.equal(n.actor_id, U.a1);
    assert.equal(n.room_id, null);
    assert.equal(n.category, "rooms");
    assert.match(n.title, /נמחק/);
  }

  // Whoever is in the room gets told to leave the screen.
  const sent = await db.query(
    "select payload from realtime.messages where event = 'room_deleted' and topic = $1",
    [`room:${ROOM.r1}`],
  );
  assert.deepEqual(
    sent.rows.map((r) => r.payload),
    [{ room_id: ROOM.r1 }],
  );

  // The members' notifications are theirs to read.
  await db.asUser(U.a2, async (tx) => {
    const own = await tx.query("select 1 from public.notifications where type = 'room_deleted'");
    assert.equal(own.rows.length, 1);
  });
});

test("owner alone in the room leaves: deleted, nobody to notify", async (t) => {
  const db = await fresh(t);
  for (const who of [U.a2, U.a3]) {
    await db.asUser(who, (tx) => tx.query("select public.leave_room($1)", [ROOM.r1]), {
      commit: true,
    });
  }
  const res = await db.asUser(U.a1, (tx) => tx.one("select public.leave_room($1) r", [ROOM.r1]), {
    commit: true,
  });
  assert.equal(res.r.room_deleted, true);
  assert.deepEqual(res.r.file_paths, []);
  assert.equal(
    (await db.query("select 1 from public.rooms where id = $1", [ROOM.r1])).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select 1 from public.notifications where type = 'room_deleted'")).rows.length,
    0,
  );
});

test("owner of a read-only room leaves: deleted too", async (t) => {
  const db = await fresh(t);
  const status = await db.one("select status from public.rooms where id = $1", [ROOM.r2]);
  assert.notEqual(status.status, "active");
  const res = await db.asUser(U.a2, (tx) => tx.one("select public.leave_room($1) r", [ROOM.r2]), {
    commit: true,
  });
  assert.equal(res.r.room_deleted, true);
  assert.equal(
    (await db.query("select 1 from public.rooms where id = $1", [ROOM.r2])).rows.length,
    0,
  );
  const notes = await db.query(
    "select user_id::text from public.notifications where type = 'room_deleted'",
  );
  assert.deepEqual(
    notes.rows.map((n) => n.user_id),
    [U.a5],
  );
});

test("a member leaves: the room stays, the owner stays", async (t) => {
  const db = await fresh(t);
  const res = await db.asUser(U.a3, (tx) => tx.one("select public.leave_room($1) r", [ROOM.r1]), {
    commit: true,
  });
  assert.deepEqual(res.r, { room_deleted: false });
  const room = await db.query("select 1 from public.rooms where id = $1", [ROOM.r1]);
  assert.equal(room.rows.length, 1);
  const owners = await db.query(
    "select user_id::text from public.room_members where room_id = $1 and role = 'owner' and left_at is null",
    [ROOM.r1],
  );
  assert.deepEqual(
    owners.rows.map((r) => r.user_id),
    [U.a1],
  );
  assert.equal(
    (await db.query("select 1 from public.notifications where type = 'room_deleted'")).rows.length,
    0,
  );
});

test("the owner is deactivated: ownership is handed off, the room is kept", async (t) => {
  const db = await fresh(t);
  await db.asOwner(
    (tx) => tx.query("update public.profiles set is_active = false where id = $1", [U.a1]),
    { commit: true },
  );
  assert.equal(
    (await db.query("select 1 from public.rooms where id = $1", [ROOM.r1])).rows.length,
    1,
  );
  const owner = await db.one(
    "select user_id::text from public.room_members where room_id = $1 and role = 'owner' and left_at is null",
    [ROOM.r1],
  );
  assert.notEqual(owner.user_id, U.a1);
  assert.equal(
    (await db.query("select 1 from public.notifications where type = 'room_deleted'")).rows.length,
    0,
  );
});

test("leave_room: not a member -> NOT_A_MEMBER, the room is untouched", async (t) => {
  const db = await fresh(t);
  await db.asUser(U.a4, (tx) =>
    tx.expectError("select public.leave_room($1)", [ROOM.r1], "NOT_A_MEMBER"),
  );
  assert.equal(
    (await db.query("select 1 from public.rooms where id = $1", [ROOM.r1])).rows.length,
    1,
  );
});
