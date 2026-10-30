// supabase/tests/room_seat_watches.test.mjs
// 20261030000002_room_seat_watches.sql — "עדכנו כשמתפנה" on a full open room.
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

// R1 (active, CS-201): a1 owner + a2 + a3. a4 and a5 are in CS-201, not members.
async function openR1(db) {
  await db.query("update public.rooms set is_open = true where id = $1", [ROOM.r1]);
}

test("seat watch: a classmate watches, a member leaves, the watcher is notified once", async (t) => {
  const db = await fresh(t);
  await openR1(db);
  await db.asUser(U.a4, (tx) => tx.query("select public.watch_room_seat($1, true)", [ROOM.r1]), {
    commit: true,
  });
  // Idempotent.
  await db.asUser(U.a4, (tx) => tx.query("select public.watch_room_seat($1, true)", [ROOM.r1]), {
    commit: true,
  });
  await db.asUser(U.a4, async (tx) => {
    const own = await tx.query("select room_id::text from public.room_seat_watches");
    assert.deepEqual(
      own.rows.map((r) => r.room_id),
      [ROOM.r1],
    );
  });
  // Other users don't see my watch.
  await db.asUser(U.a5, async (tx) => {
    assert.equal((await tx.query("select 1 from public.room_seat_watches")).rows.length, 0);
  });

  await db.asUser(U.a3, (tx) => tx.query("select public.leave_room($1)", [ROOM.r1]), {
    commit: true,
  });

  const notes = await db.query(
    "select user_id::text, type, title from public.notifications where room_id = $1 and title = 'התפנה מקום בחדר'",
    [ROOM.r1],
  );
  assert.deepEqual(
    notes.rows.map((r) => [r.user_id, r.type]),
    [[U.a4, "room_opened"]],
  );
  const left = await db.query("select 1 from public.room_seat_watches where room_id = $1", [
    ROOM.r1,
  ]);
  assert.equal(left.rows.length, 0);
});

test("seat watch: closed rooms, members and other courses are refused; unwatch works", async (t) => {
  const db = await fresh(t);
  // R1 is not open yet.
  await db.asUser(U.a4, (tx) =>
    tx.expectError("select public.watch_room_seat($1, true)", [ROOM.r1], "NOT_ALLOWED"),
  );
  await openR1(db);
  await db.asUser(U.a2, (tx) =>
    tx.expectError("select public.watch_room_seat($1, true)", [ROOM.r1], "ALREADY_MEMBER"),
  );
  await db.asUser(U.a4, async (tx) => {
    await tx.query("select public.watch_room_seat($1, true)", [ROOM.r1]);
    await tx.query("select public.watch_room_seat($1, false)", [ROOM.r1]);
    assert.equal((await tx.query("select 1 from public.room_seat_watches")).rows.length, 0);
    await tx.expectError(
      `insert into public.room_seat_watches (room_id, user_id) values ('${ROOM.r1}', '${U.a4}')`,
      "permission denied",
    );
  });
});
