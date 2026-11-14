// supabase/tests/direct_messages.test.mjs
// 20261107000001_direct_messages.sql — 1:1 chat (SPEC §5.1) + in-site notification.
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

async function open(db, me, other) {
  return db.asUser(
    me,
    async (tx) => (await tx.one("select public.open_conversation($1) as id", [other])).id,
    { commit: true },
  );
}

async function send(db, me, conversationId, content) {
  return db.asUser(
    me,
    (tx) => tx.one("select * from public.send_direct_message($1, $2)", [conversationId, content]),
    { commit: true },
  );
}

test("open_conversation: one row per pair, from either side; self / unknown refused", async (t) => {
  const db = await fresh(t);
  const id = await open(db, U.a1, U.a4);
  assert.equal(await open(db, U.a4, U.a1), id);
  assert.equal(await open(db, U.a1, U.a4), id);
  assert.equal(Number((await db.one("select count(*) from public.conversations")).count), 1);

  await db.asUser(U.a1, async (tx) => {
    await tx.expectError("select public.open_conversation($1)", [U.a1], "INVALID_ARGUMENT");
    await tx.expectError(
      "select public.open_conversation($1)",
      ["00000000-0000-0000-0000-00000000ffff"],
      "NOT_ALLOWED",
    );
  });
});

// 20261114000011_admin_friends_and_dms.sql: a Super Admin may chat privately
// too, in their own conversations only.
test("open_conversation: a Super Admin can chat with a student, from either side", async (t) => {
  const db = await fresh(t);
  const seesAdmin = (who) =>
    db.asUser(
      who,
      async (tx) =>
        (await tx.query("select listed from public.public_profiles where id = $1", [U.admin])).rows,
    );
  assert.deepEqual(await seesAdmin(U.a1), []);
  const id = await open(db, U.admin, U.a1);
  assert.equal(await open(db, U.a1, U.admin), id);
  // The student now sees who they talk to (not as a listed student); others don't.
  assert.deepEqual(await seesAdmin(U.a1), [{ listed: false }]);
  assert.deepEqual(await seesAdmin(U.a2), []);
  const msg = await send(db, U.admin, id, "שלום מהצוות");
  assert.equal(msg.content, "שלום מהצוות");
  await send(db, U.a1, id, "תודה!");
  // Still no access to other people's chats.
  const other = await open(db, U.a2, U.a3);
  await db.asUser(U.admin, async (tx) => {
    const r = await tx.query("select 1 from public.direct_messages where conversation_id = $1", [
      other,
    ]);
    assert.equal(r.rows.length, 0);
  });
});

test("direct messages: only the two participants see them; no direct writes", async (t) => {
  const db = await fresh(t);
  const id = await open(db, U.a1, U.a4);
  const msg = await send(db, U.a1, id, "  היי, רוצה ללמוד יחד?  ");
  assert.equal(msg.content, "היי, רוצה ללמוד יחד?");

  for (const who of [U.a1, U.a4]) {
    await db.asUser(who, async (tx) => {
      assert.equal((await tx.query("select 1 from public.conversations")).rows.length, 1);
      assert.equal((await tx.query("select 1 from public.direct_messages")).rows.length, 1);
    });
  }
  // An outsider and the super admin see nothing (no message content for admins).
  for (const who of [U.a2, U.admin]) {
    await db.asUser(who, async (tx) => {
      assert.equal((await tx.query("select 1 from public.conversations")).rows.length, 0);
      assert.equal((await tx.query("select 1 from public.direct_messages")).rows.length, 0);
      await tx.expectError(
        "select public.send_direct_message($1, 'x')",
        [id],
        who === U.admin ? "" : "NOT_A_MEMBER",
      );
      await tx.expectError("select public.mark_conversation_read($1)", [id], "");
    });
  }

  await db.asUser(U.a1, async (tx) => {
    await tx.expectError(
      `insert into public.direct_messages (conversation_id, sender_id, content) values ($1, $2, 'x')`,
      [id, U.a1],
      "permission denied",
    );
    await tx.expectError(
      "update public.direct_messages set content = 'edited'",
      "permission denied",
    );
    await tx.expectError(
      `insert into public.conversations (user_a_id, user_b_id) values ($1, $2)`,
      [U.a1, U.a2],
      "permission denied",
    );
    await tx.expectError("select public.send_direct_message($1, '   ')", [id], "INVALID_CONTENT");
  });
});

