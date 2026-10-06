## Context

See proposal.md for the motivation. Current state that shapes the approach:

- **Seed and schema are one migration.** `scripts/_lib.ts` `readMigrations()` concatenates `schema.sql` and the seed, and `runDeploy` sends them as one migration whose id is `kychon_<sha256[:16]>` of the combined SQL. Any schema edit, even a comment, changes the id, so the seed re-runs against a live database.
  - Typed seeds (`scripts/generate-seed-sql.ts`) insert rows that are missing (`WHERE NOT EXISTS`), with some `DO UPDATE` and `UPDATE` statements. That brings back blocks an admin deleted and overwrites some settings.
  - Port seeds (copy-website, `_<slug>-port.seed.sql`) start with `TRUNCATE` across the content tables.
- **Admin writes go through the capability API.** `src/lib/api.ts` calls the `kychon-api` edge function, which records a `capability_executions` row (actor, operation, `correlation_id`) and writes through `adminDb()` with the service role. The database never sees the admin's identity, and each write is its own transaction.
- **Agents (Kychon Studio and Pro) edit through SQL**: service-key SQL routes or `adminDb().sql()`. The Run402 gateway wraps each service-key SQL call in `BEGIN … COMMIT`, so one call is one transaction.
- **The Run402 tenant SQL screen** (run402-private `tenant-sql-boundary.ts`) refuses `set_config`, statement-level `SET`, dynamic `EXECUTE`, and single-quoted function bodies. It allows dollar-quoted bodies and `SET search_path FROM CURRENT` (run402-private#784). The usual GUC-based audit attribution is therefore unavailable.
- **Uploaded assets are content-addressed.** The manifest carries `contentSha256` and an immutable `<name>-<sha8>.<ext>` URL, alongside a mutable `_blob/astro/<name>` alias.
- **Run402 project snapshots exist.** Deploys report a `restore_point.snapshot_id` with a restore URL. Kychon pins `@run402/sdk` 4.0.2; a separate change upgrades it to the latest, which is expected to expose snapshots.

## Goals / Non-Goals

**Goals:**
- No deploy can change an installed portal's content.
- Every content write is captured, whatever the write path, with no cooperation needed from the writer.
- Attribution is best-effort and layered: precise for capability calls and labelled agent runs, and an honest `unattributed` for anything else.
- Reverting is safe by default (conflicts refuse) and history stays append-only.

**Non-Goals:**
- Drafts, branches, or a staged-publish workflow. Revisions record published state only.
- Real-time collaborative editing or merging.
- History of member PII (`members`) and member-generated activity (forum topics and replies, RSVPs, votes, reactions, `activity_log`).
- Syncing site content to git or KyGit. Git and KyGit remain for engine code.
- Per-field diffs in storage. Revisions store whole-row before/after JSON; diffs are computed for display.

## Decisions

### D1. Install marker plus a guarded import inside the existing migration
`schema.sql` creates `kychon_install(id boolean PK DEFAULT true CHECK (id), installed_at, import_source, import_checksum, engine_version)`. The seed generator, and the port-seed path in `runDeploy`, wrap the import SQL in one dollar-quoted block:

```sql
DO $kychon_import$ BEGIN
  IF EXISTS (SELECT 1 FROM kychon_install) THEN RETURN; END IF;
  <seed DML>
  INSERT INTO kychon_install (import_source, import_checksum, engine_version) VALUES (...);
END $kychon_import$;
```

**Existing projects are adopted.** `schema.sql` inserts the marker (`import_source = 'adopted'`) when `pages` or `sections` already have rows, and that runs before the guarded block. It keys on those tables rather than `site_config` because `schema.sql` itself writes `site_config` defaults on a fresh project. Live portals are therefore never re-imported on the first deploy after this change.

Alternatives:
- A separate migration with a fixed id: the SDK hard-errors when the same id arrives with a different checksum.
- A separate deploy step outside migrations: needs a new deploy-time SQL channel, and splits atomicity with the schema.

The guard keeps one atomic, content-tracked migration and needs no platform change. The tagged dollar quote (`$kychon_import$`) avoids clashing with `$$` inside seed bodies.

**Re-import** is explicit: a deploy option (`reimport: true` / `--reimport`) emits `DELETE FROM kychon_install;` before the guard. It is refused unless the caller confirms the project subdomain. A fresh restore point (D6) is taken first.

### D2. Generic row trigger keyed by transaction id; changesets created automatically
One trigger function, `kychon_record_revision()` (plpgsql, `SECURITY DEFINER`, `SET search_path FROM CURRENT`, no dynamic SQL), is attached `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW` to every content table. The primary-key column is passed as `TG_ARGV[0]` (`id`, or `key` for `site_config`). It:
1. Upserts `changesets(txid bigint UNIQUE DEFAULT txid_current(), actor_type, actor_id, label, capability_execution_id, created_at)` with `ON CONFLICT (txid) DO NOTHING`. `actor_type` defaults to `jwt` when `current_setting('request.jwt.claims', true)` carries a `sub` (reading a setting is allowed), and to `unattributed` otherwise.
2. Inserts `revisions(id, changeset_id, table_name, row_key jsonb, op, before jsonb, after jsonb, created_at)` using `to_jsonb(OLD)` and `to_jsonb(NEW)`. An UPDATE whose before equals its after records nothing.

Alternatives:
- Application-level logging in `kychon-api`: misses agent SQL, which is exactly the path that most needs auditing.
- GUC or `set_config` attribution: refused by the tenant screen.
- One trigger per table with a static column list: rejected because generic `to_jsonb` covers schema evolution for free.

### D3. Writers claim their changeset after the write
- **`kychon-api`** moves its content-write helpers (`insertRow` / `updateRow` / `deleteRow`) for history-tracked tables from `adminDb().from()` to parameterized `adminDb().sql()` with `RETURNING txid_current()`. It then calls `kychon_claim_changeset(txid, execution_id, actor_type, actor_id, label)` to fill in the metadata. A capability that writes several times produces several changesets sharing a `capability_execution_id`; the UI groups them as one change.
- **Agents** label their own transaction by ending their SQL call with `SELECT kychon_label_changeset('agent', '<agent id>', '<label>');`, which updates the changeset row for `txid_current()`. The Pro and Studio agent instructions (agent docs) make this mandatory.
- **Unlabelled SQL** still produces a complete, revertible changeset marked `unattributed`.

Alternative rejected: a CTE that binds the changeset before the DML runs. Data-modifying CTEs have no guaranteed execution order relative to triggers.

### D4. Revert in the edge function, never in dynamic SQL
`kychon-api` exposes `history.revert({ changeset_id, force })`. For each revision of the changeset, in reverse order, it checks that the row's current state equals that revision's `after` (or that the row is absent, for a delete). If any differ, it returns `conflict` with the affected rows and changes nothing, unless `force` is set. Otherwise it applies the inverse (re-insert the `before` row, delete it, or update it back) with per-table parameterized statements built from a static allowlist of tracked tables and their columns. The revert runs in one transaction, which itself becomes a new changeset with label `Revert #<id>` and `reverts_changeset_id`.

Rationale: generic SQL-side revert needs dynamic `EXECUTE`, which the tenant screen refuses. The allowlist also stops a revert from ever writing to an untracked table.

### D5. Assets: reference by hash, retain if referenced
- `upload-asset` stores the **immutable** URL in content.
- `/assets/<basename>` stays the import-time convention (kychon#159). The import step records the SHA-256 each basename resolved to in `kychon_install.import_assets`, so later lookups can detect when a basename has been re-pointed.
- Any future asset garbage collection must treat every URL found in `revisions.before` / `after` as live. Run402 assets are content-addressed and deduplicated, so retention costs storage only for genuinely distinct files.

### D6. Restore points are Run402 project snapshots with a Kychon ledger
`restore_points(id, snapshot_id, label, reason, created_by, created_at)` records each snapshot Kychon takes: manual, `before_engine_upgrade`, `before_agent_run`, `before_reimport`, `before_restore`.
- **Restore** is owner-only, requires typing the site name, and first takes a `before_restore` snapshot, so a restore can itself be undone.
- After restoring it writes a changeset `Restored to "<label>"`. Revisions newer than the snapshot disappear with the database; the ledger row and the `before_restore` snapshot keep them recoverable.
- The `kychon-fleet-upgrade` skill takes `before_engine_upgrade` before upgrading each portal.

### D7. Export bundle format `kychon-bundle/v1`
Export produces a single JSON document: `{ format, engine_version, exported_at, source: {project_id, subdomain}, tables: { <name>: rows[] }, assets: [{url, sha256, content_type, size_bytes}] }`. It covers the history-tracked tables; `members` is included only with an explicit `include_members` flag. Revisions are excluded.

Import is the D1 initial import fed from a bundle instead of seed SQL:
- assets are fetched and re-uploaded (content-addressing deduplicates them), and URLs are rewritten to the target project's immutable URLs;
- import is refused if the target is installed, unless re-import (D1) is requested.

copy-website moves to emitting bundles after the first phases ship.

### D8. Retention
A daily scheduled function (`prune-history`) deletes revisions older than `history_retention_days` (site_config, default 365). It always keeps the newest revision per `(table_name, row_key)`, so the current state of every row stays explainable. Changesets with no revisions left are deleted. Deleting a member does not touch content history, because member tables are not tracked.

## Risks / Trade-offs

- [Write amplification: every content write adds revision and changeset rows, and large JSON configs (custom HTML, slideshows with 100+ items) duplicate on each save.] → Revisions are append-only and pruned (D8). No-op UPDATEs are skipped. Tracked tables are low-write admin content.
- [The adoption heuristic (`pages` or `sections` have rows) could mark a half-provisioned project as installed.] → Re-import (D1) recovers it explicitly. A fresh project has no `pages` or `sections` rows until its import runs.
- [Port seeds that rely on non-DML statements inside the guard fail at deploy.] → The generator and port path validate the import SQL (DML only) before deploying and fail with a clear message.
- [Unattributed changesets erode the AI-audit story.] → Agent docs make labelling mandatory. The history UI shows `Unattributed SQL` prominently, and a check in agent tooling flags unlabelled runs.
- [A forced revert overwrites later edits.] → It is opt-in per call, shows the conflicting rows first, and is itself revertible.
- [Restore drops edits made after the snapshot.] → A mandatory `before_restore` snapshot and an explicit confirmation.
- [The demo hourly reset rewrites demo content constantly.] → Demo reset clears `changesets` and `revisions` (demo-reset delta). Demos converge to seed edits through the hourly reset rather than through deploys.

## Migration Plan

1. **Phase 1, initial import.** Ship D1 (marker, adoption, guarded seed, `--reimport`). Deploy demos, then each port. The adoption row prevents any re-import. Verify on one port that a schema-changing deploy leaves the content row counts unchanged.
2. **Phase 2, history core.** Ship the D2 tables and triggers, the D3 claim path in `kychon-api`, D4 revert, and D8 pruning. Triggers start recording from the deploy that installs them; nothing is backfilled.
3. **Phase 3, UI.** An undo toast after admin saves, a history panel per block and page, and a site History page with revert.
4. **Phase 4, restore points.** After the run402 SDK upgrade lands: the D6 ledger, a manual restore point, and fleet-upgrade integration.
5. **Phase 5, export and import.** The D7 bundle; copy-website switches to emitting bundles.

**Rollback:** each phase is additive. Dropping the triggers disables history without data loss. If the D1 guard is removed, seeds behave as before, so it must not be removed once ports rely on it.

## Open Questions

- Default `history_retention_days` per tier, and whether long retention is a Pro feature.
- Whether Run402 snapshot quotas or pricing limit automatic `before_agent_run` snapshots. If they do, take them per agent session rather than per run.
- Exact placement of the history panel within the admin bar and section toolbar (a UI detail settled during Phase 3).
