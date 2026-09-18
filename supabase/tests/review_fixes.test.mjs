// supabase/tests/review_fixes.test.mjs
// Regression tests for the security review findings (profiles mini view,
// room status moderation, rooms creator branch, avatar_url, soft-deleted
// message visibility, realtime publication, update_room, admin stats,
// deactivation releasing room seats).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb, expectError } from "./db.mjs";
import { U, ROOM, MSG, INV, COURSE, become } from "./fixtures.mjs";

let db;
before(async () => {
  db = await createDb();
});
after(async () => {
  await db?.close();
});

const MINI_COLUMNS = ["id", "full_name", "avatar_url", "institution_id", "department_id", "study_year"];

test("fix: classmates get only the public mini profile, not the full profiles row", async () => {
  await db.asUser(U.a4, async (tx) => {
    // a4 shares CS-201 with a1, but the table itself is own/admin only.
    const table = await tx.query(
      "select id, role, is_active, last_seen_at, bio, created_at from public.profiles where id = $1",
      [U.a1],
    );
    assert.equal(table.rows.length, 0, "classmate must not read the full profiles row");
    const all = await tx.one("select count(*)::int n from public.profiles");
    assert.equal(all.n, 1, "only the caller's own row is visible in profiles");

    const own = await tx.one("select bio, role, last_seen_at from public.profiles where id = $1", [U.a4]);
    assert.equal(own.role, "student");

    const { rows, fields } = await tx.query("select * from public.public_profiles where id = $1", [U.a1]);
    assert.equal(rows.length, 1, "mini profile of a classmate is visible");
    assert.deepEqual(fields.map((f) => f.name), MINI_COLUMNS);
    await tx.expectError("select bio from public.public_profiles", "does not exist");
    await tx.expectError("select last_seen_at from public.public_profiles", "does not exist");

    // No shared course / room with the admin -> not visible.
    const adminRow = await tx.query("select 1 from public.public_profiles where id = $1", [U.admin]);
    assert.equal(adminRow.rows.length, 0);
  });

  // Super admin still reads full rows.
  await db.asUser(U.admin, async (tx) => {
    const r = await tx.one("select bio, last_seen_at, role from public.profiles where id = $1", [U.a1]);
    assert.ok(r.bio);
  });

  const anon = await db.asAnon((tx) => tx.query("select 1 from public.public_profiles")).catch((e) => e);
  assert.ok(anon instanceof Error && /permission denied/i.test(anon.message), "anon cannot read public_profiles");
});

test("fix: roommates keep seeing each other's mini profile after the shared enrollment is archived", async () => {
  await db.asOwner(async (tx) => {
    await tx.query(
      "update public.enrollments set status = 'archived' where user_id = $1 and course_id = any($2::uuid[])",
      [U.a5, [COURSE.cs201, COURSE.math110]],
    );
    // a2 is still an active member of R2, where a5 is a member.
    await become(tx, U.a2);
    const r = await tx.query("select full_name from public.public_profiles where id = $1", [U.a5]);
    assert.equal(r.rows.length, 1, "roommate name must stay visible in room history");
    // a1 no longer shares a course or a room with a5.
    await become(tx, U.a1);
    const none = await tx.query("select 1 from public.public_profiles where id = $1", [U.a5]);
    assert.equal(none.rows.length, 0);
  });
});

