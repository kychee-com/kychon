## Purpose

Kychon deployments are packaged as Run402 manifests that include static site files, database migrations, seed data, edge functions, RLS policy configuration, scheduled jobs, and project targeting so a developer can deploy or redeploy a portal predictably.
## Requirements
### Requirement: Single-command deploy to Run402

The system SHALL provide a deploy entry point that builds the Astro project, assembles a Run402 deploy payload from project files, and deploys it to Run402.

The deploy flow SHALL:
1. Run `npx astro build` to generate static output in `dist/`
2. Resolve project ID from `RUN402_PROJECT_ID` or the active Run402 project
3. Resolve `anon_key` from `ANON_KEY` or Run402 project keys
4. Generate `dist/js/env.js` with `__KYCHON_API` and `__KYCHON_ANON_KEY`
5. Read `schema.sql` and seed SQL as deploy migrations
6. Collect all files from `dist/` recursively
7. Collect edge functions from `functions/` with schedule parsing
8. Include RLS configuration and subdomain targeting
9. Execute the Run402 deploy

#### Scenario: Deploy from clean checkout
- **WHEN** a developer runs the deploy entry point with a valid Run402 project
- **THEN** Astro build completes first, producing `dist/` with static HTML, JavaScript, and CSS
- **THEN** the script reads all files under `dist/`, all functions under `functions/`, `schema.sql`, and seed SQL
- **THEN** it assembles and executes a valid Run402 deploy
- **THEN** the site is accessible at `{subdomain}.run402.com`

#### Scenario: Build failure stops deploy
- **WHEN** Astro build fails
- **THEN** the deploy exits with a non-zero exit code
- **AND** no Run402 deploy is executed
- **AND** the Astro error is printed for debugging

#### Scenario: Re-deploy preserves existing data
- **WHEN** the deploy entry point is run against a project that already has data
- **THEN** migrations are idempotent (no data loss), site files are updated, functions are redeployed
- **THEN** the subdomain automatically points to the new deployment

### Requirement: Deploy script reads project config

The deploy script SHALL read `project_id` from environment variable `RUN402_PROJECT_ID` or from `~/.config/run402/projects.json` (active project). The deploy script SHALL require `SUBDOMAIN` to be set explicitly and SHALL fail before deploying when `SUBDOMAIN` is unset or blank.

#### Scenario: Project ID from environment
- **WHEN** `RUN402_PROJECT_ID` is set and the deploy entry point is run
- **THEN** the manifest uses that project ID

#### Scenario: Project ID from active project
- **WHEN** `RUN402_PROJECT_ID` is not set
- **THEN** the script uses the active project from `run402 projects list`

### Requirement: Deploy includes current database exposure configuration

The deploy flow SHALL use Run402's current database exposure configuration rather than legacy bundle policy templates. Kychon product workflows SHALL be mediated by the Capability API unless a table is explicitly included in the current `database.expose` manifest.

#### Scenario: Database exposure is applied on deploy
- **WHEN** the deploy completes
- **THEN** the deploy uses the unified deploy shape with `database.expose`
- **AND** it does not rely on legacy bundle policy templates or retired policy names

<!-- Phase 2 additions -->

### Requirement: Deploy includes scheduled functions with cron

The deploy manifest SHALL include all edge functions with their cron schedules parsed from `// schedule:` comments. For demo site deploys, the manifest SHALL include `reset-demo.js` with schedule `"0 * * * *"` and SHALL exclude `check-expirations.js` (irrelevant for demo sites: no real members, no real emails, data resets hourly). This swap keeps each demo project within the prototype tier's 1-scheduled-function limit.

#### Scenario: Demo deploy includes reset function
- **WHEN** a demo deploy script runs (e.g., `demo/silver-pines/deploy.sh`)
- **THEN** the manifest includes `reset-demo.js` with schedule `"0 * * * *"`
- **AND** the manifest does NOT include `check-expirations.js`

#### Scenario: Production deploy unchanged
- **WHEN** the main `scripts/deploy.ts` runs for a production portal
- **THEN** the manifest includes `check-expirations.js` and any other scheduled functions as before
- **AND** `reset-demo.js` is NOT included (it lives in `demo/` directory, not `functions/`)

### Requirement: Deploy handles new tables through the current exposure model

The schema SHALL include the new tables: `events`, `event_rsvps`, `resources`, `forum_categories`, `forum_topics`, `forum_replies`, `committees`, `committee_members`. Access to those tables SHALL use the current database exposure configuration or the Kychon Capability API rather than legacy policy-template names.

#### Scenario: New tables avoid legacy policy templates
- **WHEN** the deploy completes
- **THEN** new content tables are present in the deployed schema
- **AND** no legacy policy-template name is required for them to be usable through Kychon workflows

