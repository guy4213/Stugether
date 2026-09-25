// supabase/tests/mockup_features.test.mjs
// 20260925000001_mockup_features.sql — notifications, open rooms, topics /
// progress, study availability, events.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "./db.mjs";
import { U, ROOM, INV, COURSE } from "./fixtures.mjs";

const OPEN_ROOM = "00000000-0000-0000-0005-000000000003"; // MATH-110, opened by a5
const MARATHON = "00000000-0000-0000-000a-000000000004"; // CS-201 study session

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

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
test("notifications: seed triggers produced typed rows; users see only their own", async () => {
  await base.asUser(U.a4, async (tx) => {
    const inv = await tx.one(
      "select type, category, invitation_id::text from public.notifications where invitation_id = $1",
      [INV.i1_a4_valid],
    );
    assert.deepEqual(inv, {
      type: "room_invitation",
      category: "invitations",
      invitation_id: INV.i1_a4_valid,
    });
    const others = await tx.one(
      "select count(*)::int n from public.notifications where user_id <> $1",
      [U.a4],
    );
    assert.equal(others.n, 0);
  });

  // The expired invitation (I2 -> a5) must not have produced a notification.
  const expired = await base.one(
    "select count(*)::int n from public.notifications where invitation_id = $1",
    [INV.i2_a5_expired],
  );
  assert.equal(expired.n, 0);

  // a1 is enrolled in MATH-110, so a5's open room was announced to a1 (not to a5).
  const opened = await base.one(
    "select array_agg(user_id::text order by user_id) ids from public.notifications where type = 'room_opened' and room_id = $1",
    [OPEN_ROOM],
  );
  assert.deepEqual(opened.ids, [U.a1, U.a2]);
});

test("notifications: users cannot insert or update rows directly", async () => {
  await base.asUser(U.a1, async (tx) => {
    await tx.expectError(
      "insert into public.notifications (user_id, type, title) values ($1, 'system', 'x')",
      [U.a1],
      "row-level security",
    );
    const upd = await tx.query(
      "update public.notifications set title = 'hacked' where user_id = $1 returning id",
      [U.a1],
    );
    assert.equal(upd.rows.length, 0, "no UPDATE policy -> nothing updated");
  });
  await base.asUser(U.admin, async (tx) => {
    await tx.query(
      "insert into public.notifications (user_id, type, title) values ($1, 'system', 'תחזוקה')",
      [U.a1],
    );
    await tx.expectError(
      "insert into public.notifications (user_id, type, title) values ($1, 'room_opened', 'x')",
      [U.a1],
      "row-level security",
    );
  });
});

test("notifications: mark_notifications_read by id and all; summary per category", async (t) => {
  const db = await fresh(t);
  await db.asUser(
    U.a1,
    async (tx) => {
      const unread = await tx.query(
        "select id::text from public.notifications where read_at is null order by created_at",
      );
      assert.ok(unread.rows.length >= 2, "seed leaves a1 with fresh unread notifications");

      const one = await tx.one("select public.mark_notifications_read($1::uuid[]) n", [
        [unread.rows[0].id],
      ]);
      assert.equal(one.n, 1);

      const summary = await tx.query("select * from public.get_notification_summary(null)");
      const totalUnread = summary.rows.reduce((s, r) => s + Number(r.unread), 0);
      assert.equal(totalUnread, unread.rows.length - 1);

      const rest = await tx.one("select public.mark_notifications_read() n");
      assert.equal(rest.n, unread.rows.length - 1);
      const left = await tx.one(
        "select count(*)::int n from public.notifications where read_at is null",
      );
      assert.equal(left.n, 0);
    },
    { commit: true },
  );
  // a1 marking "all" never touches another user's rows.
  const a2Unread = await db.one(
    "select count(*)::int n from public.notifications where user_id = $1 and read_at is null",
    [U.a2],
  );
  assert.ok(a2Unread.n > 0);
});

test("notifications: preferences gate the triggers (live_rooms off -> no room_opened)", async (t) => {
  const db = await fresh(t);
  await db.asUser(
    U.a2,
    (tx) =>
      tx.query(
        "insert into public.notification_preferences (user_id, live_rooms) values ($1, false)",
        [U.a2],
      ),
    { commit: true },
  );
  const roomId = await db.asUser(
    U.a1,
    async (tx) =>
      (
        await tx.one(
          "insert into public.rooms (course_id, created_by, name, is_open) values ($1, $2, 'חדר פתוח', true) returning id::text",
          [COURSE.cs201, U.a1],
        )
      ).id,
    { commit: true },
  );
  const rows = await db.query(
    "select user_id::text from public.notifications where type = 'room_opened' and room_id = $1 order by user_id",
    [roomId],
  );
  // CS-201 actives: a1 (creator), a2 (opted out), a3, a4, a5.
  assert.deepEqual(
    rows.rows.map((r) => r.user_id),
    [U.a3, U.a4, U.a5],
  );

  // Another user's preferences are invisible and unwritable.
  await db.asUser(U.a1, async (tx) => {
    const r = await tx.one("select count(*)::int n from public.notification_preferences");
    assert.equal(r.n, 0);
    await tx.expectError(
      "insert into public.notification_preferences (user_id) values ($1)",
      [U.a2],
      "row-level security",
    );
  });
});

