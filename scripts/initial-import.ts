// Initial import: a project's seed runs exactly once (openspec content-history,
// capability `initial-import`).
//
// The seed ships inside the same content-tracked migration as `schema.sql`, so
// any schema edit re-runs it. `wrapInitialImport` puts the seed inside a
// plpgsql block that does nothing once `kychon_install` has a row, and writes
// that row in the same transaction as the import. `schema.sql` creates
// `kychon_install` and marks already-live projects as `adopted`.
//
// Inside plpgsql only data statements are valid, and a bare SELECT must be
// PERFORM, so the seed is split into top-level statements, validated, and
// rewritten before wrapping. Wrapping happens at deploy time (readMigrations),
// never in seed.sql itself: the demo reset function embeds the raw seed.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export const IMPORT_TAG = "$kychon_import$";

export class InitialImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitialImportError";
  }
}

/**
 * Split SQL into top-level statements on `;`, honouring single-quoted strings
 * (incl. `''` and E'' backslash escapes), double-quoted identifiers, `--` and
 * nested block comments, and dollar-quoted bodies. Statements are returned
 * trimmed, without the terminating `;`; empty and comment-only ones are dropped.
 */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let start = 0;
  let i = 0;
  const n = sql.length;
  const push = (end: number) => {
    const stmt = sql.slice(start, end).trim();
    if (stripLeadingComments(stmt) !== "") out.push(stmt);
  };
  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];
    if (c === "-" && next === "-") {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? n : nl + 1;
    } else if (c === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth--;
          i += 2;
        } else i++;
      }
    } else if (c === "'") {
      const backslashEscapes = i > 0 && /[eE]/.test(sql[i - 1] ?? "") && !/[A-Za-z0-9_]/.test(sql[i - 2] ?? "");
      i++;
      while (i < n) {
        if (backslashEscapes && sql[i] === "\\") i += 2;
        else if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") break;
        else i++;
      }
      i++;
    } else if (c === '"') {
      i++;
      while (i < n) {
        if (sql[i] === '"' && sql[i + 1] === '"') i += 2;
        else if (sql[i] === '"') break;
        else i++;
      }
      i++;
    } else if (c === "$" && !/[A-Za-z0-9_]/.test(sql[i - 1] ?? "")) {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const close = sql.indexOf(tag, i + tag.length);
        if (close === -1) throw new InitialImportError(`Unterminated dollar-quoted string ${tag} in seed SQL.`);
        i = close + tag.length;
      } else i++;
    } else if (c === ";") {
      push(i);
      i++;
      start = i;
    } else i++;
  }
  push(n);
  return out;
}

function stripLeadingComments(stmt: string): string {
  let s = stmt;
  for (;;) {
    const t = s.replace(/^\s+/, "");
    if (t.startsWith("--")) {
      const nl = t.indexOf("\n");
      s = nl === -1 ? "" : t.slice(nl + 1);
    } else if (t.startsWith("/*")) {
      const end = t.indexOf("*/");
      s = end === -1 ? "" : t.slice(end + 2);
    } else return t;
  }
}

const DML = new Set(["INSERT", "UPDATE", "DELETE", "TRUNCATE"]);

function excerpt(stmt: string): string {
  const one = stripLeadingComments(stmt).replace(/\s+/g, " ");
  return one.length > 120 ? `${one.slice(0, 117)}...` : one;
}

/**
 * Validate seed statements and rewrite them for a plpgsql body: data
 * statements pass through, a top-level SELECT becomes PERFORM, a WITH must
 * end in a data statement. Anything else (DDL, transaction control, DO, SET,
 * COPY, ...) is rejected — schema belongs in schema.sql.
 */