test("fix: owner cannot reactivate a room archived by a super_admin; owner reactivation needs enrollment", async () => {
  await db.asOwner(async (tx) => {
    await become(tx, U.admin);
    await tx.query("select public.set_room_status($1, 'archived')", [ROOM.r1]);
    await become(tx, "owner");
    let row = await tx.one("select archived_by::text, archived_by_admin from public.rooms where id = $1", [ROOM.r1]);
    assert.deepEqual(row, { archived_by: U.admin, archived_by_admin: true });

    await become(tx, U.a1);
    await tx.expectError("select public.set_room_status($1, 'active')", [ROOM.r1], "ROOM_ARCHIVED_BY_ADMIN");
    const forged = await tx.query("update public.rooms set archived_by_admin = false where id = $1", [ROOM.r1]).catch((e) => e);
    if (forged instanceof Error) assert.match(forged.message, /permission denied|row-level security/i);
    else assert.equal(forged.affectedRows ?? 0, 0);
    await become(tx, "owner");
    assert.equal((await tx.one("select status from public.rooms where id = $1", [ROOM.r1])).status, "archived");

    // Admin may reactivate; flags are cleared.
    await become(tx, U.admin);
    await tx.query("select public.set_room_status($1, 'active')", [ROOM.r1]);
    await become(tx, "owner");
    row = await tx.one("select status, archived_by, archived_by_admin from public.rooms where id = $1", [ROOM.r1]);
    assert.deepEqual(row, { status: "active", archived_by: null, archived_by_admin: false });

    // Owner archive -> owner reactivate is fine.
    await become(tx, U.a1);
    await tx.query("select public.set_room_status($1, 'archived')", [ROOM.r1]);
    await become(tx, "owner");
    row = await tx.one("select archived_by::text, archived_by_admin from public.rooms where id = $1", [ROOM.r1]);
    assert.deepEqual(row, { archived_by: U.a1, archived_by_admin: false });
    await become(tx, U.a1);
    await tx.query("select public.set_room_status($1, 'active')", [ROOM.r1]);

    // Owner no longer enrolled -> cannot reactivate.
    await tx.query("select public.set_room_status($1, 'archived')", [ROOM.r1]);
    await become(tx, "owner");
    await tx.query("update public.enrollments set status = 'archived' where user_id = $1 and course_id = $2", [U.a1, COURSE.cs201]);
    await become(tx, U.a1);
    await tx.expectError("select public.set_room_status($1, 'active')", [ROOM.r1], "NOT_ALLOWED");

    // Admin archiving via direct UPDATE (policy path) is also flagged.
    await become(tx, U.admin);
    await tx.query("update public.rooms set status = 'active' where id = $1", [ROOM.r1]);
    await tx.query("update public.rooms set status = 'archived' where id = $1", [ROOM.r1]);
    await become(tx, "owner");
    row = await tx.one("select archived_by_admin from public.rooms where id = $1", [ROOM.r1]);
    assert.equal(row.archived_by_admin, true);
  });
});

test("fix: rooms SELECT — insert().select() works, but a creator who left loses the room metadata", async () => {
  await db.asUser(U.a4, async (tx) => {
    const r = await tx.query(
      "insert into public.rooms (course_id, created_by, name) values ($1, $2, 'returning test') returning id, name",
      [COURSE.cs201, U.a4],
    );
    assert.equal(r.rows.length, 1, "INSERT ... RETURNING must work for the creator");
    const again = await tx.query("select 1 from public.rooms where id = $1", [r.rows[0].id]);
    assert.equal(again.rows.length, 1);
  });

  await db.asUser(U.a1, async (tx) => {
    assert.equal((await tx.query("select 1 from public.rooms where id = $1", [ROOM.r1])).rows.length, 1);
    await tx.query("select public.leave_room($1)", [ROOM.r1]);
    const after = await tx.query("select name, topic, status, last_message_at from public.rooms where id = $1", [ROOM.r1]);
    assert.equal(after.rows.length, 0, "creator who left must not see the room anymore");
  });
});

test("fix: avatar_url only accepts an object path under the user's own avatars folder", async () => {
  await db.asUser(U.a4, async (tx) => {
    for (const bad of [
      "https://attacker.example/t.png?u=a4",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      `${U.a1}/avatar.png`,
      `${U.a4}/../x.png`,
      `${U.a4}/sub/x.png`,
    ]) {
      await tx.expectError(
        "update public.profiles set avatar_url = $1 where id = $2",
        [bad, U.a4],
        "profiles_avatar_url_own_object_path",
      );
    }
    const ok = await tx.query("update public.profiles set avatar_url = $1 where id = $2", [`${U.a4}/avatar-1.webp`, U.a4]);
    assert.equal(ok.affectedRows, 1);
    const cleared = await tx.query("update public.profiles set avatar_url = null where id = $1", [U.a4]);
    assert.equal(cleared.affectedRows, 1);
  });
});