test("notifications: joining a room notifies the other members (insert and re-join)", async (t) => {
  const db = await fresh(t);
  await db.asUser(U.a4, (tx) => tx.query("select public.accept_room_invitation($1)", [INV.i1_a4_valid]), {
    commit: true,
  });
  const rows = await db.query(
    "select user_id::text from public.notifications where type = 'room_joined' and room_id = $1 and actor_id = $2 order by user_id",
    [ROOM.r1, U.a4],
  );
  assert.deepEqual(
    rows.rows.map((r) => r.user_id),
    [U.a1, U.a2, U.a3],
  );
});

// ---------------------------------------------------------------------------
// Open rooms
// ---------------------------------------------------------------------------
test("open rooms: listed only for enrolled users; join respects enrollment and capacity", async (t) => {
  const db = await fresh(t);

  await db.asUser(U.a1, async (tx) => {
    const r = await tx.query("select room_id::text, member_count, is_member from public.list_open_rooms($1)", [
      [COURSE.math110, COURSE.cs201],
    ]);
    assert.deepEqual(r.rows, [{ room_id: OPEN_ROOM, member_count: 1, is_member: false }]);
  });
  // a3 is not enrolled in MATH-110: nothing listed, join looks like "not found".
  await db.asUser(U.a3, async (tx) => {
    const r = await tx.query("select * from public.list_open_rooms($1)", [[COURSE.math110]]);
    assert.equal(r.rows.length, 0);
    await tx.expectError("select public.join_open_room($1)", [OPEN_ROOM], "ROOM_NOT_FOUND");
  });
  // A regular (not open) room cannot be joined this way.
  await db.asUser(U.a4, (tx) =>
    tx.expectError("select public.join_open_room($1)", [ROOM.r1], "ROOM_NOT_FOUND"),
  );

  await db.asUser(U.a1, (tx) => tx.query("select public.join_open_room($1)", [OPEN_ROOM]), {
    commit: true,
  });
  await db.asUser(U.a2, (tx) => tx.query("select public.join_open_room($1)", [OPEN_ROOM]), {
    commit: true,
  });
  const members = await db.one(
    "select count(*)::int n from public.room_members where room_id = $1 and left_at is null",
    [OPEN_ROOM],
  );
  assert.equal(members.n, 3);
  // Joining twice is a no-op.
  await db.asUser(U.a1, (tx) => tx.query("select public.join_open_room($1)", [OPEN_ROOM]));

  // Fill the 4th seat with a new MATH-110 student, then a 5th is refused.
  await db.asOwner(
    async (tx) => {
      await tx.query(
        "insert into public.enrollments (user_id, course_id) values ($1, $2), ($3, $2)",
        [U.a3, COURSE.math110, U.a4],
      );
    },
    { commit: true },
  );
  await db.asUser(U.a3, (tx) => tx.query("select public.join_open_room($1)", [OPEN_ROOM]), {
    commit: true,
  });
  await db.asUser(U.a4, (tx) =>
    tx.expectError("select public.join_open_room($1)", [OPEN_ROOM], "ROOM_FULL"),
  );
});

// ---------------------------------------------------------------------------
// Topics + progress
// ---------------------------------------------------------------------------
test("topics: seed progress derives enrollment percent; changes recompute it", async (t) => {
  const pct = (db, user, course) =>
    db
      .one("select progress_percent p, completed_at from public.enrollments where user_id = $1 and course_id = $2", [
        user,
        course,
      ])
      .then((r) => r);

  assert.equal((await pct(base, U.a1, COURSE.cs201)).p, 65);
  assert.equal((await pct(base, U.a1, COURSE.math110)).p, 100);
  assert.equal((await pct(base, U.a2, COURSE.math110)).p, 40);

  const db = await fresh(t);
  const topic14 = await db.one(
    "select id::text from public.course_topics where course_id = $1 and position = 14",
    [COURSE.cs201],
  );
  await db.asUser(
    U.a1,
    (tx) =>
      tx.query("update public.topic_progress set status = 'mastered' where user_id = $1 and topic_id = $2", [
        U.a1,
        topic14.id,
      ]),
    { commit: true },
  );
  assert.equal((await pct(db, U.a1, COURSE.cs201)).p, 70);

  // Un-mastering a topic of a completed course clears completed_at.
  const limits = await db.one(
    "select id::text from public.course_topics where course_id = $1 and position = 1",
    [COURSE.math110],
  );
  await db.asUser(
    U.a1,
    (tx) =>
      tx.query("delete from public.topic_progress where user_id = $1 and topic_id = $2", [U.a1, limits.id]),
    { commit: true },
  );
  const after = await pct(db, U.a1, COURSE.math110);
  assert.equal(after.p, 80);
  assert.equal(after.completed_at, null);
});

