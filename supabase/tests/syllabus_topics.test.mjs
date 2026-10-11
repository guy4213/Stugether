// supabase/tests/syllabus_topics.test.mjs
// 20261010000001_syllabus_topics.sql — topic tree, top-level-only progress,
// room_topics + set_room_topics().
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "./db.mjs";
import { U, ROOM, COURSE } from "./fixtures.mjs";

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

const topicAt = (db, course, position) =>
  db
    .one(
      "select id::text from public.course_topics where course_id = $1 and position = $2 and parent_id is null",
      [course, position],
    )
    .then((r) => r.id);

test("topic tree: subtopics nest one level, inside the parent's course", async (t) => {
  const db = await fresh(t);
  const parent = await topicAt(db, COURSE.cs201, 1);

  await db.asUser(
    U.admin,
    async (tx) => {
      const sub = await tx.one(
        "insert into public.course_topics (course_id, parent_id, position, title, source, status) values ($1, $2, 1, 'סימון O גדול', 'ai_draft', 'draft') returning id::text",
        [COURSE.cs201, parent],
      );
      // Same position as a top-level topic is fine: positions are per sibling group.
      assert.ok(sub.id);
      await tx.expectError(
        "insert into public.course_topics (course_id, parent_id, position, title) values ($1, $2, 1, 'עמוק מדי')",
        [COURSE.cs201, sub.id],
        "TOPIC_TOO_DEEP",
      );
      await tx.expectError(
        "insert into public.course_topics (course_id, parent_id, position, title) values ($1, $2, 2, 'קורס אחר')",
        [COURSE.math110, parent],
        "TOPIC_PARENT_OTHER_COURSE",
      );
      await tx.expectError(
        "insert into public.course_topics (course_id, parent_id, position, title) values ($1, $2, 1, 'כפול')",
        [COURSE.cs201, parent],
        "duplicate key",
      );
    },
    { commit: true },
  );

  // Defaults keep existing (seeded) topics verified/manual.
  const seeded = await db.one("select source, status from public.course_topics where id = $1", [
    parent,
  ]);
  assert.deepEqual(seeded, { source: "manual", status: "verified" });
});

test("progress: subtopics do not change the course percent", async (t) => {
  const db = await fresh(t);
  const parent = await topicAt(db, COURSE.math110, 1);
  const pct = () =>
    db
      .one(
        "select progress_percent p from public.enrollments where user_id = $1 and course_id = $2",
        [U.a2, COURSE.math110],
      )
      .then((r) => r.p);
  const before = await pct();

  const sub = await db.one(
    "insert into public.course_topics (course_id, parent_id, position, title) values ($1, $2, 1, 'גבול לפי היינה') returning id::text",
    [COURSE.math110, parent],
  );
  await db.asUser(
    U.a2,
    (tx) =>
      tx.query(
        "insert into public.topic_progress (user_id, topic_id, status) values ($1, $2, 'mastered')",
        [U.a2, sub.id],
      ),
    { commit: true },
  );
  assert.equal(await pct(), before);
});

test("set_room_topics: owner links several course topics; rooms.topic follows", async (t) => {
  const db = await fresh(t);
  const t1 = await topicAt(db, COURSE.cs201, 1);
  const t3 = await topicAt(db, COURSE.cs201, 3);

  await db.asUser(
    U.a1,
    (tx) => tx.query("select public.set_room_topics($1, $2::uuid[])", [ROOM.r1, [t3, t1, t1]]),
    { commit: true },
  );

  const links = await db.one("select count(*)::int n from public.room_topics where room_id = $1", [
    ROOM.r1,
  ]);
  assert.equal(links.n, 2);
  const titles = await db.one(
    "select string_agg(title, ', ' order by position) t from public.course_topics where id = any($1::uuid[])",
    [[t1, t3]],
  );
  const room = await db.one("select topic from public.rooms where id = $1", [ROOM.r1]);
  assert.equal(room.topic, titles.t);

  // Members read the links; a non-member does not.
  await db.asUser(U.a3, async (tx) => {
    const r = await tx.one("select count(*)::int n from public.room_topics where room_id = $1", [
      ROOM.r1,
    ]);
    assert.equal(r.n, 2);
  });
  await db.asUser(U.a4, async (tx) => {
    const r = await tx.one("select count(*)::int n from public.room_topics where room_id = $1", [
      ROOM.r1,
    ]);
    assert.equal(r.n, 0);
  });

  // Replacing the set drops the old links.
  await db.asUser(
    U.a1,
    (tx) => tx.query("select public.set_room_topics($1, $2::uuid[])", [ROOM.r1, [t3]]),
    { commit: true },
  );
  const after = await db.one(
    "select array_agg(topic_id::text) ids from public.room_topics where room_id = $1",
    [ROOM.r1],
  );
  assert.deepEqual(after.ids, [t3]);
});