test("fix: soft-deleted message is hidden from other members; deletion is broadcast without content", async () => {
  await db.asOwner(async (tx) => {
    await become(tx, U.a2);
    const m = await tx.one(
      "insert into public.messages (room_id, sender_id, sender_type, content) values ($1, $2, 'user', 'secret by mistake') returning id::text",
      [ROOM.r1, U.a2],
    );
    await become(tx, U.a3);
    assert.equal((await tx.query("select 1 from public.messages where id = $1", [m.id])).rows.length, 1, "control");

    await become(tx, U.a2);
    await tx.query("select public.soft_delete_message($1)", [m.id]);
    const own = await tx.one("select content, deleted_at from public.messages where id = $1", [m.id]);
    assert.equal(own.content, "secret by mistake", "content is immutable, sender still sees own row");
    assert.notEqual(own.deleted_at, null);

    await become(tx, U.a3);
    const other = await tx.query("select content from public.messages where room_id = $1 and deleted_at is not null", [ROOM.r1]);
    assert.equal(other.rows.length, 0, "other members cannot read deleted content");
    assert.equal((await tx.query("select 1 from public.messages where id = $1", [m.id])).rows.length, 0);

    await become(tx, "owner");
    const { rows } = await tx.query(
      "select topic, extension, private, payload from realtime.messages where event = 'message_deleted'",
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].topic, `room:${ROOM.r1}`);
    assert.equal(rows[0].private, true);
    assert.deepEqual(Object.keys(rows[0].payload).sort(), ["id", "room_id"]);
    assert.ok(!JSON.stringify(rows[0].payload).includes("secret"));

    // The broadcast is receivable by room members only.
    await tx.query(`select set_config('realtime.topic', $1, true)`, [`room:${ROOM.r1}`]);
    await become(tx, U.a3);
    assert.equal((await tx.query("select 1 from realtime.messages where event = 'message_deleted'")).rows.length, 1);
    await become(tx, U.a4);
    assert.equal((await tx.query("select 1 from realtime.messages where event = 'message_deleted'")).rows.length, 0);
  });
});

test("fix: public.messages is in the supabase_realtime publication", async () => {
  const r = await db.query(
    "select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'",
  );
  assert.equal(r.rows.length, 1);
});

test("fix: update_room — owner renames / toggles AI; member, non-member and archived room are refused", async () => {
  await db.asOwner(async (tx) => {
    await become(tx, U.a1);
    await tx.query("select public.update_room($1, $2, $3, $4)", [ROOM.r1, "  שם חדש  ", "נושא חדש", false]);
    await become(tx, "owner");
    let r = await tx.one("select name, topic, ai_enabled, status from public.rooms where id = $1", [ROOM.r1]);
    assert.deepEqual(r, { name: "שם חדש", topic: "נושא חדש", ai_enabled: false, status: "active" });

    // NULL = unchanged; blank topic clears.
    await become(tx, U.a1);
    await tx.query("select public.update_room($1, null, '  ', null)", [ROOM.r1]);
    await become(tx, "owner");
    r = await tx.one("select name, topic, ai_enabled from public.rooms where id = $1", [ROOM.r1]);
    assert.deepEqual(r, { name: "שם חדש", topic: null, ai_enabled: false });

    await become(tx, U.a1);
    await tx.expectError("select public.update_room($1, '   ', null, null)", [ROOM.r1], "INVALID_ARGUMENT");
    await become(tx, U.a2); // member, not owner of R1
    await tx.expectError("select public.update_room($1, 'x', null, true)", [ROOM.r1], "NOT_ALLOWED");
    await become(tx, U.a4); // not a member
    await tx.expectError("select public.update_room($1, 'x', null, true)", [ROOM.r1], "NOT_ALLOWED");
    await become(tx, U.a2); // owner of archived R2
    await tx.expectError("select public.update_room($1, 'x', null, null)", [ROOM.r2], "ROOM_NOT_ACTIVE");

    await become(tx, U.admin);
    await tx.query("select public.update_room($1, null, null, true)", [ROOM.r2]);
    await become(tx, "owner");
    assert.equal((await tx.one("select ai_enabled from public.rooms where id = $1", [ROOM.r1])).ai_enabled, false);
  });
  await expectError(db.asAnon((tx) => tx.query("select public.update_room($1, 'x')", [ROOM.r1])), "permission denied");
});

