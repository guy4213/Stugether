// supabase/tests/db.mjs
// Docker-free Postgres for RLS / RPC tests, using PGlite (Postgres compiled to WASM).
//
//   import { createDb, expectError } from './db.mjs';
//   const t = await createDb();
//   await t.asUser(userId, async (tx) => {
//     const { rows } = await tx.query('select * from public.messages');
//     await tx.expectError('insert into public.messages ...', 'row-level security');
//   });
//
// Load order: shim.sql -> supabase/migrations/*.sql (sorted by name) -> supabase/seed.sql.
// Every helper transaction ROLLS BACK unless { commit: true } is passed.

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SUPABASE_DIR = path.resolve(here, "..");

async function loadPgcrypto() {
  try {
    const mod = await import("@electric-sql/pglite/contrib/pgcrypto");
    return mod.pgcrypto ?? null;
  } catch {
    return null;
  }
}

/** Render a SQL error with the file name and the lines around the failing position. */
export function formatSqlError(err, sql, label) {
  const out = [
    `\n[db harness] FAILED loading ${label}`,
    `  ${err.severity ?? "ERROR"} ${err.code ?? ""}: ${err.message}`,
  ];
  if (err.detail) out.push(`  DETAIL: ${err.detail}`);
  if (err.hint) out.push(`  HINT: ${err.hint}`);
  if (err.where) out.push(`  WHERE: ${err.where}`);
  const context = (text, pos, title) => {
    const idx = Number(pos) - 1;
    if (!Number.isFinite(idx) || idx < 0 || !text) return;
    const before = text.slice(0, idx);
    const lineNo = before.split("\n").length;
    const col = idx - before.lastIndexOf("\n");
    const lines = text.split("\n");
    out.push(`  ${title} line ${lineNo}, column ${col}:`);
    for (let i = Math.max(1, lineNo - 3); i <= Math.min(lines.length, lineNo + 3); i++) {
      out.push(`  ${i === lineNo ? ">" : " "} ${String(i).padStart(5)} | ${lines[i - 1]}`);
      if (i === lineNo) out.push(`          | ${" ".repeat(Math.max(0, col - 1))}^`);
    }
  };
  if (err.position) context(sql, err.position, `${label}`);
  if (err.internalQuery) {
    out.push(`  INTERNAL QUERY: ${err.internalQuery}`);
    if (err.internalPosition) context(err.internalQuery, err.internalPosition, "internal query");
  }
  if (!err.position && !err.internalQuery && /line \d+/.test(err.where ?? "")) {
    out.push("  (line number in WHERE is relative to the function body)");
  }
  return out.join("\n");
}

async function runFile(db, file, label) {
  const sql = await readFile(file, "utf8");
  try {
    await db.exec(sql);
  } catch (err) {
    const wrapped = new Error(formatSqlError(err, sql, label));
    wrapped.cause = err;
    wrapped.file = file;
    console.error(wrapped.message);
    throw wrapped;
  }
}

/**
 * Assert that `promise` rejects and that the error mentions `substring`
 * (matched against message, code, detail and hint). Returns the error.
 */
export async function expectError(promise, substring) {
  let result;
  try {
    result = typeof promise === "function" ? await promise() : await promise;
  } catch (err) {
    if (substring) {
      const haystack = [err?.message, err?.code, err?.detail, err?.hint]
        .filter(Boolean)
        .join(" | ");
      if (!haystack.toLowerCase().includes(String(substring).toLowerCase())) {
        const e = new Error(`expected error containing "${substring}" but got: ${haystack}`);
        e.cause = err;
        throw e;
      }
    }
    return err;
  }
  const e = new Error(
    `expected error${substring ? ` containing "${substring}"` : ""} but the statement succeeded` +
      (result?.rows ? ` (${result.rows.length} row(s))` : ""),
  );
  throw e;
}

let savepointSeq = 0;

function makeCtx(tx) {
  const ctx = {
    tx,
    query: (sql, params) => tx.query(sql, params),
    exec: (sql) => tx.exec(sql),
    sql: (...a) => tx.sql(...a),
    /** First row or undefined. */
    one: async (sql, params) => (await tx.query(sql, params)).rows[0],
    /** Run fn inside a SAVEPOINT; roll back to it on error (and rethrow). */
    async savepoint(fn) {
      const name = `sp_${++savepointSeq}`;
      await tx.exec(`SAVEPOINT ${name}`);
      try {
        const r = await fn(ctx);
        await tx.exec(`RELEASE SAVEPOINT ${name}`);
        return r;
      } catch (err) {
        await tx.exec(`ROLLBACK TO SAVEPOINT ${name}`);
        throw err;
      }
    },
    /**
     * Expect a statement to fail without aborting the surrounding transaction.
     * `stmt` is a SQL string (with optional params) or a function (ctx) => promise.
     *   tx.expectError('update public.messages set content = $1', ['x'], 'permission')
     *   tx.expectError(sql, 'row-level security')
     */
    expectError(stmt, params, substring) {
      if (typeof params === "string" && substring === undefined) {
        substring = params;
        params = undefined;
      }
      const run = typeof stmt === "function" ? () => stmt(ctx) : () => tx.query(stmt, params);
      return expectError(ctx.savepoint(run), substring);
    },
    /** Set realtime.topic for the rest of this transaction. */
    withTopic: (topic) => withTopic(tx, topic),
  };
  return ctx;
}