test("notification: one unread row per conversation, cleared by mark_conversation_read", async (t) => {
  const db = await fresh(t);
  const id = await open(db, U.a1, U.a4);
  await send(db, U.a1, id, "הודעה ראשונה");
  await send(db, U.a1, id, "הודעה שנייה");

  const notes = await db.query(
    `select user_id::text, type, category, actor_id::text, body, read_at
       from public.notifications where conversation_id = $1`,
    [id],
  );
  assert.equal(notes.rows.length, 1);
  assert.equal(notes.rows[0].user_id, U.a4);
  assert.equal(notes.rows[0].type, "direct_message");
  assert.equal(notes.rows[0].category, "messages");
  assert.equal(notes.rows[0].actor_id, U.a1);
  assert.equal(notes.rows[0].body, "הודעה שנייה");
  assert.equal(notes.rows[0].read_at, null);

  await db.asUser(U.a4, async (tx) => {
    const list = await tx.query("select * from public.list_my_conversations()");
    assert.equal(list.rows.length, 1);
    assert.equal(list.rows[0].other_user_id, U.a1);
    assert.equal(list.rows[0].last_message_content, "הודעה שנייה");
    assert.equal(Number(list.rows[0].unread_count), 2);
    const badge = await tx.one("select public.count_unread_direct_messages() as n");
    assert.equal(Number(badge.n), 1);
  });
  // The sender has nothing unread.
  await db.asUser(U.a1, async (tx) => {
    const list = await tx.query("select unread_count from public.list_my_conversations()");
    assert.equal(Number(list.rows[0].unread_count), 0);
  });

  await db.asUser(U.a4, (tx) => tx.query("select public.mark_conversation_read($1)", [id]), {
    commit: true,
  });
  await db.asUser(U.a4, async (tx) => {
    const badge = await tx.one("select public.count_unread_direct_messages() as n");
    assert.equal(Number(badge.n), 0);
    const unread = await tx.query(
      "select 1 from public.notifications where conversation_id = $1 and read_at is null",
      [id],
    );
    assert.equal(unread.rows.length, 0);
  });

  // A reply notifies the other side; the messages_invites toggle turns it off.
  await db.query(
    "insert into public.notification_preferences (user_id, messages_invites) values ($1, false)",
    [U.a1],
  );
  await send(db, U.a4, id, "תודה!");
  const toA1 = await db.query(
    "select 1 from public.notifications where user_id = $1 and type = 'direct_message'",
    [U.a1],
  );
  assert.equal(toA1.rows.length, 0);
});

test("soft delete: own message within 5 minutes; hidden from the other side", async (t) => {
  const db = await fresh(t);
  const id = await open(db, U.a1, U.a4);
  const msg = await send(db, U.a1, id, "סוד");

  await db.asUser(U.a4, (tx) =>
    tx.expectError(
      "select public.soft_delete_direct_message($1)",
      [msg.id],
      "MESSAGE_NOT_DELETABLE",
    ),
  );
  await db.asUser(
    U.a1,
    (tx) => tx.query("select public.soft_delete_direct_message($1)", [msg.id]),
    {
      commit: true,
    },
  );
  await db.asUser(U.a4, async (tx) => {
    assert.equal((await tx.query("select 1 from public.direct_messages")).rows.length, 0);
    const note = await tx.one("select body from public.notifications where conversation_id = $1", [
      id,
    ]);
    assert.equal(note.body, "ההודעה נמחקה");
  });
  await db.asUser(U.a1, async (tx) => {
    const own = await tx.one("select deleted_at from public.direct_messages where id = $1", [
      msg.id,
    ]);
    assert.notEqual(own.deleted_at, null);
  });

  // Older than 5 minutes: refused.
  const old = await send(db, U.a1, id, "ישן");
  await db.query(
    "update public.direct_messages set created_at = now() - interval '6 minutes' where id = $1",
    [old.id],
  );
  await db.asUser(U.a1, (tx) =>
    tx.expectError(
      "select public.soft_delete_direct_message($1)",
      [old.id],
      "MESSAGE_NOT_DELETABLE",
    ),
  );
});

