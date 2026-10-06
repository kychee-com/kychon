/**
 * `kychon-bundle/v1`: a portal's content as one JSON document (exported by the
 * `bundle.export` capability), imported into another project as its initial
 * import. Import order: verify every asset against its SHA-256, upload the
 * assets to the target, rewrite asset URLs, then apply the rows as seed SQL
 * through the once-only initial-import wrapper (scripts/initial-import.ts).
 */

import { createHash } from "node:crypto";
import { z } from "astro/zod";

export const BUNDLE_FORMAT = "kychon-bundle/v1";

const row = z.record(z.string(), z.unknown());

export const BundleAssetSchema = z.object({
  /** The URL exactly as content references it. */
  url: z.string().min(1),
  key: z.string().min(1),
  /** SHA-256 of the source blob (for a variant URL, of the original it was derived from). */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  content_type: z.string().min(1),
  size_bytes: z.number().int().nonnegative(),
  /** Image variant kind (`large`, `thumb`, ...) when `url` is a derived variant. */
  variant: z.string().nullable(),
  /** Where the source bytes can be fetched. */
  source_url: z.string().url(),
});

export const KychonBundleSchema = z.object({
  format: z.literal(BUNDLE_FORMAT),
  engine_version: z.string(),
  exported_at: z.string(),
  source: z.object({ project_id: z.string().nullable(), site_url: z.string().nullable() }),
  include_members: z.boolean(),
  tables: z.record(z.string(), z.array(row)),
  assets: z.array(BundleAssetSchema),
  unresolved_asset_urls: z.array(z.string()).default([]),
});

export type BundleAsset = z.infer<typeof BundleAssetSchema>;
export type KychonBundle = z.infer<typeof KychonBundleSchema>;

/** Insert order: parents before the rows that reference them. */
export const BUNDLE_TABLE_ORDER = [
  "site_config",
  "pages",
  "sections",
  "section_translations",
  "content_translations",
  "membership_tiers",
  "member_custom_fields",
  "members",
  "events",
  "event_registration_options",
  "announcements",
  "resources",
  "committees",
  "polls",
  "poll_options",
  "forum_categories",
] as const;

export class BundleImportError extends Error {
  constructor(
    message: string,
    readonly assets: string[] = [],
  ) {
    super(message);
    this.name = "BundleImportError";
  }
}