/** Set realtime.topic (transaction-local) on a transaction / ctx. */
export async function withTopic(txOrCtx, topic) {
  const tx = txOrCtx.tx ?? txOrCtx;
  await tx.query(`select set_config('realtime.topic', $1, true)`, [topic ?? ""]);
}

/**
 * Create a fresh in-memory database with shim + migrations + seed loaded.
 * @param {object} [opts]
 * @param {string} [opts.migrationsDir]  default supabase/migrations
 * @param {string|null} [opts.seedFile]  default supabase/seed.sql (null = skip)
 */
export async function createDb(opts = {}) {
  const migrationsDir = opts.migrationsDir ?? path.join(SUPABASE_DIR, "migrations");
  const seedFile =
    opts.seedFile === undefined ? path.join(SUPABASE_DIR, "seed.sql") : opts.seedFile;

  const pgcrypto = await loadPgcrypto();
  const db = new PGlite(pgcrypto ? { extensions: { pgcrypto } } : {});
  await db.waitReady;

  const loaded = [];
  try {
    await db.exec("CREATE SCHEMA IF NOT EXISTS extensions;");
    if (pgcrypto) {
      await db.exec("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;");
    }
    await runFile(db, path.join(here, "shim.sql"), "supabase/tests/shim.sql");
    loaded.push("supabase/tests/shim.sql");

    if (existsSync(migrationsDir)) {
      const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
      for (const f of files) {
        const label = `supabase/migrations/${f}`;
        await runFile(db, path.join(migrationsDir, f), label);
        loaded.push(label);
      }
    }
    if (seedFile && existsSync(seedFile)) {
      await runFile(db, seedFile, "supabase/seed.sql");
      loaded.push("supabase/seed.sql");
    }
  } catch (err) {
    await db.close().catch(() => {});
    throw err;
  }

  return makeApi(db, { loaded, hasPgcrypto: Boolean(pgcrypto) });
}

function makeApi(db, meta) {
  /**
   * Run fn(ctx) in a transaction as `role` with the given JWT claims.
   * Rolls back unless options.commit is true. Returns fn's result.
   */
  async function asRole(role, claims, fn, options = {}) {
    if (!["anon", "authenticated", "service_role"].includes(role))
      throw new Error(`bad role ${role}`);
    let result;
    await db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      if (options.topic !== undefined) await withTopic(tx, options.topic);
      await tx.exec(`SET LOCAL ROLE ${role}`);
      result = await fn(makeCtx(tx));
      if (!options.commit && !tx.closed) await tx.rollback();
    });
    return result;
  }

  const api = {
    db,
    loaded: meta.loaded,
    hasPgcrypto: meta.hasPgcrypto,
    /** Independent copy of the current database state (fast; avoids reloading migrations). */
    fork: async () => makeApi(await db.clone(), meta),
    /** Query as the migration owner (superuser, bypasses RLS). */
    query: (sql, params) => db.query(sql, params),
    exec: (sql) => db.exec(sql),
    one: async (sql, params) => (await db.query(sql, params)).rows[0],

    asUser(userId, fn, options = {}) {
      if (!userId) throw new Error("asUser requires a user id");
      const claims = {
        sub: userId,
        role: "authenticated",
        aud: "authenticated",
        ...(options.claims ?? {}),
      };
      return asRole("authenticated", claims, fn, options);
    },
    asAnon(fn, options = {}) {
      return asRole("anon", { role: "anon", ...(options.claims ?? {}) }, fn, options);
    },
    asService(fn, options = {}) {
      return asRole(
        "service_role",
        { role: "service_role", ...(options.claims ?? {}) },
        fn,
        options,
      );
    },
    /** Run fn(ctx) as the superuser inside a transaction (rolled back unless commit). */
    async asOwner(fn, options = {}) {
      let result;
      await db.transaction(async (tx) => {
        result = await fn(makeCtx(tx));
        if (!options.commit && !tx.closed) await tx.rollback();
      });
      return result;
    },

    /**
     * Emulates Supabase Realtime Authorization for a private channel:
     *  read  = a row inserted (as superuser) for `topic` is visible to the user via SELECT policies
     *  write = the user may INSERT a row for `topic` (INSERT policies)
     * userId null = anon.
     */
    async realtimeAccess(userId, topic, { extension = "broadcast" } = {}) {
      let read = false;
      let write = false;
      await db.transaction(async (tx) => {
        await withTopic(tx, topic);
        const { rows } = await tx.query(
          `insert into realtime.messages (topic, extension, private, event, payload)
           values ($1, $2, true, 'probe', '{}'::jsonb) returning id`,
          [topic, extension],
        );
        const id = rows[0].id;
        const role = userId ? "authenticated" : "anon";
        const claims = userId ? { sub: userId, role } : { role };
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify(claims),
        ]);
        await tx.exec(`SET LOCAL ROLE ${role}`);
        const ctx = makeCtx(tx);
        try {
          read = await ctx.savepoint(
            async () =>
              (await tx.query("select 1 from realtime.messages where id = $1", [id])).rows.length >
              0,
          );
        } catch {
          read = false;
        }
        try {
          await ctx.savepoint(() =>
            tx.query(
              `insert into realtime.messages (topic, extension, private, event, payload)
               values ($1, $2, true, 'probe', '{}'::jsonb)`,
              [topic, extension],
            ),
          );
          write = true;
        } catch {
          write = false;
        }
        await tx.rollback();
      });
      return { read, write };
    },

    close: () => db.close(),
  };
  return api;
}
