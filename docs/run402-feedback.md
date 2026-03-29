# Run402 Developer Feedback — Wild Lychee Build

**Date**: 2026-03-29
**Project**: Wild Lychee community portal (Phase 1 MVP + Phase 2 modules)
**Scope**: Full-stack app with auth, CRUD pages, scheduled functions, AI features
**Deploy method**: `run402 deploy --manifest app.json` via `deploy.js` script

---

## Summary

Built a complete community portal with 32 site files, 7 edge functions, 20 database tables, and deployed it to `wildlychee.run402.com`. The platform is solid for building real apps. Below are the remaining friction points, from high-impact to nice-to-haves.

---

## HIGH Friction

### ~~1. No post-auth webhook/event system~~ (FIXED)

Run402 now has lifecycle hooks. If a function named `on-signup` is deployed, it's automatically invoked (fire-and-forget) after every first signup. The payload includes `{ user: { id, email, created_at } }` and an `x-run402-trigger: signup` header.

### 2. No recommended pattern for config updates on redeploy

**What happened**: Seed data uses `INSERT ... ON CONFLICT (key) DO NOTHING` so it doesn't overwrite existing values. But when we changed default feature flags from `false` to `true` in `seed.sql`, existing projects didn't get the update. Had to manually `UPDATE` each flag via the CLI.

**This is not a Run402 bug** — it's an inherent SQL pattern issue. But it's a common friction point for iterative deployment.

**Suggestion**: Document a recommended pattern for "update-on-deploy" config. Something like `INSERT ... ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value WHERE site_config.value = '<old_default>'` (only update if the value hasn't been manually changed).

---

## MEDIUM Friction (papercuts)

### 3. No batch REST operations

**What happened**: Approving 12 pending members = 12 individual PATCH requests. CSV import of 200 members = 200 POSTs. No way to batch multiple operations in a single request.

**Suggestion**: Support PostgREST's bulk insert (`POST` with array body) and document it. Or add a `batch` endpoint that accepts an array of operations.

### 4. 10MB file upload limit

**What happened**: Fine for Phase 1 (photos, PDFs, documents). Will be a problem for video resources, large presentations, and photo galleries in niche variants (photographer portals, course platforms).

**Suggestion**: Consider a chunked upload API or a higher limit for paid tiers.

### 5. `run402 functions logs` doesn't stream / follow

**What happened**: During debugging, I had to repeatedly run `run402 functions logs ... --tail 10` to check for new errors. No `--follow` flag to stream logs in real-time.

**Suggestion**: Add `run402 functions logs <id> <name> --follow` for real-time log streaming.

### 6. Function cold start is noticeable (~2-2.5s)

**What happened**: First invocation of `on-signup` after deploy takes 2.5s (`INIT_START` + function execution). Subsequent invocations are faster (~1s). For the signup flow, this means the user waits 2-3 seconds after their first login for the member record to be created.

**Not a bug** — Lambda cold starts are expected. But worth noting for user-facing functions.

**Suggestion**: Document cold start behavior. Consider a warm-up option (periodic ping) for functions on paid tiers.

### 7. Function deploy doesn't validate code

**What happened**: Deployed a function with a syntax error in the SQL parameterization. The deploy succeeded — the error only surfaced when the function was invoked. No way to catch it before deployment.

**Suggestion**: Add a `--validate` flag or basic syntax check during `run402 functions deploy`. Even just `node --check <file>` would catch syntax errors.

---

## LOW Friction (nice-to-haves)

### 8. No way to set project secrets from the browser/admin UI

**What happened**: AI features require `AI_API_KEY` and `AI_PROVIDER` as project secrets. These can only be set via the CLI (`run402 secrets set`). The admin settings panel had to show instructions instead of a working "Save" button.

**Suggestion**: Expose a secrets API that authenticated project admins can call, or provide a web dashboard for secret management.

### 9. `run402 projects sql` output is verbose for simple queries

**What happened**: Every SQL result includes `status`, `schema`, `rows`, `rowCount` wrapper. For quick checks, I just want the rows.

**Suggestion**: Add a `--rows-only` or `--json-rows` flag that outputs just the rows array.

### 10. No storage listing or management from the browser

**What happened**: Files uploaded to Run402 storage have no web UI to browse, manage, or delete. Have to use `run402 storage list/delete` via CLI.

**Suggestion**: Add a basic storage browser in the project dashboard, or expose storage management via the REST API with auth.

---

## Documentation Gaps

### 11. No example of edge function calling another edge function

We needed `config.js` (browser) to call `on-signup` (function). The URL pattern `https://api.run402.com/functions/v1/<name>` isn't explicitly documented for browser-side calls. Had to infer it from the deploy response.

### 12. `db.from()` chaining order not documented

Does `db.from('t').update({...}).eq('id', 1)` work the same as `db.from('t').eq('id', 1).update({...})`? Had to guess. (The PostgREST-style builder typically allows any order, but it's not stated.)

### 13. Storage upload from edge functions not documented

The `upload-resource` function needed to upload files to Run402 storage. The CLI docs show `run402 storage upload` but don't show the HTTP API for uploading from a function. Had to guess the URL pattern (`/storage/v1/upload/<path>`) and auth header (`Authorization: Bearer <service_key>`).

### 14. No documentation on RLS template behavior with writes

The docs explain the 3 RLS templates but don't clarify: Can authenticated users write to `public_read` tables? What about `anon_key` writes with `public_read_write`? Had to test empirically.

---

## What Works Great

- **Bundle deploy is excellent**. One command, full stack. Schema + RLS + site + functions + subdomain. No other platform does this so cleanly.
- **`db.from()` API** is intuitive and productive. PostgREST-style queries from functions are great.
- **`db.sql()` with parameterized queries** works well and is properly documented.
- **Google OAuth zero-config** is a huge DX win. No client ID setup, no redirect URI configuration. It just works.
- **Subdomain auto-reassignment** on redeploy is seamless. Never had to re-claim after a deploy.
- **CloudFront CDN with cache invalidation** on deploy — files are always fresh after a deploy.
- **`email.send()` helper** with raw HTML mode and auto mailbox discovery — sending rich emails from functions is easy.
- **`getUser(req)`** returns `{ id, role, email }` — everything needed for auth in edge functions.
- **Idempotent migrations** (`CREATE TABLE IF NOT EXISTS` + `DO/EXCEPTION` for columns) work perfectly with `migrations_file`.
- **Function logging** is good. Clear timestamps, stack traces, easy to find errors.
- **Prototype tier is genuinely free** and doesn't feel limited for development.