### Requirement: Deploy uses current Run402 Unified Apply

The deploy entry point SHALL use an exact-pinned `@run402/sdk` version that supports scoped Unified Apply, `site.public_paths` explicit mode, static route aliases, subdomain binding, and SDK-owned HTTP naming translation. For this change, the exact pin SHALL be `2.46.0`.

#### Scenario: SDK pin exposes current apply types
- **WHEN** a contributor installs dependencies from `package-lock.json`
- **THEN** `@run402/sdk` resolves to version `2.46.0`
- **AND** TypeScript accepts the `ReleaseSpec` used by `r.project(id).apply()`

#### Scenario: SDK remains exact-pinned
- **WHEN** a dependency update changes `@run402/sdk`
- **THEN** the package manifest keeps an exact version string without `^` or `~`
- **AND** the change is reviewed as an intentional Run402 contract update

### Requirement: Deploy publishes explicit public static paths

The deploy entry point SHALL include `site.public_paths: { mode: "explicit", replace: ... }` in the Run402 release spec. The public path map SHALL publish clean Kychon-owned HTML URLs and required support assets, while keeping `.html` release asset paths hidden unless deliberately declared.

#### Scenario: Deploy spec contains clean public page paths
- **WHEN** the deploy entry point assembles a Run402 release spec after a successful Astro build
- **THEN** the spec maps standard Kychon pages such as `/events`, `/resources`, `/forum`, `/polls`, `/committees`, `/search`, `/directory`, `/join`, `/profile`, `/event`, `/admin`, `/admin-members`, and `/admin-settings` through `site.public_paths.replace`
- **AND** each entry references the corresponding release asset such as `events.html` or `admin.html`

#### Scenario: Deploy spec contains generated custom page paths
- **WHEN** the active seed has build-known published pages with safe non-conflicting slugs
- **THEN** the deploy spec maps each clean slug path through `site.public_paths.replace`
- **AND** the mapped asset is the generated slug `.html` file

#### Scenario: Deploy spec hides implementation paths
- **WHEN** the deploy entry point assembles `site.public_paths.replace`
- **THEN** it does not include public entries for Kychon-owned `.html` implementation paths such as `/events.html`, `/search.html`, `/admin.html`, `/page.html`, or generated custom page filenames
- **AND** those assets remain available only as release asset targets

#### Scenario: Deploy spec publishes required support files
- **WHEN** the deploy entry point assembles `site.public_paths.replace`
- **THEN** it includes required static support paths for Astro assets, CSS, runtime config, custom strings, images, favicons, discovery metadata, and release metadata
- **AND** public pages can load without implicit static filename reachability

### Requirement: Deploy clears ordinary static route aliases

The deploy entry point SHALL NOT use `routes.replace` for ordinary clean static page URLs when `site.public_paths` explicit mode is used. Because Run402 carries routes forward when `routes` is omitted or null, Kychon SHALL deliberately replace the route table with only supported routed functions or an empty array.

#### Scenario: Static aliases are not emitted as routes
- **WHEN** the deploy entry point assembles a release spec for ordinary static pages
- **THEN** `/events`, `/search`, `/resources`, `/admin`, and generated custom page paths are absent from `routes.replace`
- **AND** their reachability comes from `site.public_paths.replace`

#### Scenario: Old static route aliases are cleared
- **WHEN** the current base release contains v1.66 static route aliases
- **THEN** the next `r.project(id).apply()` deploy replaces the route table rather than carrying those aliases forward
- **AND** the release has no stale route-static aliases for ordinary static pages

#### Scenario: Function routes remain possible
- **WHEN** a future Kychon release adds a same-origin function route
- **THEN** `routes.replace` may include that function route
- **AND** ordinary static page URLs still remain in `site.public_paths`

### Requirement: Deploy verification checks hidden implementation URLs

Kychon deploy verification SHALL validate both positive clean public paths and negative implementation paths. Verification SHALL use Run402 release inventory or resolve diagnostics when available, and SHALL include HTTP smoke checks for user-visible behavior.

#### Scenario: Clean route succeeds
- **WHEN** a deployed portal is verified
- **THEN** verification checks that `/events` returns a successful HTML response
- **AND** verification checks that `/search?q=hello&type=all` returns the search page

#### Scenario: Implementation route is hidden
- **WHEN** a deployed portal is verified
- **THEN** verification checks that `/events.html` is not served as a successful HTML response
- **AND** the result is treated as expected hidden implementation behavior

#### Scenario: Release inventory confirms public paths
- **WHEN** Run402 release inventory is available
- **THEN** verification inspects `static_public_paths`
- **AND** it confirms `/events` maps to `events.html` with explicit public-path authority
