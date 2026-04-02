## MODIFIED Requirements

### Requirement: Single-command deploy to Run402
The `deploy.js` script SHALL:
1. Run `npx astro build` to generate static output in `dist/`
2. Resolve project ID from `RUN402_PROJECT_ID` env var or `run402 projects list`
3. Resolve `anon_key` from `ANON_KEY` env var or `run402 projects keys`
4. Generate `dist/js/env.js` with `__WILDLYCHEE_API` and `__WILDLYCHEE_ANON_KEY`
5. Read `schema.sql` + seed SQL and write combined `.migrations.sql`
6. Collect all files from `dist/` recursively (instead of `site/`)
7. Collect edge functions from `functions/` with schedule parsing
8. Assemble `app.json` manifest with RLS config and `inherit: true`
9. Execute `run402 deploy --manifest app.json`

#### Scenario: Successful deploy with build step
- **WHEN** `node deploy.js` runs with valid project credentials
- **THEN** Astro build completes first, producing `dist/` with static HTML/JS/CSS
- **AND** `env.js` is injected into `dist/js/`
- **AND** `app.json` manifest references files from `dist/`
- **AND** `run402 deploy` succeeds and prints the live URL

#### Scenario: Build failure stops deploy
- **WHEN** `astro build` fails (e.g., type error in a component)
- **THEN** deploy.js exits with a non-zero exit code
- **AND** no `run402 deploy` command is executed
- **AND** the error message from Astro is printed to stderr