export function parseBundle(raw: unknown): KychonBundle {
  const parsed = KychonBundleSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BundleImportError(`Not a ${BUNDLE_FORMAT} bundle: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  }
  const unknownTables = Object.keys(parsed.data.tables).filter(
    (table) => !(BUNDLE_TABLE_ORDER as readonly string[]).includes(table),
  );
  if (unknownTables.length) throw new BundleImportError(`Bundle has unknown tables: ${unknownTables.join(", ")}`);
  return parsed.data;
}

export interface VerifiedAsset {
  key: string;
  sha256: string;
  contentType: string;
  bytes: Uint8Array;
}

/**
 * Fetch every distinct source asset and check its SHA-256. Throws listing every
 * mismatched or unreachable asset; nothing is written to the target first.
 */
export async function fetchVerifiedAssets(
  bundle: KychonBundle,
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, VerifiedAsset>> {
  const bySha = new Map<string, BundleAsset>();
  const urlsBySha = new Map<string, string[]>();
  for (const asset of bundle.assets) {
    if (!bySha.has(asset.sha256)) bySha.set(asset.sha256, asset);
    urlsBySha.set(asset.sha256, [...(urlsBySha.get(asset.sha256) ?? []), asset.url]);
  }
  // Name the source and every content URL that depends on it.
  const describe = (asset: BundleAsset) =>
    [...new Set([asset.source_url, ...(urlsBySha.get(asset.sha256) ?? [])])].join(", ");

  const verified = new Map<string, VerifiedAsset>();
  const failed: string[] = [];
  for (const asset of bySha.values()) {
    let bytes: Uint8Array;
    try {
      const res = await fetchImpl(asset.source_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch (error) {
      failed.push(`${describe(asset)}: ${(error as Error).message}`);
      continue;
    }
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== asset.sha256) {
      failed.push(`${describe(asset)}: SHA-256 ${sha} does not match ${asset.sha256}`);
      continue;
    }
    verified.set(asset.sha256, { key: asset.key, sha256: asset.sha256, contentType: asset.content_type, bytes });
  }
  if (failed.length) {
    throw new BundleImportError(`${failed.length} bundle asset(s) failed verification:\n  ${failed.join("\n  ")}`, failed);
  }
  return verified;
}

/** What the target returns for an uploaded asset (the SDK's AssetRef, loosely). */
export interface UploadedAssetRef {
  key?: string;
  url?: string | null;
  cdn_url?: string | null;
  immutable_url?: string | null;
  cdn_immutable_url?: string | null;
  variants?: Record<string, { url?: string | null; immutable_url?: string | null; cdn_immutable_url?: string | null }> | null;
}

export type PutAsset = (asset: VerifiedAsset) => Promise<UploadedAssetRef>;

export interface UploadedAssets {
  /** Old URL → new URL for every absolute asset URL the content references. */
  urlMap: Map<string, string>;
  /** `/assets/<name>` name → target ref, staged as the target's asset manifest. */
  manifestAssets: Record<string, UploadedAssetRef>;
}

/**
 * Upload each verified asset to the target once, and map every referenced URL
 * to the target's. `/assets/<name>` references keep their path and resolve
 * through the target's asset manifest.
 */
export async function uploadBundleAssets(
  bundle: KychonBundle,
  verified: Map<string, VerifiedAsset>,
  put: PutAsset,
): Promise<UploadedAssets> {
  const refs = new Map<string, UploadedAssetRef>();
  for (const asset of verified.values()) refs.set(asset.sha256, await put(asset));

  const urlMap = new Map<string, string>();
  const manifestAssets: Record<string, UploadedAssetRef> = {};
  const missing: string[] = [];
  for (const asset of bundle.assets) {
    const ref = refs.get(asset.sha256);
    if (!ref) continue;
    if (asset.url.startsWith("/assets/")) {
      manifestAssets[asset.url.slice("/assets/".length)] = ref;
      continue;
    }
    const target = asset.variant ? ref.variants?.[asset.variant] : ref;
    const next = target?.cdn_immutable_url || target?.immutable_url || target?.url;
    if (next) urlMap.set(asset.url, next);
    else missing.push(asset.url);
  }
  if (missing.length) {
    throw new BundleImportError(`The target returned no URL for ${missing.length} asset(s): ${missing.join(", ")}`, missing);
  }
  return { urlMap, manifestAssets };
}

/** Replace every mapped URL in every string value (longest URLs first). */
export function rewriteBundleUrls(
  tables: KychonBundle["tables"],
  urlMap: Map<string, string>,
): KychonBundle["tables"] {
  const pairs = [...urlMap.entries()].sort((a, b) => b[0].length - a[0].length);
  if (pairs.length === 0) return tables;
  const rewrite = (value: unknown): unknown => {
    if (typeof value === "string") {
      let out = value;
      for (const [from, to] of pairs) if (out.includes(from)) out = out.split(from).join(to);
      return out;
    }
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]));
    }
    return value;
  };
  return rewrite(tables) as KychonBundle["tables"];
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Seed SQL for the bundle's rows: data statements only, so it runs inside the
 * initial-import guard. Rows upsert on their key (a fresh project only has
 * engine-default config rows), then each id sequence moves past the imported ids.
 */
export function bundleToSeedSql(tables: KychonBundle["tables"]): string {
  const lines = ["-- kychon-bundle/v1 import"];
  for (const table of BUNDLE_TABLE_ORDER) {
    const rows = tables[table];
    if (!rows?.length) continue;
    const key = table === "site_config" ? "key" : "id";
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))].sort();
    if (!columns.includes(key)) throw new BundleImportError(`Bundle table ${table} rows have no ${key} column.`);
    for (const column of columns) {
      if (!/^[a-z_][a-z0-9_]*$/.test(column)) throw new BundleImportError(`Invalid column name in ${table}: ${column}`);
    }
    const list = columns.join(", ");
    const updates = columns.filter((c) => c !== key).map((c) => `${c} = EXCLUDED.${c}`);
    lines.push(
      `INSERT INTO ${table} (${list}) SELECT ${list} FROM jsonb_populate_recordset(NULL::${table}, ${sqlString(JSON.stringify(rows))}::jsonb) ON CONFLICT (${key}) DO ${updates.length ? `UPDATE SET ${updates.join(", ")}` : "NOTHING"};`,
    );
    if (key === "id") {
      lines.push(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST((SELECT max(id) FROM ${table}), 1));`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

/** A version-1 asset manifest for the target, so `/assets/<name>` resolves there. */
export function targetAssetManifest(projectId: string, assets: Record<string, UploadedAssetRef>): string {
  return `${JSON.stringify({ version: 1, project_id: projectId, assets }, null, 2)}\n`;
}
