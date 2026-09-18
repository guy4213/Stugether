// supabase/tests/rls.test.mjs
// TECHNICAL_SPEC.md §11 — RLS verification tests 1-10, against the seed fixture.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "./db.mjs";
import { U, ROOM, MSG, COURSE, become } from "./fixtures.mjs";

let db;
before(async () => {
  db = await createDb();
});
after(async () => {
  await db?.close();
});

const countMessages = async (tx, roomId) =>
  Number(
    (
      await tx.one("select count(*)::int n from public.messages where room_id = $1", [roomId])
    ).n,
  );

test("RLS #1: non-member SELECT messages -> 0 rows", async () => {
  // Control: a member sees the room history (5 seed messages in R1).
  const member = await db.asUser(U.a1, (tx) => countMessages(tx, ROOM.r1));
  assert.equal(member, 5, "control: member a1 should see R1 history");

  // a4 is enrolled in CS-201 (same course) but is not a member of R1.
  await db.asUser(U.a4, async (tx) => {
    assert.equal(await countMessages(tx, ROOM.r1), 0);
    const all = await tx.one("select count(*)::int n from public.messages");
    assert.equal(all.n, 0, "a4 is a member of no room -> sees no messages at all");
    const byId = await tx.query("select 1 from public.messages where id = $1", [MSG.r1_a1]);
    assert.equal(byId.rows.length, 0);
  });
});

test("RLS #2: non-member cannot use realtime topic room:<id>; member can", async () => {
  const topic = `room:${ROOM.r1}`;
  const nonMember = await db.realtimeAccess(U.a4, topic);
  assert.deepEqual(nonMember, { read: false, write: false }, "non-member broadcast");
  const nonMemberPresence = await db.realtimeAccess(U.a4, topic, { extension: "presence" });
  assert.deepEqual(nonMemberPresence, { read: false, write: false }, "non-member presence");

  const member = await db.realtimeAccess(U.a1, topic);
  assert.deepEqual(member, { read: true, write: true }, "member broadcast");

  const anon = await db.realtimeAccess(null, topic);
  assert.deepEqual(anon, { read: false, write: false }, "anon");

  // Explicit form: SELECT on realtime.messages with the topic set returns 0 rows.
  await db.asOwner(async (tx) => {
    await tx.query(`select set_config('realtime.topic', $1, true)`, [topic]);
    await tx.query(
      `insert into realtime.messages (topic, extension, private, event, payload)
       values ($1, 'broadcast', true, 'typing', '{}'::jsonb)`,
      [topic],
    );
    await become(tx, U.a4);
    const { rows } = await tx.query("select 1 from realtime.messages where topic = $1", [topic]);
    assert.equal(rows.length, 0);
    await tx.expectError(
      `insert into realtime.messages (topic, extension, private, event, payload)
       values ($1, 'broadcast', true, 'typing', '{}'::jsonb)`,
      [topic],
      "row-level security",
    );
    // Garbage topic must not raise a cast error, just deny.
    await tx.query(`select set_config('realtime.topic', 'room:not-a-uuid', true)`);
    const g = await tx.query("select 1 from realtime.messages");
    assert.equal(g.rows.length, 0);
  });
});

test("RLS #3: authenticated INSERT message with sender_type 'ai' -> denied", async () => {
  await db.asUser(U.a1, async (tx) => {
    await tx.expectError(
      `insert into public.messages (room_id, sender_id, sender_type, content)
       values ($1, null, 'ai', 'fake ai answer')`,
      [ROOM.r1],
      "row-level security",
    );
    await tx.expectError(
      `insert into public.messages (room_id, sender_id, sender_type, content)
       values ($1, null, 'system', 'fake system')`,
      [ROOM.r1],
      "row-level security",
    );
    // Control: a normal user message by the same member is allowed.
    const ok = await tx.query(
      `insert into public.messages (room_id, sender_id, sender_type, content)
       values ($1, $2, 'user', 'hello') returning id`,
      [ROOM.r1, U.a1],
    );
    assert.equal(ok.rows.length, 1);
  });
});

