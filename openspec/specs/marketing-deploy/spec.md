## ADDED Requirements

### Requirement: Marketing site is a cross-repo dependency

The marketing site at `kychon.com` SHALL be deployed from the sibling private repo `kychee-com/kychon-private`, not from this repo. This repo SHALL NOT contain the marketing site source, deploy script, or domain configuration. This repo SHALL document the cross-repo boundary so contributors don't add marketing-site changes here by mistake.

#### Scenario: Marketing site is reachable
- **WHEN** an end-user visits `https://kychon.com`
- **THEN** the marketing site SHALL respond successfully (independent of any deploy from this repo)

#### Scenario: Contributor finds the right repo for marketing changes
- **WHEN** a contributor wants to change the marketing site (copy, layout, deploy config, domain settings)
- **THEN** they SHALL find a clear pointer in this repo's docs (e.g., `CLAUDE.md` or a top-level note) directing them to `kychee-com/kychon-private`

<!--
Historical note (2026-04-25, openspec/changes/archive/2026-04-25-fix-stale-specs/):
This spec previously prescribed implementation details for a `marketing/deploy-marketing.js`
script that lived in this repo. Per saas-factory F12, the marketing site moved to the sibling
`kychee-com/kychon-private` repo. The four prior requirements (Dedicated Run402 project,
Static-only deployment, Subdomain and domain configuration, Deploy script) were replaced by
the single cross-repo-dependency requirement above. See the archived change for the full
delta with reasons + migration notes.
-->