test("realtime: dm:<id> is open to the two participants only", async (t) => {
  const db = await fresh(t);
  const id = await open(db, U.a1, U.a4);
  const topic = `dm:${id}`;

  for (const who of [U.a1, U.a4]) {
    const access = await db.realtimeAccess(who, topic);
    assert.equal(access.read, true);
    assert.equal(access.write, true);
  }
  for (const who of [U.a2, U.admin, null]) {
    const access = await db.realtimeAccess(who, topic);
    assert.equal(access.read, false);
    assert.equal(access.write, false);
  }
  assert.equal((await db.realtimeAccess(U.a1, "dm:not-a-uuid")).read, false);

  // The user topic is unchanged: own only, receive only.
  const own = await db.realtimeAccess(U.a4, `user:${U.a4}`);
  assert.equal(own.read, true);
  assert.equal(own.write, false);
  assert.equal((await db.realtimeAccess(U.a1, `user:${U.a4}`)).read, false);
});

// 20261112000020_dm_read_receipts.sql — "נשלח / נקרא" (Change Request 12.11.2026).
test("read receipts: participants see each other's read time; 'read' broadcast without content", async (t) => {
  const db = await fresh(t);
  const id = await open(db, U.a1, U.a4);
  await send(db, U.a1, id, "סוד שלא אמור לדלוף");

  await db.asUser(U.a4, (tx) => tx.query("select public.mark_conversation_read($1)", [id]), {
    commit: true,
  });

  // The sender sees the other side's read row, next to their own (sending
  // marks the sender read).
  await db.asUser(U.a1, async (tx) => {
    const rows = await tx.query(
      `select user_id::text, last_read_at from public.conversation_reads
        where conversation_id = $1 order by user_id`,
      [id],
    );
    assert.deepEqual(
      rows.rows.map((r) => r.user_id),
      [U.a1, U.a4],
    );
    assert.ok(rows.rows[1].last_read_at);
  });
  // An outsider and the super admin see no read rows.
  for (const who of [U.a2, U.admin]) {
    await db.asUser(who, async (tx) => {
      assert.equal((await tx.query("select 1 from public.conversation_reads")).rows.length, 0);
    });
  }
  // Still no direct writes.
  await db.asUser(U.a1, (tx) =>
    tx.expectError(
      "insert into public.conversation_reads (conversation_id, user_id, last_read_at) values ($1, $2, now())",
      [id, U.a1],
      "",
    ),
  );

  // The broadcast on dm:<id>: who + when, never the message text.
  const sent = await db.query(
    "select payload from realtime.messages where topic = $1 and event = 'read'",
    [`dm:${id}`],
  );
  assert.equal(sent.rows.length, 1);
  assert.deepEqual(Object.keys(sent.rows[0].payload).sort(), ["last_read_at", "user_id"]);
  assert.equal(sent.rows[0].payload.user_id, U.a4);
  assert.ok(!JSON.stringify(sent.rows[0].payload).includes("סוד"));

  // The unread counts still count only my own read row.
  await db.asUser(U.a1, async (tx) => {
    const badge = await tx.one("select public.count_unread_direct_messages() as n");
    assert.equal(Number(badge.n), 0);
  });
  await send(db, U.a4, id, "תשובה");
  await db.asUser(U.a1, async (tx) => {
    const list = await tx.query("select unread_count from public.list_my_conversations()");
    assert.equal(Number(list.rows[0].unread_count), 1);
  });
});