test("topics: progress is private and only for enrolled courses; topics are admin-managed", async () => {
  await base.asUser(U.a2, async (tx) => {
    const r = await tx.one("select count(*)::int n from public.topic_progress where user_id = $1", [U.a1]);
    assert.equal(r.n, 0);
  });
  // a4 is not enrolled in MATH-110.
  const mathTopic = await base.one(
    "select id::text from public.course_topics where course_id = $1 and position = 1",
    [COURSE.math110],
  );
  await base.asUser(U.a4, async (tx) => {
    await tx.expectError(
      "insert into public.topic_progress (user_id, topic_id, status) values ($1, $2, 'mastered')",
      [U.a4, mathTopic.id],
      "row-level security",
    );
    await tx.expectError(
      "insert into public.course_topics (course_id, position, title) values ($1, 99, 'x')",
      [COURSE.math110],
      "row-level security",
    );
  });
});

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------
test("availability: visible to classmates only while not expired; capped at 3 hours", async (t) => {
  // a1 shares MATH-110 with a2/a5 and CS-201 with a3.
  await base.asUser(U.a1, async (tx) => {
    const r = await tx.query(
      "select user_id::text from public.study_availability order by user_id",
    );
    assert.deepEqual(
      r.rows.map((x) => x.user_id),
      [U.a2, U.a3, U.a5],
    );
  });
  // a4 shares CS-201 with a3 only.
  await base.asUser(U.a4, async (tx) => {
    const r = await tx.query("select user_id::text from public.study_availability");
    assert.deepEqual(
      r.rows.map((x) => x.user_id),
      [U.a3],
    );
  });

  const db = await fresh(t);
  await db.asOwner(
    (tx) =>
      tx.query("update public.study_availability set expires_at = now() - interval '1 minute' where user_id = $1", [
        U.a3,
      ]),
    { commit: true },
  );
  await db.asUser(U.a4, async (tx) => {
    const r = await tx.one("select count(*)::int n from public.study_availability");
    assert.equal(r.n, 0);
  });
  await db.asUser(U.a3, async (tx) => {
    const own = await tx.one("select count(*)::int n from public.study_availability");
    assert.equal(own.n, 1, "own expired row stays visible to its owner");
  });

  await db.asUser(U.a1, async (tx) => {
    await tx.query(
      "insert into public.study_availability (user_id, course_id, mode, duration_minutes, activity, expires_at) values ($1, $2, 'online', 60, 'review', now() + interval '1 hour')",
      [U.a1, COURSE.cs201],
    );
    await tx.expectError(
      "update public.study_availability set expires_at = now() + interval '5 hours' where user_id = $1",
      [U.a1],
      "row-level security",
    );
    // Not enrolled in CS-101.
    await tx.expectError(
      "insert into public.study_availability (user_id, course_id, mode, duration_minutes, activity, expires_at) values ($1, $2, 'online', 60, 'review', now() + interval '1 hour')",
      [U.a1, COURSE.cs101],
      "row-level security",
    );
  });
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
test("events: kind stored; registration only by enrolled users; new event notifies classmates", async (t) => {
  await base.asUser(U.a1, async (tx) => {
    const ev = await tx.one("select kind from public.tests where id = $1", [MARATHON]);
    assert.equal(ev.kind, "study_session");
    const regs = await tx.one("select count(*)::int n from public.event_registrations where event_id = $1", [
      MARATHON,
    ]);
    assert.equal(regs.n, 4);
    await tx.query("insert into public.event_registrations (event_id, user_id) values ($1, $2)", [
      MARATHON,
      U.a1,
    ]);
    await tx.expectError(
      "insert into public.event_registrations (event_id, user_id) values ($1, $2)",
      [MARATHON, U.a2],
      "row-level security",
    );
  });
  // a5 is not in CS-305 etc.; MATH-110 workshop is invisible to a3 (not enrolled).
  await base.asUser(U.a3, async (tx) => {
    const r = await tx.one(
      "select count(*)::int n from public.event_registrations where event_id = '00000000-0000-0000-000a-000000000003'",
    );
    assert.equal(r.n, 0);
  });

  const db = await fresh(t);
  const eventId = await db.asUser(
    U.a2,
    async (tx) =>
      (
        await tx.one(
          "insert into public.tests (course_id, title, due_at, created_by, kind) values ($1, 'סדנת אינטגרלים', now() + interval '3 days', $2, 'workshop') returning id::text",
          [COURSE.math110, U.a2],
        )
      ).id,
    { commit: true },
  );
  const notified = await db.query(
    "select user_id::text, title from public.notifications where event_id = $1 order by user_id",
    [eventId],
  );
  assert.deepEqual(notified.rows, [
    { user_id: U.a1, title: "סדנה חדשה נקבעה" },
    { user_id: U.a5, title: "סדנה חדשה נקבעה" },
  ]);
});
