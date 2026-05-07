## Context

The 3 demo sites (Silver Pines, Eagles, Barrio Unido) are deployed on Run402 with real Postgres databases, real auth, and real RLS (`public_read` — anyone reads, authenticated writes). Currently they are view-only showcases. We want visitors to instantly try admin or member roles with real data mutations, resetting hourly to seed state.

Key constraints:
- Run402 `public_read` RLS requires a real JWT for any write operation
- Prototype tier allows 1 scheduled function per project (min 15 min interval)
- `db.sql()` in Run402 functions supports arbitrary SQL including TRUNCATE
- Demo seeds are 70-210KB of idempotent INSERT statements
- Auth accounts live in Run402's auth layer, separate from the `members` table

## Goals / Non-Goals

**Goals:**
- Visitors can try admin and member roles with one click (real writes, real JWT)
- Persistent top banner communicates demo status, current role, reset countdown, and conversion CTA
- Data resets to seed state every hour, surviving concurrent visitors' mutations
- Demo credentials are transparent and discoverable (this is a feature, not a leak)

**Non-Goals:**
- Visitor self-signup on demo sites (only pre-made demo accounts)
- Guarding against concurrent admins (chaos is fine, hourly reset is the safety net)
- Demo-specific RLS or permissions (same RLS as production portals)
- Custom landing/chooser page (banner handles role switching, homepage stays pristine)

## Decisions

### 1. Real demo accounts via Run402 password auth

**Decision**: Pre-create two Run402 auth accounts per demo site (`demo-admin@kychon.com`, `demo-member@kychon.com`) using the standard signup API. Auto-login via `signIn(email, password)` on button click.

**Why not fake sessions**: RLS `public_read` blocks all writes for anon requests. A fake localStorage session would let visitors see admin UI but not actually create/edit/delete content. Real JWTs are the only path to "playable."

**Why not per-site emails**: Using the same email pair across all 3 demo sites. Each site is its own Run402 project with its own auth database, so no collision. Keeps credentials simple and memorable.

**Credentials hardcoded in client JS**: The `DemoBanner` component includes credentials in its `<script>`. Visible in view-source. This is intentional transparency — the demo is designed to be played.

### 2. Demo mode via `site_config` flag

**Decision**: A `demo_mode: true` flag in `site_config` enables all demo behavior. The client reads this from the config API (already loaded by `ConfigProvider`) and conditionally renders the `DemoBanner`.

**Why not URL-based detection**: Tying demo mode to `*.run402.com` subdomains is brittle and would break if demos move to custom domains.

**Why not a build-time flag**: Demo sites use the same Astro build as production portals. The difference is data (seed), not code. A runtime config flag keeps the build pipeline uniform.

### 3. Top banner (not floating widget)

**Decision**: Sticky top banner above the nav, always visible. Contains: demo indicator, current role, role switcher, reset countdown, "Get Your Own Portal" CTA.

**Why top banner**: The demo IS the sales funnel. The banner should be unmissable, not dismissible. A floating widget could be overlooked or confused with a cookie notice.

**Banner pushes content down**: The banner sits above `<Nav />` in the DOM, using `position: sticky; top: 0; z-index: 1001` (above nav's z-index). This means the nav stacks below the banner, and content flows naturally.

### 4. Hourly reset via scheduled function with inline seed SQL

**Decision**: A `reset-demo.js` scheduled function runs on `0 * * * *`. It TRUNCATEs all mutable tables via `db.sql()`, re-runs the seed INSERT statements (embedded in the function as a SQL string), and re-links demo auth accounts to seed member records.

**Why embed seed SQL in the function**: The function runs in Run402's serverless environment with no filesystem access. It cannot read `seed.sql` from disk. The seed SQL must be inlined in the function code. Each demo's `reset-demo.js` will contain its own seed data.

**Why TRUNCATE + re-seed (not selective DELETE)**: Simpler and more reliable than trying to diff seed vs. visitor-created rows. TRUNCATE is fast, and re-running idempotent INSERTs restores exact seed state. The only table needing special handling is `members` (must preserve demo account user_ids).

**Why this replaces `check-expirations.js`**: Prototype tier allows only 1 scheduled function. `check-expirations` sends email reminders and generates AI insights — irrelevant for demo sites with fake members and hourly resets.

### 5. Reset countdown with client-side polling

**Decision**: The reset function writes `last_reset: <ISO timestamp>` to `site_config` after each reset. The banner reads this on page load, computes `next_reset = last_reset + 60min`, and shows a countdown. A `setInterval` (every 30s) updates the display. When past `next_reset`, the banner shows "Resetting..." overlay and calls `location.reload()`.

**Why not WebSocket/SSE**: Overkill for a countdown that only needs ~30s precision. Polling `site_config` once on load + a client-side timer is sufficient.

**Why force-reload**: After reset, the page's in-memory state (cached announcements, member lists, etc.) is stale. A full reload ensures fresh data. The brief interruption is acceptable — and the countdown prepares the visitor for it.

### 6. One-time bootstrap script

**Decision**: A `scripts/bootstrap-demo.sh` script handles initial demo account setup per site:
1. Signs up `demo-admin@kychon.com` and `demo-member@kychon.com` via Run402 auth API
2. Calls the `on-signup` function to create member records
3. Updates the admin member record: `role='admin'`, `status='active'`
4. Updates the member record: `status='active'`
5. Stores both `user_id` UUIDs in `site_config` as `demo_accounts` key
6. This only runs once per demo site (idempotent — checks if accounts exist first)

**Why a separate script**: Bootstrap is a one-time operation that depends on the auth API returning real UUIDs. It can't be in the seed SQL (which runs before auth accounts exist). It can't be in the scheduled function (which runs every hour). A standalone script keeps the concern isolated.

## Risks / Trade-offs

**Large SQL in function code** — Each demo's reset function embeds 70-210KB of seed SQL. Run402 function code size limits are unknown. → Mitigation: Test with the largest seed (Eagles, 210KB) first. If too large, break into multiple `db.sql()` calls or strip non-essential seed data for reset.

**Concurrent reset + active session** — If a visitor is mid-action when the reset fires, their write could fail or land on a just-truncated table. → Mitigation: Acceptable for a demo. The countdown gives warning, and the force-reload recovers cleanly.

**Demo accounts could be locked out** — If someone changes the demo admin's password via admin settings. → Mitigation: The hourly reset restores `site_config` and member records, but Run402 auth accounts are outside our DB. Password changes in Run402 auth would persist across resets. Low risk: the settings page likely doesn't expose password changes for other users.

**Clock drift on countdown** — Client-side countdown may not align perfectly with server-side cron. → Mitigation: The banner watches for `last_reset` changes. Even if the countdown is off by a few minutes, the reload triggers once the new `last_reset` value appears.