test("set_room_topics: rejects non-owners, other courses, closed rooms, direct writes", async () => {
  const t1 = await topicAt(base, COURSE.cs201, 1);
  const mathTopic = await topicAt(base, COURSE.math110, 1);

  await base.asUser(U.a3, (tx) =>
    tx.expectError(
      "select public.set_room_topics($1, $2::uuid[])",
      [ROOM.r1, [t1]],
      "NOT_ROOM_OWNER",
    ),
  );
  await base.asUser(U.a1, async (tx) => {
    await tx.expectError(
      "select public.set_room_topics($1, $2::uuid[])",
      [ROOM.r1, [mathTopic]],
      "TOPIC_NOT_IN_COURSE",
    );
    await tx.expectError(
      "insert into public.room_topics (room_id, topic_id) values ($1, $2)",
      [ROOM.r1, t1],
      "row-level security",
    );
  });
  // R2 is archived (a2 owns it).
  await base.asUser(U.a2, (tx) =>
    tx.expectError(
      "select public.set_room_topics($1, $2::uuid[])",
      [ROOM.r2, [mathTopic]],
      "ROOM_NOT_ACTIVE",
    ),
  );
});

// ---------------------------------------------------------------------------
// 20261010000002_hit_catalog.sql (generated by scripts/catalog/to-sql.mjs)
// ---------------------------------------------------------------------------
test("hit catalog: real courses replace the starter ones; topics carry provenance", async () => {
  const hit = await base.one("select id::text from public.institutions where name = 'H.IT'");

  const counts = await base.one(
    `select count(*) filter (where code is not null and is_active)::int real_active,
            count(*) filter (where code is null and is_active)::int starter_active
       from public.courses where institution_id = $1`,
    [hit.id],
  );
  assert.ok(counts.real_active > 400, `expected 400+ HIT courses, got ${counts.real_active}`);
  assert.equal(counts.starter_active, 0);

  // Data structures: HIT's own (archived) syllabus, with its code and credits.
  const ds = await base.one(
    "select id::text, name, credits::text, department_id is not null has_dept from public.courses where institution_id = $1 and code = '61104'",
    [hit.id],
  );
  assert.equal(ds.name, "מבני נתונים");
  assert.equal(ds.credits, "4.0");
  assert.equal(ds.has_dept, true);
  const dsTopics = await base.one(
    "select count(*)::int n, min(source) src, min(status) st, bool_and(source_url is not null) urls from public.course_topics where course_id = $1 and parent_id is null",
    [ds.id],
  );
  assert.ok(dsTopics.n >= 5);
  assert.deepEqual(
    [dsTopics.src, dsTopics.st, dsTopics.urls],
    ["official_syllabus", "verified", true],
  );

  // Borrowed lists are drafts and say where they came from.
  const borrowed = await base.one(
    `select count(*)::int n, bool_and(status = 'draft') drafts, bool_and(source_ref is not null) refs
       from public.course_topics where source = 'equivalent_course'`,
  );
  assert.ok(borrowed.n > 0);
  assert.equal(borrowed.drafts, true);
  assert.equal(borrowed.refs, true);

  // Subtopics hang off a top-level topic of the same course.
  const orphans = await base.one(
    `select count(*)::int n from public.course_topics s
       join public.course_topics p on p.id = s.parent_id
      where p.parent_id is not null or p.course_id <> s.course_id`,
  );
  assert.equal(orphans.n, 0);
});