export function prepareImportStatements(seedSql: string): string[] {
  if (seedSql.includes(IMPORT_TAG)) {
    throw new InitialImportError(`Seed SQL must not contain the reserved tag ${IMPORT_TAG}.`);
  }
  return splitSqlStatements(seedSql).map((stmt, index) => {
    const body = stripLeadingComments(stmt);
    const keyword = (/^[A-Za-z]+/.exec(body)?.[0] ?? "").toUpperCase();
    if (DML.has(keyword)) return body;
    if (keyword === "SELECT") return `PERFORM${body.slice("SELECT".length)}`;
    if (keyword === "WITH" && /\b(INSERT|UPDATE|DELETE)\b/i.test(body)) return body;
    throw new InitialImportError(
      `Seed statement ${index + 1} is not a data statement (${keyword || "unknown"}); ` +
        `only INSERT/UPDATE/DELETE/TRUNCATE/SELECT are allowed in an initial import. ` +
        `Move schema changes to schema.sql. Statement: ${excerpt(stmt)}`,
    );
  });
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export interface WrapInitialImportOptions {
  /** Where the import came from, e.g. `seed.sql` or `_sdjc-port.seed.sql`. */
  source: string;
  /**
   * Re-apply the import to an installed project: clears the install record
   * first. Destructive — callers must have confirmed the target subdomain.
   */
  reimport?: boolean;
}

/** Wrap seed SQL so it runs once per project. Returns "" for an empty seed. */
export function wrapInitialImport(seedSql: string, opts: WrapInitialImportOptions): string {
  const statements = prepareImportStatements(seedSql);
  if (statements.length === 0) return "";
  const checksum = createHash("sha256").update(seedSql).digest("hex");
  const lines = [
    `-- Initial import (${opts.source}, sha256 ${checksum.slice(0, 16)}): applied once per project.`,
  ];
  if (opts.reimport) lines.push("DELETE FROM kychon_install;");
  lines.push(
    `DO ${IMPORT_TAG}`,
    "BEGIN",
    "  IF EXISTS (SELECT 1 FROM kychon_install) THEN",
    "    RETURN;",
    "  END IF;",
    ...statements.map((s) => `${s};`),
    `  INSERT INTO kychon_install (import_source, import_checksum) VALUES (${sqlLiteral(opts.source)}, ${sqlLiteral(checksum)});`,
    "END",
    `${IMPORT_TAG};`,
  );
  return lines.join("\n");
}

/**
 * Resolve the seed file a deploy should import. Relative paths are taken from
 * the repo root and absolute ones as given (ports keep seeds outside the
 * engine checkout). An explicitly named seed that does not exist is an error:
 * silently importing nothing would report a successful deploy with no content.
 * Only the default `seed.sql` may be absent (projects without a typed seed).
 */
export function resolveSeedPath(root: string, seedFile?: string): string | null {
  if (seedFile === undefined) {
    const fallback = join(root, "seed.sql");
    return existsSync(fallback) ? fallback : null;
  }
  const path = isAbsolute(seedFile) ? seedFile : join(root, seedFile);
  if (!existsSync(path)) {
    throw new InitialImportError(`Seed file not found: ${path} (from seedFile "${seedFile}").`);
  }
  return path;
}

/** Refuse a re-import unless the caller named the exact target subdomain. */
export function assertReimportConfirmed(subdomain: string, confirmSubdomain: string | undefined): void {
  if (!confirmSubdomain || confirmSubdomain.trim() !== subdomain) {
    throw new InitialImportError(
      `Re-import replaces the live content of "${subdomain}". ` +
        `Confirm by passing the subdomain (reimport: { confirmSubdomain: "${subdomain}" } / --reimport=${subdomain}).`,
    );
  }
}

// ─── Post-import rebuild (#191 / #153) ───────────────────────────────────────
//
// runDeploy builds Astro BEFORE apply runs schema + seed, and the build reads
// the live DB. When THIS deploy imports the seed (initial import or confirmed
// reimport) the first bake reflects pre-import state, so the deploy rebuilds
// and publishes again once the import has landed. Ordinary redeploys (marker
// unchanged) keep the single build: live content is the source of truth.

/** The `kychon_install` row, as read by `readInstallMarker`. */
export interface InstallMarker {
  installed_at: string;
  import_source: string;
}

type SqlFn = (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>;

/**
 * Read the install marker. `null` = no marker (table absent on a fresh
 * project, or empty: initial import pending); `undefined` = unknown (probe
 * failed, e.g. credentials without SQL access). Never throws.
 */
export async function readInstallMarker(sql: SqlFn): Promise<InstallMarker | null | undefined> {
  try {
    const presence = await sql("SELECT to_regclass('kychon_install') IS NOT NULL AS present");
    if (presence.rows[0]?.present !== true) return null;
    const result = await sql("SELECT installed_at::text AS installed_at, import_source FROM kychon_install LIMIT 1");
    const row = result.rows[0];
    if (!row) return null;
    return { installed_at: String(row.installed_at), import_source: String(row.import_source) };
  } catch {
    return undefined;
  }
}

/**
 * Will this deploy's release import the seed? True on a confirmed reimport or
 * when the marker is known to be absent. Unknown marker → false (keep the
 * ordinary live-override behavior).
 */
export function seedImportExpected(before: InstallMarker | null | undefined, reimport: boolean): boolean {
  return reimport || before === null;
}

/**
 * Did the release just applied import the seed? Compares the marker before and
 * after apply: a new non-`adopted` marker (or a re-written one) means yes.
 * When a probe is unknown, falls back to the deploy's intent.
 */
export function seedAppliedInDeploy(opts: {
  before: InstallMarker | null | undefined;
  after: InstallMarker | null | undefined;
  reimport: boolean;
}): boolean {
  const { before, after, reimport } = opts;
  if (after === undefined) return seedImportExpected(before, reimport);
  if (before === undefined) return reimport;
  if (after === null || after.import_source === "adopted") return false;
  return before === null || before.installed_at !== after.installed_at;
}

export type ReleasePhase = "initial" | "post-import";

/**
 * Two-phase apply: probe → build → apply → probe, then rebuild + re-apply only
 * when this deploy imported the seed. `build` receives `seedWins` so the first
 * bake prefers the seed over pre-import live config; the post-import bake reads
 * live state again (which now IS the imported seed).
 */
export async function applyWithPostImportRebuild<Release, Result>(steps: {
  reimport: boolean;
  probe: () => Promise<InstallMarker | null | undefined>;
  build: (phase: ReleasePhase, ctx: { seedWins: boolean }) => Promise<Release>;
  apply: (release: Release, phase: ReleasePhase) => Promise<Result>;
}): Promise<{ result: Result; rebuilt: boolean }> {
  const before = await steps.probe();
  const first = await steps.build("initial", { seedWins: seedImportExpected(before, steps.reimport) });
  const result = await steps.apply(first, "initial");
  const after = await steps.probe();
  if (!seedAppliedInDeploy({ before, after, reimport: steps.reimport })) return { result, rebuilt: false };
  const second = await steps.build("post-import", { seedWins: false });
  return { result: await steps.apply(second, "post-import"), rebuilt: true };
}
