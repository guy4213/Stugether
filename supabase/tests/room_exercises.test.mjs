// supabase/tests/room_exercises.test.mjs
// 20261030000001_room_exercises.sql — a shared text exercise in the room.
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

// R1 (active): a1 creator + a2 + a3. a4 is not a member. R2 is archived (a2 + a5).

test("exercises: a member adds one, every member reads it, a non-member sees nothing", async (t) => {
  const db = await fresh(t);
  const row = await db.asUser(
    U.a2,
    (tx) =>
      tx.one("select public.add_room_exercise($1, ' תרגיל 4 ', ' נתון המרחב V ') id", [ROOM.r1]),
    { commit: true },
  );
  const saved = await db.one(
    "select title, content, created_by::text from public.room_exercises where id = $1",
    [row.id],
  );
  assert.deepEqual(
    [saved.title, saved.content, saved.created_by],
    ["תרגיל 4", "נתון המרחב V", U.a2],
  );

  await db.asUser(U.a3, async (tx) => {
    const rows = await tx.query("select id::text from public.room_exercises");
    assert.deepEqual(
      rows.rows.map((r) => r.id),
      [row.id],
    );
  });
  await db.asUser(U.a4, async (tx) => {
    assert.equal((await tx.query("select 1 from public.room_exercises")).rows.length, 0);
  });
});

test("exercises: non-members, read-only rooms and empty text are rejected; no direct writes", async (t) => {
  const db = await fresh(t);
  await db.asUser(U.a4, (tx) =>
    tx.expectError("select public.add_room_exercise($1, 'x', 'y')", [ROOM.r1], "NOT_ALLOWED"),
  );
  await db.asUser(U.a2, (tx) =>
    tx.expectError("select public.add_room_exercise($1, 'x', 'y')", [ROOM.r2], "NOT_ALLOWED"),
  );
  await db.asUser(U.a1, async (tx) => {
    await tx.expectError(
      "select public.add_room_exercise($1, '  ', 'y')",
      [ROOM.r1],
      "INVALID_ARGUMENT",
    );
    // A file path the caller never uploaded is refused.
    await tx.expectError(
      "select public.add_room_exercise($1, 'x', null, $2, 'nope.png', 'image/png')",
      [ROOM.r1, `${ROOM.r1}/nope.png`],
      "FILE_NOT_FOUND",
    );
    await tx.expectError(
      "insert into public.room_exercises (room_id, created_by, title, content) values ($1, $2, 'x', 'y')",
      [ROOM.r1, U.a1],
      "permission denied",
    );
  });
});

test("room-files: members upload into an active room's folder and read it; others cannot", async (t) => {
  const db = await fresh(t);
  const path = `${ROOM.r1}/ex-1.png`;
  await db.asUser(
    U.a3,
    (tx) =>
      tx.query(
        "insert into storage.objects (bucket_id, name, owner) values ('room-files', $1, $2)",
        [path, U.a3],
      ),
    { commit: true },
  );
  const row = await db.asUser(
    U.a3,
    (tx) =>
      tx.one(
        "select public.add_room_exercise($1, 'תרגיל בתמונה', null, $2, 'ex.png', 'image/png') id",
        [ROOM.r1, path],
      ),
    { commit: true },
  );
  const saved = await db.one(
    "select content, file_name, file_type from public.room_exercises where id = $1",
    [row.id],
  );
  assert.deepEqual(
    [saved.content, saved.file_name, saved.file_type],
    [null, "ex.png", "image/png"],
  );

  await db.asUser(U.a1, async (tx) => {
    const r = await tx.query("select name from storage.objects where bucket_id = 'room-files'");
    assert.deepEqual(
      r.rows.map((x) => x.name),
      [path],
    );
  });
  await db.asUser(U.a4, async (tx) => {
    const r = await tx.query("select 1 from storage.objects where bucket_id = 'room-files'");
    assert.equal(r.rows.length, 0);
    await tx.expectError(
      "insert into storage.objects (bucket_id, name, owner) values ('room-files', $1, $2)",
      [`${ROOM.r1}/x.png`, U.a4],
      "row-level security",
    );
  });
  // Archived room: read-only, no uploads; a malformed folder is refused too.
  await db.asUser(U.a2, async (tx) => {
    await tx.expectError(
      "insert into storage.objects (bucket_id, name, owner) values ('room-files', $1, $2)",
      [`${ROOM.r2}/x.png`, U.a2],
      "row-level security",
    );
    await tx.expectError(
      "insert into storage.objects (bucket_id, name, owner) values ('room-files', 'oops/x.png', $1)",
      [U.a2],
      "row-level security",
    );
  });
});
