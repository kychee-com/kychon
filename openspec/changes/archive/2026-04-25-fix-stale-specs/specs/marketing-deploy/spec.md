## REMOVED Requirements

### Requirement: Dedicated Run402 project for marketing site
**Reason**: The marketing site moved to the sibling private repo `kychee-com/kychon-private` per saas-factory F12. This repo no longer provisions or owns the marketing project; that concern lives in the private repo.
**Migration**: Refer to `kychee-com/kychon-private`'s deploy documentation for marketing-project provisioning. Within this repo, treat the marketing site as a cross-repo dependency (covered by the new `Marketing site is a cross-repo dependency` requirement below).

### Requirement: Static-only deployment
**Reason**: Same as above — the marketing site's deploy implementation lives in `kychee-com/kychon-private`. Prescribing `run402 sites deploy` from this repo's spec is misleading because there's no marketing/ directory or deploy script here to satisfy it.
**Migration**: See the `kychon-private` repo for the static-only deploy details.

### Requirement: Subdomain and domain configuration
**Reason**: Subdomain (`kychon`) and custom domain (`kychon.com`) registration are now performed from `kychee-com/kychon-private`. This repo doesn't run `run402 domains add` or `run402 subdomains claim` against the marketing project anymore.
**Migration**: Domain/subdomain configuration is documented in `kychon-private`. This repo only depends on `kychon.com` resolving correctly (covered by the new cross-repo dependency requirement below).

### Requirement: Deploy script
**Reason**: There is no `marketing/deploy-marketing.js` in this repo. The script lives in `kychee-com/kychon-private/marketing/deploy-marketing.js` and is invoked from there.
**Migration**: To deploy the marketing site, run the deploy script from `kychon-private`. Setup and usage are documented in that repo.

## ADDED Requirements

### Requirement: Marketing site is a cross-repo dependency

The marketing site at `kychon.com` SHALL be deployed from the sibling private repo `kychee-com/kychon-private`, not from this repo. This repo SHALL NOT contain the marketing site source, deploy script, or domain configuration. This repo SHALL document the cross-repo boundary so contributors don't add marketing-site changes here by mistake.

#### Scenario: Marketing site is reachable
- **WHEN** an end-user visits `https://kychon.com`
- **THEN** the marketing site SHALL respond successfully (independent of any deploy from this repo)

#### Scenario: Contributor finds the right repo for marketing changes
- **WHEN** a contributor wants to change the marketing site (copy, layout, deploy config, domain settings)
- **THEN** they SHALL find a clear pointer in this repo's docs (e.g., `CLAUDE.md` or a top-level note) directing them to `kychee-com/kychon-private`
