## 1. Initial import runs once (Phase 1)

- [x] 1.1 Add `kychon_install` to `schema.sql`, plus the adoption insert placed before any import SQL and before the first `site_config` write. Adoption is keyed on `pages`/`sections` rows, because `schema.sql` itself writes `site_config` defaults on a fresh project
- [x] 1.2 Wrap the seed in the `$kychon_import$` install guard at deploy time in `readMigrations` (`scripts/initial-import.ts`), covering typed seeds and port seed files alike. `seed.sql` itself stays raw because the demo reset function embeds it
- [x] 1.3 (Folded into 1.2: `runDeploy`, `patchDeploy`, and the Core manifest builder all go through `readMigrations`)
- [x] 1.4 Validate before any platform call that the import SQL contains only data statements (top-level `SELECT` becomes `PERFORM`), naming the offending statement
- [x] 1.5 Add `reimport: { confirmSubdomain }` to `runDeploy` and `--reimport=<subdomain>` to `scripts/deploy.ts`; refuse when unconfirmed (the restore point before a re-import arrives with task 7.3)
- [x] 1.6 Tests (`tests/unit/initial-import.test.ts`): statement splitting, validation, the guard, `readMigrations`, schema ordering, re-import confirmation, and every committed port seed plus a generated demo seed
- [x] 1.7 Demo reset: no change needed. The reset embeds the raw `seed.sql` and never touches `kychon_install`
- [x] 1.8 Verify on Postgres 17 (throwaway container) for the eagles, aage, bmwclubcanberra, odbc, and sdjc seeds: fresh install, admin edits and deletions survive a schema-only redeploy, a confirmed re-import restores the seed, and an old-engine portal is adopted with its edits intact
- [ ] 1.9 Verify live on Run402: first deploy of each demo and port after this change records `adopted` and leaves the content row counts unchanged

## 2. Revision log (Phase 2)

- [x] 2.1 Add `changesets` and `revisions` tables with indexes (`txid` unique; `revisions(table_name, row_key)`; `created_at`) to `schema.sql`
- [x] 2.2 Implement the `kychon_record_revision()` trigger function (dollar-quoted, `SECURITY DEFINER`, `SET search_path FROM CURRENT`, no dynamic SQL), skipping updates that change nothing
- [x] 2.3 Attach the trigger to every history-tracked table with its primary-key argument (`key` for `site_config`)
- [x] 2.4 Add `kychon_claim_changeset(...)` and `kychon_label_changeset(...)` functions
- [x] 2.5 Make sure the import guard records the initial import as one `system` changeset labelled `Initial import`
- [x] 2.6 Tests (integration DB): every operation on every tracked table records before/after; untracked tables record nothing; a single transaction yields a single changeset

## 3. Attribution in the capability API (Phase 2)

- [x] 3.1 Move `kychon-api` content-write helpers for tracked tables to parameterized `adminDb().sql()` with `RETURNING txid_current()`
- [x] 3.2 Claim each write's changeset with the authenticated actor, the capability execution id, and the operation label
- [x] 3.3 Add `history.list`, `history.revisions` (per page/block), and `history.revision` (before/after) capability queries, admin-only
- [x] 3.4 Document mandatory `kychon_label_changeset` usage for agents in the agent docs (`CUSTOMIZING.md`, the AI agents' customization guide)
- [x] 3.5 Tests: admin save attributed to the admin; labelled agent SQL attributed; unlabelled SQL recorded as `unattributed`; non-admin refused

## 4. Revert (Phase 2)

- [x] 4.1 Build a static allowlist of tracked tables with their key and column lists, shared by revert and export (implemented as `HISTORY_TABLES` + key column; columns are read live from `information_schema` so revisions from older schemas still revert)
- [x] 4.2 Implement the `history.revert({ changeset_id, force })` capability: conflict detection, inverse application in reverse order, one transaction, recorded as a revert changeset
- [x] 4.3 Tests: clean revert of insert, update, and delete; a conflict refuses without changes; a forced revert works and can itself be reverted; revert never writes untracked tables

## 5. Retention and assets (Phase 2)

- [x] 5.1 Add the `history_retention_days` site_config key (default 365)
- [x] 5.2 Add a `prune-history` scheduled function (daily) that keeps the newest revision per row and deletes empty changesets
- [x] 5.3 Make `upload-asset` return, and the admin editor store, immutable asset URLs
- [x] 5.4 Record the resolved SHA-256 of `/assets/<basename>` references in the install record at import time
- [x] 5.5 Tests: pruning keeps the latest revision per row; uploads store the immutable URL

## 6. History UI (Phase 3)

- [x] 6.1 Add an Undo action to the admin save confirmation toast, reverting that save's changeset
- [x] 6.2 Add a history panel on the section toolbar and page: revision list with actor and time, plus a before/after view (shadcn components)
- [x] 6.3 Add a site History page (implemented as a dialog opened from the admin bar, like the media picker; admin routes need server-side role gating): changesets, with actor/label filters and Revert with a conflict dialog and force option
- [x] 6.4 Add i18n strings for all history UI in `public/custom/strings/*.json`
- [ ] 6.5 Verify in the browser on a demo: edit, undo, history panel, revert, conflict path

## 7. Restore points (Phase 4, after the run402 SDK upgrade)

- [ ] 7.1 Confirm the snapshot create/list/restore API in the upgraded `@run402/sdk`
- [ ] 7.2 Add the `restore_points` ledger table and capabilities: create (admin), list (admin), restore (owner + site-name confirmation, `before_restore` first, post-restore changeset)
- [ ] 7.3 Take `before_reimport` in the re-import path (task 1.5)
- [ ] 7.4 Make the `kychon-fleet-upgrade` skill take `before_engine_upgrade` per portal; add `before_agent_run` to agent entry points
- [ ] 7.5 Add a restore points section to admin settings
- [ ] 7.6 Tests and a live check on a scratch project: create, restore, undo the restore

## 8. Export and import bundle (Phase 5)

- [ ] 8.1 Define the `kychon-bundle/v1` schema (Zod) and add an export capability (admin; `include_members` flag)
- [ ] 8.2 Implement bundle import as an initial-import source: copy assets, verify SHA-256, rewrite URLs, follow the re-import rules
- [ ] 8.3 Tests: round-trip export→import into a fresh project renders identically; a tampered asset fails the import
- [ ] 8.4 Open a kychon-concierge follow-up so copy-website emits bundles instead of port seed SQL

## 9. Rollout

- [ ] 9.1 Phase 1: deploy demos, then each port, one at a time; check row counts before and after each
- [ ] 9.2 Update `STRUCTURE.md` / `CLAUDE.md` (initial import, history, agent labelling) in present tense
- [ ] 9.3 Promote the specs into `openspec/specs/` and remove the change directory
