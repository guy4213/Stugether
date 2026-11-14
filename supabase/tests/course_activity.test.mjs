// supabase/tests/course_activity.test.mjs
// 20261112000011_course_activity.sql — the "all recent activity" feed:
// metadata of my courses / rooms only, newest first.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "./db.mjs";
import { U, COURSE } from "./fixtures.mjs";

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

const feed = (db, user, args = [50, null]) =>
  db.asUser(user, async (tx) => {
    const r = await tx.query(
      "select kind, at, actor_id::text, course_id::text, room_id::text from public.list_course_activity($1, $2)",
      args,
    );
    return r.rows;
  });

test("course activity: only my courses, newest first", async (t) => {
  const db = await fresh(t);
  const rows = await feed(db, U.a1);
  assert.ok(rows.length > 0);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(new Date(rows[i - 1].at) >= new Date(rows[i].at), "sorted newest first");
  }
  const myCourses = await db.query(
    "select course_id::text from public.enrollments where user_id = $1 and status = 'active'",
    [U.a1],
  );
  const mine = new Set(myCourses.rows.map((r) => r.course_id));
  for (const r of rows.filter((x) => x.kind === "course_joined" || x.kind === "room_opened")) {
    assert.ok(mine.has(r.course_id), `${r.kind} is from one of my courses`);
  }
});

test("course activity: a new classmate shows up; keyset paging with p_before", async (t) => {
  const db = await fresh(t);
  await db.asOwner(
    (tx) =>
      tx.query(
        "insert into public.enrollments (user_id, course_id) values ($1, $2) on conflict (user_id, course_id) do update set status = 'active', created_at = now()",
        [U.a4, COURSE.math110],
      ),
    { commit: true },
  );
  const rows = await feed(db, U.a1);
  const joined = rows.find((r) => r.kind === "course_joined" && r.actor_id === U.a4);
  assert.ok(joined, "a4 joining MATH-110 is in a1's feed");

  const page = await feed(db, U.a1, [50, joined.at]);
  assert.ok(page.every((r) => new Date(r.at) < new Date(joined.at)));
});

test("course activity: anonymous callers get nothing", async (t) => {
  const db = await fresh(t);
  const r = await db.asOwner((tx) =>
    tx.query("select * from public.list_course_activity(10, null)"),
  );
  assert.equal(r.rows.length, 0);
});