test("RLS #4: member who left (left_at set) SELECT messages -> 0 rows", async () => {
  await db.asOwner(async (tx) => {
    await become(tx, U.a3);
    assert.equal(await countMessages(tx, ROOM.r1), 5, "control: a3 sees history while active");
    await become(tx, "owner");
    await tx.query(
      "update public.room_members set left_at = now() where room_id = $1 and user_id = $2",
      [ROOM.r1, U.a3],
    );
    await become(tx, U.a3);
    assert.equal(await countMessages(tx, ROOM.r1), 0);
    const members = await tx.query("select 1 from public.room_members where room_id = $1", [
      ROOM.r1,
    ]);
    assert.equal(members.rows.length, 0, "left member also cannot list room members");
  });
});

test("RLS #5: member of ARCHIVED room SELECT messages -> full history", async () => {
  const status = await db.one("select status from public.rooms where id = $1", [ROOM.r2]);
  assert.equal(status.status, "archived");
  const total = await db.one(
    "select count(*)::int n, array_agg(id::text order by id) ids from public.messages where room_id = $1",
    [ROOM.r2],
  );
  assert.equal(total.n, 3);
  for (const uid of [U.a5, U.a2]) {
    await db.asUser(uid, async (tx) => {
      const r = await tx.one(
        "select count(*)::int n, array_agg(id::text order by id) ids from public.messages where room_id = $1",
        [ROOM.r2],
      );
      assert.deepEqual(r, total, `member ${uid} should see the full archived history`);
    });
  }
});

test("RLS #6: same member INSERT into archived room -> denied", async () => {
  await db.asUser(U.a5, async (tx) => {
    await tx.expectError(
      `insert into public.messages (room_id, sender_id, sender_type, content)
       values ($1, $2, 'user', 'still here?')`,
      [ROOM.r2, U.a5],
      "row-level security",
    );
    assert.equal(await countMessages(tx, ROOM.r2), 3);
  });
});

test("RLS #7: direct UPDATE on messages (own and others) -> denied", async () => {
  await db.asUser(U.a1, async (tx) => {
    // Own message.
    await tx.expectError(
      "update public.messages set content = 'edited' where id = $1",
      [MSG.r1_a1],
      "permission denied",
    );
    await tx.expectError(
      "update public.messages set deleted_at = now() where id = $1",
      [MSG.r1_a1],
      "permission denied",
    );
    // Someone else's message.
    await tx.expectError(
      "update public.messages set content = 'hijacked' where id = $1",
      [MSG.r1_a2],
      "permission denied",
    );
    await tx.expectError("delete from public.messages where id = $1", [MSG.r1_a2], "permission denied");
  });
  const rows = await db.query(
    "select id::text, content, deleted_at from public.messages where id = any($1::uuid[]) order by id",
    [[MSG.r1_a1, MSG.r1_a2]],
  );
  for (const r of rows.rows) {
    assert.ok(!["edited", "hijacked"].includes(r.content));
    assert.equal(r.deleted_at, null);
  }
});

test("RLS #8: soft_delete_message — others' message / >10 min old -> error; own fresh -> ok", async () => {
  // Someone else's message (a1 tries to delete a2's). Make it fresh so the only
  // reason for refusal is ownership.
  await db.asOwner(async (tx) => {
    const fresh = await tx.one(
      `insert into public.messages (room_id, sender_id, sender_type, content)
       values ($1, $2, 'user', 'a2 fresh') returning id`,
      [ROOM.r1, U.a2],
    );
    await become(tx, U.a1);
    await tx.expectError(
      "select public.soft_delete_message($1)",
      [fresh.id],
      "MESSAGE_NOT_DELETABLE",
    );
    await tx.expectError(
      "select public.soft_delete_message($1)",
      [MSG.r1_a2],
      "MESSAGE_NOT_DELETABLE",
    );
    await become(tx, "owner");
    const r = await tx.one("select deleted_at from public.messages where id = $1", [fresh.id]);
    assert.equal(r.deleted_at, null);
  });

  // Own message older than 10 minutes.
  await db.asOwner(async (tx) => {
    const old = await tx.one(
      `insert into public.messages (room_id, sender_id, sender_type, content, created_at)
       values ($1, $2, 'user', 'old one', now() - interval '10 minutes') returning id`,
      [ROOM.r1, U.a1],
    );
    await become(tx, U.a1);
    await tx.expectError("select public.soft_delete_message($1)", [old.id], "MESSAGE_NOT_DELETABLE");
    await become(tx, "owner");
    const r = await tx.one("select deleted_at from public.messages where id = $1", [old.id]);
    assert.equal(r.deleted_at, null);
  });

  // Own fresh message -> ok, deleted_at set, content unchanged.
  await db.asUser(U.a1, async (tx) => {
    const m = await tx.one(
      `insert into public.messages (room_id, sender_id, sender_type, content)
       values ($1, $2, 'user', 'oops typo') returning id`,
      [ROOM.r1, U.a1],
    );
    await tx.query("select public.soft_delete_message($1)", [m.id]);
    const r = await tx.one("select content, deleted_at from public.messages where id = $1", [m.id]);
    assert.notEqual(r.deleted_at, null);
    assert.equal(r.content, "oops typo");
  });
});

