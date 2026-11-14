// supabase/tests/user_blocks.test.mjs
// 20261114000010_user_blocks.sql — blocking a student: no private chat, no
// friend request, hidden from each other's lists; unblock restores it.
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

async function fresh(t) {
  const db = await base.fork();
  t.after(() => db.close());
  return db;
}

const block = (db, who, whom) =>
  db.asUser(who, (tx) => tx.query("select public.block_user($1)", [whom]), { commit: true });

const openConv = (db, who, other) =>
  db.asUser(who, (tx) => tx.one("select public.open_conversation($1) as id", [other]), {
    commit: true,
  });

test("block: refuses a new conversation and new messages, both directions", async (t) => {
  const db = await fresh(t);
  const { id: convId } = await openConv(db, U.a1, U.a4);
  await db.asUser(
    U.a4,
    (tx) => tx.query("select public.send_direct_message($1, 'שלום')", [convId]),
    { commit: true },
  );

  await block(db, U.a1, U.a4);

  // The blocked student can't write, and neither can the blocker.
  await db.asUser(U.a4, (tx) =>
    tx.expectError("select public.send_direct_message($1, 'עוד')", [convId], "BLOCKED"),
  );
  await db.asUser(U.a1, (tx) =>
    tx.expectError("select public.send_direct_message($1, 'עוד')", [convId], "BLOCKED"),
  );
  await db.asUser(U.a4, (tx) =>
    tx.expectError("select public.open_conversation($1)", [U.a1], "BLOCKED"),
  );
  // History stays readable for both.
  await db.asUser(U.a1, async (tx) => {
    const r = await tx.query("select 1 from public.direct_messages where conversation_id = $1", [
      convId,
    ]);
    assert.equal(r.rows.length, 1);
  });
});

test("block: removes the friendship and refuses friend requests", async (t) => {
  const db = await fresh(t);
  const row = await db.asUser(
    U.a2,
    (tx) => tx.one("select * from public.send_friend_request($1)", [U.a3]),
    { commit: true },
  );
  assert.equal(row.status, "pending");

  await block(db, U.a3, U.a2);
  const left = await db.one("select count(*)::int n from public.friendships");
  assert.equal(left.n, 0);
  const notes = await db.one(
    "select count(*)::int n from public.notifications where user_id = $1 and type = 'friend_request' and read_at is null",
    [U.a3],
  );
  assert.equal(notes.n, 0);

  await db.asUser(U.a2, (tx) =>
    tx.expectError("select public.send_friend_request($1)", [U.a3], "BLOCKED"),
  );
  await db.asUser(U.a3, (tx) =>
    tx.expectError("select public.send_friend_request($1)", [U.a2], "BLOCKED"),
  );
});

test("block: hidden ids both ways; only the blocker sees the row; unblock restores", async (t) => {
  const db = await fresh(t);
  await block(db, U.a1, U.a2);
  // Idempotent.
  await block(db, U.a1, U.a2);

  const hidden = async (who) =>
    db.asUser(who, async (tx) =>
      (await tx.query("select public.list_hidden_user_ids() as id")).rows.map((r) => r.id),
    );
  assert.deepEqual(await hidden(U.a1), [U.a2]);
  assert.deepEqual(await hidden(U.a2), [U.a1]);
  assert.deepEqual(await hidden(U.a3), []);

  await db.asUser(U.a2, async (tx) => {
    const r = await tx.query("select 1 from public.user_blocks");
    assert.equal(r.rows.length, 0);
  });
  // No direct writes.
  await db.asUser(U.a2, (tx) =>
    tx.expectError(
      "insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2)",
      [U.a2, U.a3],
      "permission denied",
    ),
  );

  // Only the blocker can lift it.
  await db.asUser(U.a2, (tx) => tx.query("select public.unblock_user($1)", [U.a1]), {
    commit: true,
  });
  assert.deepEqual(await hidden(U.a2), [U.a1]);
  await db.asUser(U.a1, (tx) => tx.query("select public.unblock_user($1)", [U.a2]), {
    commit: true,
  });
  assert.deepEqual(await hidden(U.a2), []);
  await openConv(db, U.a2, U.a1);
});

test("block: not myself; a Super Admin may block and be blocked (14.11.2026)", async (t) => {
  const db = await fresh(t);
  await db.asUser(U.a1, (tx) =>
    tx.expectError("select public.block_user($1)", [U.a1], "INVALID_ARGUMENT"),
  );
  await block(db, U.a1, U.admin);
  await db.asUser(U.admin, (tx) =>
    tx.expectError("select public.open_conversation($1)", [U.a1], "BLOCKED"),
  );
  await block(db, U.admin, U.a2);
  await db.asUser(U.a2, (tx) =>
    tx.expectError("select public.send_friend_request($1)", [U.admin], "BLOCKED"),
  );
});
