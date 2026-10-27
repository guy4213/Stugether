// supabase/tests/onboarding.test.mjs
// 20261027000001_onboarding.sql — the signup wizard (SPEC §4.1, CR 27.10.2026):
// onboarded_at, study_times / learning_styles, public_profiles, and
// complete_onboarding (answers + enrollments in one transaction).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "./db.mjs";
import { U, COURSE } from "./fixtures.mjs";

const NEW_USER = "00000000-0000-0000-0000-0000000000b1";
const INST = "00000000-0000-0000-0001-000000000001";
const DEPT_CS = "00000000-0000-0000-0002-000000000001";
const OTHER_INST = "00000000-0000-0000-0001-0000000000f1";
const OTHER_DEPT = "00000000-0000-0000-0002-0000000000f1";
const OTHER_COURSE = "00000000-0000-0000-0003-0000000000f1";

let base;
before(async () => {
  base = await createDb();
  // A fresh signup (handle_new_user creates the profile) and a second
  // institution with its own department and course.
  await base.asOwner(
    async (tx) => {
      await tx.query(
        `insert into auth.users (id, aud, role, email, raw_user_meta_data)
         values ($1, 'authenticated', 'authenticated', 'new@stugether.test', '{}'::jsonb)`,
        [NEW_USER],
      );
      await tx.query(`insert into public.institutions (id, name) values ($1, 'מוסד אחר')`, [
        OTHER_INST,
      ]);
      await tx.query(
        `insert into public.departments (id, institution_id, name) values ($1, $2, 'מחלקה אחרת')`,
        [OTHER_DEPT, OTHER_INST],
      );
      await tx.query(
        `insert into public.courses (id, institution_id, department_id, name)
         values ($1, $2, $3, 'קורס אחר')`,
        [OTHER_COURSE, OTHER_INST, OTHER_DEPT],
      );
    },
    { commit: true },
  );
});
after(async () => {
  await base?.close();
});

async function fresh(t) {
  const db = await base.fork();
  t.after(() => db.close());
  return db;
}

const answers = (overrides = {}) => ({
  name: "  דנה ישראלי ",
  institution: INST,
  department: DEPT_CS,
  year: 1,
  semester: 1,
  track: "evening",
  hobbies: ["ריצה", "צילום", "שחמט"],
  times: ["evening", "night"],
  styles: ["exercises", "group", "sample_exams"],
  courses: [COURSE.cs101, COURSE.cs201],
  ...overrides,
});

const complete = (db, user, a = answers(), options = {}) =>
  db.asUser(
    user,
    (tx) =>
      tx.one(
        `select public.complete_onboarding($1, $2, $3, $4::smallint, $5::smallint, $6,
                $7::text[], $8::text[], $9::text[], $10::uuid[]) n`,
        [
          a.name,
          a.institution,
          a.department,
          a.year,
          a.semester,
          a.track,
          a.hobbies,
          a.times,
          a.styles,
          a.courses,
        ],
      ),
    options,
  );

const profile = (db, user) =>
  db.one(
    `select full_name, institution_id::text, department_id::text, study_year, semester, track,
            hobbies, study_times, learning_styles, onboarded_at
       from public.profiles where id = $1`,
    [user],
  );

test("seed students and the admin count as onboarded; a new signup does not", async (t) => {
  const db = await fresh(t);
  const { n } = await db.one(
    "select count(*)::int n from public.profiles where onboarded_at is null and id <> $1",
    [NEW_USER],
  );
  assert.equal(n, 0);
  assert.equal((await profile(db, U.admin)).onboarded_at !== null, true);
  assert.equal((await profile(db, NEW_USER)).onboarded_at, null);
});

test("complete_onboarding saves the answers, enrolls and marks onboarded", async (t) => {
  const db = await fresh(t);
  const { n } = await complete(db, NEW_USER, answers(), { commit: true });
  assert.equal(n, 2);

  const p = await profile(db, NEW_USER);
  assert.equal(p.full_name, "דנה ישראלי");
  assert.equal(p.institution_id, INST);
  assert.equal(p.department_id, DEPT_CS);
  assert.equal(p.study_year, 1);
  assert.equal(p.semester, 1);
  assert.equal(p.track, "evening");
  assert.deepEqual(p.hobbies, ["ריצה", "צילום", "שחמט"]);
  assert.deepEqual([...p.study_times].sort(), ["evening", "night"]);
  assert.deepEqual(p.learning_styles, ["exercises", "group", "sample_exams"]);
  assert.ok(p.onboarded_at);

  const { rows } = await db.query(
    "select course_id::text from public.enrollments where user_id = $1 and status = 'active'",
    [NEW_USER],
  );
  assert.deepEqual(rows.map((r) => r.course_id).sort(), [COURSE.cs101, COURSE.cs201].sort());
});

test("a second call is rejected", async (t) => {
  const db = await fresh(t);
  await complete(db, NEW_USER, answers(), { commit: true });
  await assert.rejects(complete(db, NEW_USER), /ALREADY_ONBOARDED/);
  // Seed students finished the old onboarding.
  await assert.rejects(complete(db, U.a1), /ALREADY_ONBOARDED/);
});

test("the department and the courses must belong to the institution", async (t) => {
  const db = await fresh(t);
  await assert.rejects(
    complete(db, NEW_USER, answers({ department: OTHER_DEPT })),
    /INVALID_DEPARTMENT/,
  );
  await assert.rejects(
    complete(db, NEW_USER, answers({ courses: [COURSE.cs101, OTHER_COURSE] })),
    /INVALID_COURSES/,
  );
  await assert.rejects(complete(db, NEW_USER, answers({ courses: [] })), /INVALID_COURSES/);
  // Nothing was written.
  assert.equal((await profile(db, NEW_USER)).onboarded_at, null);
});

test("exactly 3 hobbies and 3 learning styles, at least one study time", async (t) => {
  const db = await fresh(t);
  for (const bad of [
    { hobbies: ["ריצה", "צילום"] },
    { hobbies: ["ריצה", "ריצה", "צילום"] },
    { styles: ["exercises", "group"] },
    { styles: ["exercises", "group", "pairs", "summaries"] },
    { times: [] },
    { track: "online" },
    { year: 0 },
    { name: "   " },
  ]) {
    await assert.rejects(
      complete(db, NEW_USER, answers(bad)),
      /INVALID_ARGUMENT/,
      JSON.stringify(bad),
    );
  }
  await assert.rejects(complete(db, NEW_USER, answers({ times: ["dawn"] })), /study_times/);
  await assert.rejects(
    complete(db, NEW_USER, answers({ styles: ["exercises", "group", "napping"] })),
    /learning_styles/,
  );
});

test("anon cannot call complete_onboarding", async (t) => {
  const db = await fresh(t);
  await assert.rejects(
    db.asAnon((tx) =>
      tx.query(
        `select public.complete_onboarding('x', null, null, null, null, null, null, null, null, null)`,
      ),
    ),
    /permission denied/,
  );
});

test("public_profiles exposes study times and learning styles", async (t) => {
  const db = await fresh(t);
  await complete(db, NEW_USER, answers(), { commit: true });
  const row = await db.asUser(U.a1, (tx) =>
    tx.one("select study_times, learning_styles from public.public_profiles where id = $1", [
      NEW_USER,
    ]),
  );
  assert.deepEqual(row.learning_styles, ["exercises", "group", "sample_exams"]);
  assert.equal(row.study_times.length, 2);
});
