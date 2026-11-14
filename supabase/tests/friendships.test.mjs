// supabase/tests/friendships.test.mjs
// 20261112000003_friendships.sql — friend requests with approval.
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

const send = (db, from, to) =>
  db.asUser(from, (tx) => tx.one("select * from public.send_friend_request($1)", [to]), {
    commit: true,
  });

test("friend request: pending, notifies the addressee, visible only to the two sides", async (t) => {
  const db = await fresh(t);
  const row = await send(db, U.a1, U.a4);
  assert.equal(row.status, "pending");

  const n = await db.one(
    "select type, actor_id::text, friendship_id::text from public.notifications where user_id = $1 and type = 'friend_request'",
    [U.a4],
  );
  assert.deepEqual(n, { type: "friend_request", actor_id: U.a1, friendship_id: row.id });

  // A third student does not see a pending request.
  await db.asUser(U.a3, async (tx) => {
    const r = await tx.query("select 1 from public.friendships where id = $1", [row.id]);
    assert.equal(r.rows.length, 0);
  });
  // No direct writes.
  await db.asUser(U.a1, (tx) =>
    tx.expectError(
      "insert into public.friendships (requester_id, addressee_id) values ($1, $2)",
      [U.a1, U.a3],
      "permission denied",
    ),
  );
});

test("friend request: only the addressee responds; accepted is public and notifies back", async (t) => {
  const db = await fresh(t);
  const row = await send(db, U.a1, U.a4);

  await db.asUser(U.a1, (tx) =>
    tx.expectError(
      "select public.respond_friend_request($1, true)",
      [row.id],
      "FRIEND_REQUEST_NOT_FOUND",
    ),
  );
  await db.asUser(
    U.a4,
    (tx) => tx.query("select public.respond_friend_request($1, true)", [row.id]),
    {
      commit: true,
    },
  );

  const accepted = await db.one(
    "select count(*)::int n from public.notifications where user_id = $1 and type = 'friend_accepted'",
    [U.a1],
  );
  assert.equal(accepted.n, 1);
  // The request notification is marked read for the addressee.
  const req = await db.one(
    "select read_at is not null as read from public.notifications where user_id = $1 and type = 'friend_request'",
    [U.a4],
  );
  assert.equal(req.read, true);

  // Accepted friendships are visible to any active student.
  await db.asUser(U.a3, async (tx) => {
    const r = await tx.query("select status from public.friendships where id = $1", [row.id]);
    assert.deepEqual(r.rows, [{ status: "accepted" }]);
  });
  await db.asUser(U.a4, (tx) =>
    tx.expectError(
      "select public.respond_friend_request($1, false)",
      [row.id],
      "FRIEND_REQUEST_NOT_PENDING",
    ),
  );
});

test("friend request: asking back accepts; declined can be re-sent; remove is idempotent", async (t) => {
  const db = await fresh(t);
  const first = await send(db, U.a2, U.a3);
  const back = await send(db, U.a3, U.a2);
  assert.equal(back.id, first.id);
  assert.equal(back.status, "accepted");

  await db.asUser(U.a2, (tx) => tx.query("select public.remove_friend($1)", [U.a3]), {
    commit: true,
  });
  await db.asUser(U.a2, (tx) => tx.query("select public.remove_friend($1)", [U.a3]));
  const none = await db.one("select count(*)::int n from public.friendships");
  assert.equal(none.n, 0);

  const again = await send(db, U.a2, U.a3);
  await db.asUser(
    U.a3,
    (tx) => tx.query("select public.respond_friend_request($1, false)", [again.id]),
    {
      commit: true,
    },
  );
  const resent = await send(db, U.a2, U.a3);
  assert.equal(resent.status, "pending");
});

test("friend request: not to myself; a Super Admin may send and receive (14.11.2026)", async (t) => {
  const db = await fresh(t);
  await db.asUser(U.a1, (tx) =>
    tx.expectError("select public.send_friend_request($1)", [U.a1], "INVALID_FRIEND"),
  );
  const fromAdmin = await send(db, U.admin, U.a1);
  assert.equal(fromAdmin.status, "pending");
  const back = await send(db, U.a1, U.admin);
  assert.equal(back.status, "accepted");
  const toAdmin = await send(db, U.a2, U.admin);
  assert.equal(toAdmin.status, "pending");
});
