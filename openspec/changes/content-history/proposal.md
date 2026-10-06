## Why

A Kychon portal's content and settings are rows in its Postgres database, and every edit overwrites them in place. There is no history, no undo, and no record of what an AI agent changed. Worse, every engine schema change re-runs the project's seed: port seeds `TRUNCATE` all content tables and re-insert the original import, and typed seeds bring back sections an admin deleted. One engine upgrade can silently wipe a club's edits. The copy-website fleet (~18 ported sites) and Kychon Pro (an AI agent editing live portals over SQL) both need edits to be durable, attributable, reviewable, and reversible. Club admins and AI agents won't use git, so that history has to live inside the product.

## What Changes

- **Initial import runs once.** The seed is the portal's initial import, applied exactly once per project and recorded in an install marker. Later deploys, including ones that change the schema, never re-apply it. Re-importing is an explicit, destructive operator action. Demo resets stay intentional wipes. **BREAKING** for any workflow that relied on a redeploy to re-push seed edits into a live project.
- **Every content change becomes a revision.** Database triggers on the content tables append an immutable revision (table, row, operation, before/after JSON, actor, time, changeset) for every write path: the inline editor, edge functions, and agent SQL.
- **Changesets group revisions.** An admin save, or one agent run, is one changeset with an actor and a label. Admins can view history per page or block and site-wide, and can revert a changeset. A revert is a new changeset, so history stays append-only. Conflicts with later edits are detected and surfaced, never silently overwritten.
- **Assets stay reachable.** Uploaded assets are already content-addressed; any asset a revision references is treated as live and never garbage-collected, so restoring old content restores its images.
- **Named restore points.** Before an engine upgrade, a Kychon Pro agent run, or a bulk import, the system takes a whole-site restore point (a Run402 project snapshot), and admins can create one by hand. Restoring is owner-only, confirmed, and itself recorded.
- **Export and import bundle.** A versioned JSON bundle of a portal's content rows and asset references (URL plus SHA-256) supports backups, a club leaving, and cloning. copy-website output becomes the bundle that the initial import consumes.

## Capabilities

### New Capabilities
- `initial-import`: The seed or import bundle is applied exactly once per project, with an install marker, an explicit re-import path, and no reapplication on deploy.
- `content-history`: A trigger-based revision log over content tables, with changesets and actor attribution for every write path, plus history views, revert with conflict detection, retention, and privacy erasure.
- `restore-points`: Named whole-site restore points backed by Run402 project snapshots, taken automatically around risky operations and on demand, with an audited restore.
- `content-export`: A versioned export/import bundle of content rows and content-addressed asset references.

### Modified Capabilities
- `deploy`: A deploy applies schema migrations but never re-applies the initial import to an installed project.
- `demo-reset`: A demo reset is an explicit re-import that also clears the demo's content history.

## Impact

- **Schema** (`schema.sql`): new tables `kychon_install`, `changesets`, and `revisions`; trigger functions on the content tables (`site_config`, `pages`, `sections`, `section_translations`, `content_translations`, `events`, `event_registration_options`, `announcements`, `resources`, `committees`, `membership_tiers`, `member_custom_fields`, `polls`, `poll_options`, `forum_categories`). Member PII and member-generated activity tables are excluded.
- **Deploy pipeline** (`scripts/_lib.ts` `readMigrations` / `runDeploy`, `scripts/generate-seed-sql.ts`): the seed is wrapped in an install guard, and the migration still uses content-tracked ids.
- **Ports**: copy-website seeds (`TRUNCATE`-style) and the reference ports (kept in the private kychon-concierge repo, `ports/<slug>/`) become safe to redeploy. copy-website later emits an import bundle.
- **Admin UI** (`AdminEditor`, `AdminEditorControlsIsland`, admin pages): undo after save, a history panel, and a site-wide history page with revert. Built with shadcn components.
- **Edge functions** (`kychon-api`, `upload-asset`, Pro agent entry points): changeset attribution, and immutable asset URLs on upload.
- **Run402 dependency**: project snapshot create/list/restore through the SDK. This lands after the run402 SDK upgrade in progress in a separate thread.
- **Fleet upgrade skill** (`kychon-fleet-upgrade`): takes a restore point before upgrading each portal.
