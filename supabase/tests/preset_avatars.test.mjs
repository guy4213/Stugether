// supabase/tests/preset_avatars.test.mjs
// 20261112000002_preset_avatars.sql — avatar_url accepts the 12 bundled
// avatars besides the owner's own storage path, and nothing else.
import test, { before, after } from "node:test";
import { createDb } from "./db.mjs";
import { U } from "./fixtures.mjs";

let base;
before(async () => {
  base = await createDb();
});
after(async () => {
  await base?.close();
});

const setAvatar = "update public.profiles set avatar_url = $1 where id = $2";

test("avatar_url: a bundled preset is accepted", async () => {
  await base.asUser(U.a1, async (tx) => {
    await tx.query(setAvatar, ["presets/avatar-01.svg", U.a1]);
    await tx.query(setAvatar, ["presets/avatar-12.svg", U.a1]);
    await tx.query(setAvatar, [`${U.a1}/avatar-1.png`, U.a1]);
  });
});

test("avatar_url: unknown presets, URLs and other users' paths are rejected", async () => {
  for (const bad of [
    "presets/avatar-13.svg",
    "presets/avatar-00.svg",
    "presets/../x.svg",
    "https://evil.example/a.png",
    `${U.a2}/avatar-1.png`,
  ]) {
    await base.asUser(U.a1, (tx) =>
      tx.expectError(setAvatar, [bad, U.a1], "profiles_avatar_url_own_object_path"),
    );
  }
});