test("fix: admin stats RPCs return aggregates to super_admin only", async () => {
  await db.asUser(U.a1, async (tx) => {
    await tx.expectError("select * from public.admin_room_stats()", "NOT_ALLOWED");
    await tx.expectError("select public.admin_global_stats()", "NOT_ALLOWED");
  });
  await db.asUser(U.admin, async (tx) => {
    const { rows, fields } = await tx.query(
      "select room_id::text, member_count::int, message_count::int, last_message_at from public.admin_room_stats()",
    );
    assert.deepEqual(fields.map((f) => f.name), ["room_id", "member_count", "message_count", "last_message_at"]);
    const byRoom = Object.fromEntries(rows.map((r) => [r.room_id, r]));
    assert.equal(byRoom[ROOM.r1].message_count, 5);
    assert.equal(byRoom[ROOM.r1].member_count, 3);
    assert.equal(byRoom[ROOM.r2].message_count, 3);
    assert.equal(byRoom[ROOM.r2].member_count, 2);

    const g = (await tx.one("select public.admin_global_stats() s")).s;
    assert.equal(Number(g.messages_total), 8);
    assert.equal(Number(g.rooms_total), 2);
    assert.equal(Number(g.users_total), 6);
    // Still no raw message access for the admin.
    assert.equal((await tx.one("select count(*)::int n from public.messages")).n, 0);
  });
  await expectError(db.asAnon((tx) => tx.query("select public.admin_global_stats()")), "permission denied");
});

test("fix: deactivating a profile frees its room seats, hands off ownership and revokes its invitations", async () => {
  await db.asOwner(async (tx) => {
    // Fill R1 to 4 members.
    await become(tx, U.a4);
    await tx.query("select public.accept_room_invitation($1)", [INV.i1_a4_valid]);
    await become(tx, "owner");
    assert.equal(
      (await tx.one("select count(*)::int n from public.room_members where room_id = $1 and left_at is null", [ROOM.r1])).n,
      4,
    );
    // a1 (owner R1) sent a still-'pending' invitation (I2, expired by date).
    await become(tx, U.admin);
    const upd = await tx.query("update public.profiles set is_active = false where id = $1", [U.a1]);
    assert.equal(upd.affectedRows, 1);

    await become(tx, "owner");
    const members = await tx.query(
      "select user_id::text, role from public.room_members where room_id = $1 and left_at is null order by user_id",
      [ROOM.r1],
    );
    assert.equal(members.rows.length, 3, "deactivated owner no longer occupies a seat");
    assert.ok(!members.rows.some((m) => m.user_id === U.a1));
    const owners = members.rows.filter((m) => m.role === "owner");
    assert.deepEqual(owners, [{ user_id: U.a2, role: "owner" }], "ownership handed to longest-standing active member");
    const inv = await tx.one("select status from public.room_invitations where id = $1", [INV.i2_a5_expired]);
    assert.equal(inv.status, "revoked");

    // The new owner can manage the room and a new member can be invited into the freed seat.
    await become(tx, U.a2);
    await tx.query(
      "insert into public.room_invitations (room_id, inviter_id, invitee_user_id) values ($1, $2, $3)",
      [ROOM.r1, U.a2, U.a5],
    );
    await tx.query("select public.remove_room_member($1, $2)", [ROOM.r1, U.a3]);
  });

  // Mechanism: leave_room hand-off also skips inactive profiles.
  await db.asOwner(async (tx) => {
    // Make a2 inactive without the trigger path to simulate a legacy row.
    await tx.exec("alter table public.profiles disable trigger profiles_release_rooms_on_deactivation");
    await tx.query("update public.profiles set is_active = false where id = $1", [U.a2]);
    await tx.exec("alter table public.profiles enable trigger profiles_release_rooms_on_deactivation");
    await become(tx, U.a1);
    await tx.query("select public.leave_room($1)", [ROOM.r1]);
    await become(tx, "owner");
    const owner = await tx.one(
      "select user_id::text from public.room_members where room_id = $1 and role = 'owner' and left_at is null",
      [ROOM.r1],
    );
    assert.equal(owner.user_id, U.a3, "inactive a2 is skipped, a3 becomes owner");
  });
});
