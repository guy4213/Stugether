// supabase/tests/message_search.test.mjs
// 20261112000013_message_search.sql — "חיפוש בשיחה" is a plain ILIKE read
// under the messages SELECT policy: members only, no one else's deleted
// messages, no content for a Super Admin who is not a member.
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

const search = (db, user, roomId, q) =>
  db.asUser(user, async (tx) => {
    const r = await tx.query(
      "select id::text from public.messages where room_id = $1 and deleted_at is null and content ilike $2",
      [roomId, `%${q}%`],
    );
    return r.rows.map((x) => x.id);
  });

test("message search: the trigram indexes exist", async () => {
  const r = await base.query(
    "select indexname from pg_indexes where indexname in ('messages_content_trgm_idx', 'direct_messages_content_trgm_idx') order by 1",
  );
  assert.deepEqual(
    r.rows.map((x) => x.indexname),
    ["direct_messages_content_trgm_idx", "messages_content_trgm_idx"],
  );
});

test("message search: a member finds the room's messages; a non-member finds nothing", async (t) => {
  const db = await fresh(t);
  const word = "חיפושבדיקה";
  await db.asUser(
    U.a1,
    (tx) =>
      tx.query(
        "insert into public.messages (room_id, sender_id, sender_type, content) values ($1, $2, 'user', $3)",
        [ROOM.r1, U.a1, `שורה עם ${word} בתוכה`],
      ),
    { commit: true },
  );

  assert.equal((await search(db, U.a2, ROOM.r1, word)).length, 1, "member of R1");
  assert.equal((await search(db, U.a4, ROOM.r1, word)).length, 0, "not a member of R1");
  assert.equal((await search(db, U.admin, ROOM.r1, word)).length, 0, "super admin: no content");
});

test("message search: someone else's deleted message is never found", async (t) => {
  const db = await fresh(t);
  const word = "נמחקהבדיקה";
  const { id } = await db.asUser(
    U.a3,
    (tx) =>
      tx.one(
        "insert into public.messages (room_id, sender_id, sender_type, content) values ($1, $2, 'user', $3) returning id::text",
        [ROOM.r1, U.a3, word],
      ),
    { commit: true },
  );
  await db.asUser(U.a3, (tx) => tx.query("select public.soft_delete_message($1)", [id]), {
    commit: true,
  });
  const r = await db.asUser(U.a2, async (tx) =>
    tx.query("select id from public.messages where room_id = $1 and content ilike $2", [
      ROOM.r1,
      `%${word}%`,
    ]),
  );
  assert.equal(r.rows.length, 0);
});
