## Purpose

The marketing site is deployed from a sibling repository, and this repo documents that boundary.

## Requirements

### Requirement: Marketing site is a cross-repo dependency

The marketing site at `kychon.com` SHALL be deployed from the sibling private repo `kychee-com/kychon-private`, not from this repo. This repo SHALL NOT contain the marketing site source, deploy script, or domain configuration. This repo SHALL document the cross-repo boundary so contributors don't add marketing-site changes here by mistake.

#### Scenario: Marketing site is reachable
- **WHEN** an end-user visits `https://kychon.com`
- **THEN** the marketing site SHALL respond successfully (independent of any deploy from this repo)

#### Scenario: Contributor finds the right repo for marketing changes
- **WHEN** a contributor wants to change the marketing site (copy, layout, deploy config, domain settings)
- **THEN** they SHALL find a clear pointer in this repo's docs (e.g., `CLAUDE.md` or a top-level note) directing them to `kychee-com/kychon-private`

