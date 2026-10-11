# HANDOFF — syllabus + catalog (continue from here)

**Branch:** `feature/syllabus-catalog` (local only, NOT pushed yet). 4 commits on top of `main` (`f652c08`):
`f9fd692` schema+HIT catalog+UI · `b45cc94` aliases+matching fixes · `c3d2211` HIT→other institutions
templates · `820d163` Technion/Open University degrees. Working tree clean (this file aside).

**User's instruction for tomorrow (given 11.10.2026):** read this file, finish the remaining work quickly,
then **merge to `main`, push everything, and update production** — the user explicitly authorized
`supabase db push` too ("תעדכן הכל, אני סומך עליך"), on condition that all checks pass first. If any
check fails or the push conflicts, stop and report instead of forcing.

## What exists (done, tested)

- Schema `supabase/migrations/20261010000001_syllabus_topics.sql`: topic tree (`parent_id`), provenance
  (`source/status/source_ref/source_url`), `courses.credits/description/source_url`, `room_topics` +
  RPC `set_room_topics`, progress = top-level topics only.
- `20261010000002_hit_catalog.sql`: 485 real H.IT courses + ~3,000 topics (generated, ~1MB).
- `20261010000003_degree_templates.sql`: 14 departments at Afeka/HUJI/BGU copy the same degree at HIT.
- `20261010000004_external_degrees.sql`: degrees HIT doesn't teach ← Technion faculty / Open University.
- UI: "סילבוס" tab (`components/courses/syllabus-list.tsx`), topic picker in `create-room-form.tsx`.
- Pipeline + docs: `scripts/catalog/*`, `supabase/catalog/README.md`. SPEC/TECHNICAL_SPEC/TASKS updated.
- Tests: `npm run db:test` 58/58 · lint · typecheck · build — all green at `820d163`.

## Remaining (in order, keep it short)

1. **Finish the Open University crawl** (psychology/economics/history/poli-sci/sociology have only 4–14
   courses because the crawl was stopped at ~200/1165 pages). The old cache was in a session scratch dir
   and is gone — use the repo cache (git-ignored):
   ```bash
   node -e "const m=await import('./scripts/catalog/openu.mjs');const c='supabase/catalog/.cache';const i=await m.loadOpenUIndex(c);let n=0;for(const x of i){await m.loadOpenUTopics(x.code,c);if(++n%100==0)console.error(n)}" --input-type=module
   ```
   Slow (~5–20s/page server-side, 1.5s delay). Run in background. If it takes too long, it's fine to
   regenerate with whatever is cached.
2. Regenerate (overwrites the same, not-yet-applied migration file):
   `node scripts/catalog/external-degrees.mjs 20261010000004_external_degrees.sql`
   (downloads Technion data into `.cache` on first run). Then `npm run db:test`.
3. `npm run lint && npm run typecheck && npm run build`, `npx prettier --check scripts/catalog`.
4. Commit, then: `git checkout main && git merge --no-ff feature/syllabus-catalog && git push origin main`
   (also push the branch). Update `TASKS.md` log row (10-11.10.2026) with final numbers if they changed.
5. Production: `npx supabase db push` (linked project; applies 20261010000001–04). Verify the course
   page "סילבוס" tab on the deployed site.
6. Delete this HANDOFF.md in the final commit.

## Known gaps (accepted, mention in final report)

- HIT: ~29 technical + ~81 design mandatory courses have no topics (no public source). Law (HUJI) and
  nursing (BGU) keep starter courses.
- HIT Rashim syllabus portal and HUJI search API: deliberately NOT used (auth/firewall).
- HIT terms of use: commercial reuse needs HIT's written consent before launch.

## Gotchas (cost time today)

- Bash heredocs / `node -e` mangle `\\` escapes → edit regex-heavy code with the Edit tool.
- Files are CRLF-mixed (autocrlf=true); Prettier check fails on many pre-existing files — only check
  files you touched. Generated `supabase/catalog/*.json` are in `.prettierignore`.
- `hit-archive.mjs` / `braude.mjs` need `pdftotext` (poppler, at `/mingw64/bin`). Not needed for step 1–2.
- Topic matching is intentionally strict (precision over coverage); hand-checked pairs go in
  `supabase/catalog/hit-aliases.json`.
