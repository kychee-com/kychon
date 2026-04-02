## 1. Demo Seed Config

- [x] 1.1 Add `demo_mode: true` to `demo/silver-pines/seed.sql` (INSERT INTO site_config with ON CONFLICT DO UPDATE)
- [x] 1.2 Add `demo_mode: true` to `demo/eagles/seed.sql`
- [x] 1.3 Add `demo_mode: true` to `demo/barrio-unido/seed.sql`

## 2. DemoBanner Component

- [x] 2.1 Create `src/components/DemoBanner.astro` — sticky top banner with demo indicator, role display, role-switching buttons, reset countdown, and "Get Your Own Portal" CTA
- [x] 2.2 Add DemoBanner to `src/layouts/Portal.astro` — conditionally render above `<Nav />` when `demo_mode` config is true (read from ConfigProvider's loaded config)
- [x] 2.3 Implement auto-login logic in DemoBanner `<script>` — "Try as Admin" calls `signIn('demo-admin@wildlychee.com', 'demo123')`, "Try as Member" calls the member variant, "Just Browse" calls `signOut()`, all followed by page reload
- [x] 2.4 Implement reset countdown — read `last_reset` from site_config on load, compute next reset time, update display every 30s, show "Resets in Xm" or "Resets hourly" fallback
- [x] 2.5 Implement force-reload on reset — when countdown reaches zero, show "Demo resetting..." overlay, reload page after 2s delay

## 3. Reset Function

- [x] 3.1 Create `demo/silver-pines/reset-demo.js` — scheduled function (`// schedule: "0 * * * *"`) that reads `demo_accounts` from site_config, TRUNCATEs mutable tables, re-runs Silver Pines seed INSERTs via `db.sql()`, re-links demo user_ids, writes `last_reset` timestamp
- [x] 3.2 Create `demo/eagles/reset-demo.js` — same structure with Eagles seed data
- [x] 3.3 Create `demo/barrio-unido/reset-demo.js` — same structure with Barrio Unido seed data
- [x] 3.4 Test reset function with largest seed (Eagles, ~210KB) to verify `db.sql()` handles the payload size

## 4. Bootstrap Script

- [x] 4.1 Create `scripts/bootstrap-demo.sh` — accepts project ID and anon_key as args, signs up both demo accounts via Run402 auth API, calls on-signup, promotes admin, activates member, stores user_ids in site_config as `demo_accounts` key
- [x] 4.2 Make bootstrap idempotent — check if accounts already exist before signup, verify `demo_accounts` config key

## 5. Demo Deploy Updates

- [x] 5.1 Update `demo/silver-pines/deploy.sh` — include `demo/silver-pines/reset-demo.js` as a function in the manifest, exclude `check-expirations.js` from functions list
- [x] 5.2 Update `demo/eagles/deploy.sh` — same changes
- [x] 5.3 Update `demo/barrio-unido/deploy.sh` — same changes

## 6. Deploy & Verify

- [x] 6.1 Deploy Silver Pines with demo mode, run bootstrap, verify auto-login + banner + writes work
- [x] 6.2 Deploy Eagles with demo mode, run bootstrap, verify
- [x] 6.3 Deploy Barrio Unido with demo mode, run bootstrap, verify
- [x] 6.4 Wait for reset cron to fire, verify data resets and page force-reloads
