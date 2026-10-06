/**
 * The rows a seed imports, for a check-mode build that renders seeded content
 * before any paid deploy (kychon#224). Applies `schema.sql` + the seed's
 * initial import to an in-process Postgres (PGlite) — the same SQL the deploy
 * migration runs — and reads back the tables the build-time loaders bake
 * from. See `src/lib/build-seed-rows.ts` for how the build consumes them.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SEED_ROWS_TABLES, type BuildSeedRows, type SeedRow } from "../src/lib/build-seed-rows.ts";
import { wrapInitialImport } from "./initial-import.ts";

export async function seedRenderRows(root: string, seedSql: string, source = "seed.sql"): Promise<BuildSeedRows> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec(readFileSync(join(root, "schema.sql"), "utf-8"));
    await db.exec(wrapInitialImport(seedSql, { source }));
    const tables: BuildSeedRows["tables"] = {};
    for (const table of SEED_ROWS_TABLES) {
      // Round-trip through JSON so timestamps arrive as ISO strings, the way
      // the gateway returns them.
      const { rows } = await db.query<{ row: SeedRow }>(`SELECT to_jsonb(t) AS row FROM ${table} t`);
      tables[table] = rows.map((r) => r.row);
    }
    return { version: 1, tables };
  } finally {
    await db.close();
  }
}
