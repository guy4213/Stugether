// supabase/tests/room_online_members.test.mjs
// 20261112000001_room_online_members.sql — list_open_rooms reports how many
// members (other than the caller) are online, for "חדרים פעילים עכשיו".
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "./db.mjs";
import { U, COURSE } from "./fixtures.mjs";

const OPEN_ROOM = "00000000-0000-0000-0005-000000000003"; // MATH-110, opened by a5

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

const listFor = (db, user) =>
  db.asUser(user, async (tx) => {
    const r = await tx.query(
      "select room_id::text, online_members::int, creator_avatar from public.list_open_rooms($1)",
      [[COURSE.math110]],
    );
    return r.rows.find((x) => x.room_id === OPEN_ROOM);
  });

test("list_open_rooms: online_members counts members seen in the last 5 minutes", async (t) => {
  const db = await fresh(t);

  await db.asOwner(
    (tx) =>
      tx.query(
        "update public.profiles set last_seen_at = now() - interval '1 hour' where id = $1",
        [U.a5],
      ),
    { commit: true },
  );
  assert.equal((await listFor(db, U.a1)).online_members, 0);

  await db.asOwner(
    (tx) =>
      tx.query(
        "update public.profiles set last_seen_at = now() - interval '1 minute' where id = $1",
        [U.a5],
      ),
    { commit: true },
  );
  assert.equal((await listFor(db, U.a1)).online_members, 1);
});

test("list_open_rooms: the caller is never counted as an online member", async (t) => {
  const db = await fresh(t);
  await db.asOwner(
    (tx) => tx.query("update public.profiles set last_seen_at = now() where id = $1", [U.a5]),
    { commit: true },
  );
  // a5 is the room's only member: seen from a5's own account, nobody else is online.
  const own = await listFor(db, U.a5);
  assert.ok(own, "a5 sees its own open room");
  assert.equal(own.online_members, 0);
});