test("RLS #9: student vs admin-only policy -> denied", async () => {
  const before = await db.one("select name from public.courses where id = $1", [COURSE.cs201]);

  await db.asUser(U.a1, async (tx) => {
    // UPDATE courses: no admin -> no row visible for update.
    const upd = await tx.query("update public.courses set name = 'pwned' where id = $1", [
      COURSE.cs201,
    ]).catch((e) => e);
    if (upd instanceof Error) {
      assert.match(upd.message, /permission denied|row-level security/i);
    } else {
      assert.equal(upd.affectedRows ?? 0, 0, "student UPDATE courses must affect 0 rows");
    }
  });
  await db.asUser(U.a1, async (tx) => {
    await tx.expectError(
      `insert into public.courses (institution_id, name, code)
       select institution_id, 'x', 'X-1' from public.courses where id = $1`,
      [COURSE.cs201],
      "row-level security",
    );
    // UPDATE another profile's role.
    const other = await tx.query("update public.profiles set role = 'super_admin' where id = $1", [
      U.a2,
    ]);
    assert.equal(other.affectedRows ?? 0, 0, "cannot update another profile");
    // UPDATE own role -> guard trigger.
    await tx.expectError(
      "update public.profiles set role = 'super_admin' where id = $1",
      [U.a1],
      "PROFILE_PRIVILEGED_COLUMN",
    );
    await tx.expectError(
      "update public.profiles set is_active = false where id = $1",
      [U.a1],
      "PROFILE_PRIVILEGED_COLUMN",
    );
    // app_settings is admin-only for writes.
    const s = await tx.query("update public.app_settings set ai_enabled = false where id = 1");
    assert.equal(s.affectedRows ?? 0, 0);
    // rooms UPDATE is admin-only.
    const r = await tx.query("update public.rooms set status = 'closed' where id = $1", [ROOM.r1]).catch((e) => e);
    if (r instanceof Error) assert.match(r.message, /permission denied|row-level security/i);
    else assert.equal(r.affectedRows ?? 0, 0);
  });

  const after = await db.one("select name from public.courses where id = $1", [COURSE.cs201]);
  assert.equal(after.name, before.name);
  const roles = await db.query(
    "select id::text, role, is_active from public.profiles where id = any($1::uuid[]) order by id",
    [[U.a1, U.a2]],
  );
  for (const p of roles.rows) {
    assert.equal(p.role, "student");
    assert.equal(p.is_active, true);
  }
  assert.equal((await db.one("select ai_enabled from public.app_settings where id = 1")).ai_enabled, true);

  // Control: super_admin can do these.
  await db.asUser(U.admin, async (tx) => {
    const upd = await tx.query("update public.courses set name = 'renamed' where id = $1", [
      COURSE.cs201,
    ]);
    assert.equal(upd.affectedRows, 1);
    const p = await tx.query("update public.profiles set is_active = false where id = $1", [U.a2]);
    assert.equal(p.affectedRows, 1);
  });
});

test("RLS #10: super_admin SELECT messages -> 0 rows", async () => {
  const total = await db.one("select count(*)::int n from public.messages");
  assert.ok(total.n > 0);
  await db.asUser(U.admin, async (tx) => {
    const r = await tx.one("select count(*)::int n from public.messages");
    assert.equal(r.n, 0);
    assert.equal(await countMessages(tx, ROOM.r1), 0);
    assert.equal(await countMessages(tx, ROOM.r2), 0);
    // Admin can still see rooms (metadata), proving the admin identity is recognised.
    const rooms = await tx.one("select count(*)::int n from public.rooms");
    assert.ok(rooms.n >= 2);
  });
});

test("RLS guard: anon cannot read messages", async () => {
  const r = await db
    .asAnon((tx) => tx.query("select count(*)::int n from public.messages"))
    .catch((e) => e);
  if (r instanceof Error) assert.match(r.message, /permission denied/i);
  else assert.equal(r.rows[0].n, 0);
});
