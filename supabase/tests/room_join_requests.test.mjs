// supabase/tests/room_join_requests.test.mjs
// 20261013000004_room_join_requests.sql — joining a room that is in session
// needs the creator's approval; a quiet open room is joined directly.
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

// R1: CS-201, created by a1, members a1 a2 a3. a4 is enrolled in CS-201.
async function openRoom(t, { live }) {
  const db = await base.fork();
  t.after(() => db.close());
  await db.asOwner(
    (tx) =>
      tx.query(
        `update public.rooms set is_open = true,
                created_at = now() - interval '1 day',
                last_message_at = now() - ($2 || ' minutes')::interval
          where id = $1`,
        [ROOM.r1, live ? "5" : "120"],
      ),
    { commit: true },
  );
  return db;
}

const isMember = (db, user) =>
  db
    .one(
      "select count(*)::int n from public.room_members where room_id = $1 and user_id = $2 and left_at is null",
      [ROOM.r1, user],
    )
    .then((r) => r.n === 1);

test("join requests: a quiet open room is joined directly", async (t) => {
  const db = await openRoom(t, { live: false });
  const r = await db.asUser(
    U.a4,
    (tx) => tx.one("select public.request_room_join($1) s", [ROOM.r1]),
    {
      commit: true,
    },
  );
  assert.equal(r.s, "joined");
  assert.equal(await isMember(db, U.a4), true);
});

test("join requests: a live room asks the creator; only the creator decides", async (t) => {
  const db = await openRoom(t, { live: true });

  const first = await db.asUser(
    U.a4,
    (tx) => tx.one("select public.request_room_join($1) s", [ROOM.r1]),
    { commit: true },
  );
  assert.equal(first.s, "requested");
  assert.equal(await isMember(db, U.a4), false);

  // Asking again does not create a second request.
  await db.asUser(U.a4, (tx) => tx.query("select public.request_room_join($1)", [ROOM.r1]), {
    commit: true,
  });
  const req = await db.one(
    "select id::text, count(*) over ()::int n from public.room_join_requests where room_id = $1 and user_id = $2",
    [ROOM.r1, U.a4],
  );
  assert.equal(req.n, 1);

  // The creator got a notification (category "invitations").
  const note = await db.one(
    "select count(*)::int n, min(category) c from public.notifications where user_id = $1 and type = 'room_join_request' and request_id = $2",
    [U.a1, req.id],
  );
  assert.deepEqual([note.n, note.c], [1, "invitations"]);

  // Visibility: requester and creator, not other members.
  await db.asUser(U.a2, async (tx) => {
    const seen = await tx.query("select 1 from public.room_join_requests");
    assert.equal(seen.rows.length, 0);
    await tx.expectError(
      "select public.decide_room_join_request($1, true)",
      [req.id],
      "NOT_ROOM_OWNER",
    );
    await tx.expectError(
      `insert into public.room_join_requests (room_id, user_id) values ('${ROOM.r1}', '${U.a2}')`,
      "permission denied",
    );
  });
  await db.asUser(U.a4, async (tx) => {
    const own = await tx.query("select status from public.room_join_requests");
    assert.equal(own.rows[0].status, "pending");
  });

  const decided = await db.asUser(
    U.a1,
    (tx) => tx.one("select public.decide_room_join_request($1, true) s", [req.id]),
    { commit: true },
  );
  assert.equal(decided.s, "approved");
  assert.equal(await isMember(db, U.a4), true);

  const answer = await db.one(
    "select title from public.notifications where user_id = $1 and type = 'room_join_decided'",
    [U.a4],
  );
  assert.match(answer.title, /אושרה/);
  await db.asUser(U.a1, (tx) =>
    tx.expectError(
      "select public.decide_room_join_request($1, false)",
      [req.id],
      "REQUEST_NOT_PENDING",
    ),
  );
});

test("join requests: decline, cancel and the 4-member cap", async (t) => {
  const db = await openRoom(t, { live: true });
  await db.asUser(U.a4, (tx) => tx.query("select public.request_room_join($1)", [ROOM.r1]), {
    commit: true,
  });
  const req = await db.one(
    "select id::text from public.room_join_requests where user_id = $1 and status = 'pending'",
    [U.a4],
  );
  await db.asUser(
    U.a1,
    (tx) => tx.query("select public.decide_room_join_request($1, false)", [req.id]),
    {
      commit: true,
    },
  );
  assert.equal(await isMember(db, U.a4), false);

  // A new request can be withdrawn; the creator's notification goes away.
  await db.asUser(U.a4, (tx) => tx.query("select public.request_room_join($1)", [ROOM.r1]), {
    commit: true,
  });
  await db.asUser(U.a4, (tx) => tx.query("select public.cancel_room_join_request($1)", [ROOM.r1]), {
    commit: true,
  });
  const left = await db.one(
    `select count(*) filter (where status = 'pending')::int pending,
            (select count(*)::int from public.notifications n
              join public.room_join_requests q on q.id = n.request_id
             where n.type = 'room_join_request' and q.status = 'cancelled') notes
       from public.room_join_requests where user_id = $1`,
    [U.a4],
  );
  assert.deepEqual([left.pending, left.notes], [0, 0]);

  // Room fills up while a request waits → approval fails with ROOM_FULL.
  await db.asUser(U.a4, (tx) => tx.query("select public.request_room_join($1)", [ROOM.r1]), {
    commit: true,
  });
  const waiting = await db.one(
    "select id::text from public.room_join_requests where user_id = $1 and status = 'pending'",
    [U.a4],
  );
  await db.asOwner(
    (tx) =>
      tx.query(
        "insert into public.room_members (room_id, user_id, role) values ($1, $2, 'member')",
        [ROOM.r1, U.a5],
      ),
    { commit: true },
  );
  await db.asUser(U.a1, (tx) =>
    tx.expectError("select public.decide_room_join_request($1, true)", [waiting.id], "ROOM_FULL"),
  );
});
