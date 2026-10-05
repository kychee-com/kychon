## 1. Initial import runs once (Phase 1)

- [ ] 1.1 Add `kychon_install` to `schema.sql`, plus the adoption insert (`import_source = 'adopted'` when `site_config` has rows) placed before any import SQL
- [ ] 1.2 Make `scripts/generate-seed-sql.ts` wrap typed-seed output in the `$kychon_import$` install guard that writes the marker
- [ ] 1.3 Make `scripts/_lib.ts` (`readMigrations` / `runDeploy`) wrap port seed files (`seedFile`) in the same guard
- [ ] 1.4 Add local validation that the import SQL is data-manipulation statements only, failing before any platform call with the offending statement
- [ ] 1.5 Add the explicit re-import option (`reimport` + subdomain confirmation) to `runDeploy` and the deploy CLIs; refuse when unconfirmed
- [ ] 1.6 Tests: guard emitted for typed and port seeds; adoption ordering; validation rejects DDL; unconfirmed re-import refused
- [ ] 1.7 Regenerate the demo reset function so a reset is a re-import that keeps the marker
- [ ] 1.8 Verify on a scratch project: fresh deploy imports; edit and delete content; a deploy with a schema-only change leaves the content row counts and the edits unchanged

## 2. Revision log (Phase 2)

- [ ] 2.1 Add `changesets` and `revisions` tables with indexes (`txid` unique; `revisions(table_name, row_key)`; `created_at`) to `schema.sql`
- [ ] 2.2 Implement the `kychon_record_revision()` trigger function (dollar-quoted, `SECURITY DEFINER`, `SET search_path FROM CURRENT`, no dynamic SQL), skipping updates that change nothing
- [ ] 2.3 Attach the trigger to every history-tracked table with its primary-key argument (`key` for `site_config`)
- [ ] 2.4 Add `kychon_claim_changeset(...)` and `kychon_label_changeset(...)` functions
- [ ] 2.5 Make sure the import guard records the initial import as one `system` changeset labelled `Initial import`
- [ ] 2.6 Tests (integration DB): every operation on every tracked table records before/after; untracked tables record nothing; a single transaction yields a single changeset

## 3. Attribution in the capability API (Phase 2)

- [ ] 3.1 Move `kychon-api` content-write helpers for tracked tables to parameterized `adminDb().sql()` with `RETURNING txid_current()`
- [ ] 3.2 Claim each write's changeset with the authenticated actor, the capability execution id, and the operation label
- [ ] 3.3 Add `history.list`, `history.revisions` (per page/block), and `history.revision` (before/after) capability queries, admin-only
- [ ] 3.4 Document mandatory `kychon_label_changeset` usage for agents in the agent docs (Studio and Pro instructions)
- [ ] 3.5 Tests: admin save attributed to the admin; labelled agent SQL attributed; unlabelled SQL recorded as `unattributed`; non-admin refused

## 4. Revert (Phase 2)

- [ ] 4.1 Build a static allowlist of tracked tables with their key and column lists, shared by revert and export
- [ ] 4.2 Implement the `history.revert({ changeset_id, force })` capability: conflict detection, inverse application in reverse order, one transaction, recorded as a revert changeset
- [ ] 4.3 Tests: clean revert of insert, update, and delete; a conflict refuses without changes; a forced revert works and can itself be reverted; revert never writes untracked tables

## 5. Retention and assets (Phase 2)

- [ ] 5.1 Add the `history_retention_days` site_config key (default 365)
- [ ] 5.2 Add a `prune-history` scheduled function (daily) that keeps the newest revision per row and deletes empty changesets
- [ ] 5.3 Make `upload-asset` return, and the admin editor store, immutable asset URLs
- [ ] 5.4 Record the resolved SHA-256 of `/assets/<basename>` references in the install record at import time
- [ ] 5.5 Tests: pruning keeps the latest revision per row; uploads store the immutable URL

## 6. History UI (Phase 3)

- [ ] 6.1 Add an Undo action to the admin save confirmation toast, reverting that save's changeset
- [ ] 6.2 Add a history panel on the section toolbar and page: revision list with actor and time, plus a before/after view (shadcn components)
- [ ] 6.3 Add a site History page: changesets grouped by capability execution, with actor/label filters and Revert with a conflict dialog and force option
- [ ] 6.4 Add i18n strings for all history UI in `public/custom/strings/*.json`
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
