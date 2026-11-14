// supabase/tests/room_settings.test.mjs
// 20261112000014_room_settings_no_archive.sql — the room settings dialog:
// update_room(p_is_open) for the owner of an active room only; archived
// rooms became closed.
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

const isOpen = async (db, roomId) =>
  (await db.one("select is_open from public.rooms where id = $1", [roomId])).is_open;

test("room settings: the owner opens and closes the room to classmates", async (t) => {
  const db = await fresh(t);
  await db.asUser(
    U.a1,
    (tx) => tx.query("select public.update_room($1, null, null, null, true)", [ROOM.r1]),
    { commit: true },
  );
  assert.equal(await isOpen(db, ROOM.r1), true);
  await db.asUser(
    U.a1,
    (tx) => tx.query("select public.update_room($1, null, null, null, false)", [ROOM.r1]),
    { commit: true },
  );
  assert.equal(await isOpen(db, ROOM.r1), false);
});

test("room settings: a member, a non-member and a closed room are refused", async (t) => {
  const db = await fresh(t);
  await db.asUser(U.a2, (tx) =>
    tx.expectError(
      "select public.update_room($1, null, null, null, true)",
      [ROOM.r1],
      "NOT_ALLOWED",
    ),
  );
  await db.asUser(U.a4, (tx) =>
    tx.expectError(
      "select public.update_room($1, null, null, null, true)",
      [ROOM.r1],
      "NOT_ALLOWED",
    ),
  );
  // R2 is closed (it was the seed's archived room).
  assert.equal(
    (await db.one("select status from public.rooms where id = $1", [ROOM.r2])).status,
    "closed",
  );
  await db.asUser(U.a2, (tx) =>
    tx.expectError(
      "select public.update_room($1, null, null, null, true)",
      [ROOM.r2],
      "ROOM_NOT_ACTIVE",
    ),
  );
});
