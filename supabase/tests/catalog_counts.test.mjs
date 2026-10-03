// supabase/tests/catalog_counts.test.mjs
// 20261003000001_course_catalog_counts.sql — per-institution catalog counts
// must match the per-course RPCs they replace on the catalog/dashboard paths.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb, expectError } from "./db.mjs";
import { U } from "./fixtures.mjs";

const INSTITUTION = "00000000-0000-0000-0001-000000000001";

let base;
before(async () => {
  base = await createDb();
});
after(async () => {
  await base?.close();
});

test("course_catalog_counts: matches count_active_students/rooms_by_course", async () => {
  await base.asUser(U.a4, async (tx) => {
    const counts = await tx.query(
      "select course_id::text, student_count::int, room_count::int from public.course_catalog_counts($1)",
      [INSTITUTION],
    );
    const ids = counts.rows.map((r) => r.course_id);
    assert.ok(ids.length > 0, "seed institution has active courses");

    const students = await tx.query(
      "select course_id::text, student_count::int from public.count_active_students_by_course($1::uuid[])",
      [ids],
    );
    const rooms = await tx.query(
      "select course_id::text, room_count::int from public.count_active_rooms_by_course($1::uuid[])",
      [ids],
    );
    const studentsBy = new Map(students.rows.map((r) => [r.course_id, r.student_count]));
    const roomsBy = new Map(rooms.rows.map((r) => [r.course_id, r.room_count]));

    for (const row of counts.rows) {
      assert.equal(row.student_count, studentsBy.get(row.course_id) ?? 0, row.course_id);
      assert.equal(row.room_count, roomsBy.get(row.course_id) ?? 0, row.course_id);
    }
  });
});

test("course_catalog_counts: unknown institution returns no rows", async () => {
  await base.asUser(U.a1, async (tx) => {
    const r = await tx.query("select * from public.course_catalog_counts($1)", [
      "00000000-0000-0000-0001-0000000000ff",
    ]);
    assert.equal(r.rows.length, 0);
  });
});

test("course_catalog_counts: not executable by anon", async () => {
  await base.asAnon(async (tx) => {
    await expectError(
      tx.query("select * from public.course_catalog_counts($1)", [INSTITUTION]),
      "permission denied",
    );
  });
});
