## ADDED Requirements

### Requirement: Dedicated Run402 project for marketing site

The marketing site SHALL be deployed to its own Run402 project, separate from the portal template project and any showcase projects. The project SHALL be provisioned via `run402 projects provision` if it doesn't exist.

#### Scenario: Marketing project provisioned
- **WHEN** the deploy script runs and no marketing project exists
- **THEN** a new Run402 project SHALL be provisioned

#### Scenario: Marketing project already exists
- **WHEN** the deploy script runs and the marketing project exists
- **THEN** the existing project SHALL be reused

### Requirement: Static-only deployment

The marketing site deploy SHALL upload only static files (HTML, CSS, images, SVG). No schema, no seed, no functions. The deploy script SHALL use `run402 sites deploy` or equivalent static hosting command.

#### Scenario: Deploy uploads static files
- **WHEN** the deploy script runs
- **THEN** all files under `marketing/` SHALL be uploaded as static site content
- **THEN** no database migrations or seed data SHALL be executed

#### Scenario: Deploy is idempotent
- **WHEN** the deploy script runs multiple times
- **THEN** the site SHALL be updated with the latest files without errors

### Requirement: Subdomain and domain configuration

The marketing project SHALL claim the `wildlychee` subdomain on Run402 (yielding `wildlychee.run402.com`). The custom domain `wildlychee.com` SHALL be registered via `run402 domains add wildlychee.com wildlychee`, with DNS configured at Route53 (CNAME to `domains.run402.com` or ALIAS + TXT for apex domain).

#### Scenario: Subdomain claimed
- **WHEN** the deploy completes
- **THEN** the marketing site SHALL be accessible at `wildlychee.run402.com`

#### Scenario: Custom domain registered
- **WHEN** `run402 domains add wildlychee.com wildlychee` is run
- **THEN** Run402 SHALL return DNS configuration instructions

#### Scenario: Custom domain active
- **WHEN** DNS is configured and `run402 domains status wildlychee.com` shows `active`
- **THEN** `wildlychee.com` SHALL serve the marketing site

### Requirement: Deploy script

A `marketing/deploy-marketing.js` script SHALL handle provisioning (if needed), file collection, and deployment. It SHALL be runnable with `node marketing/deploy-marketing.js`.

#### Scenario: One-command deploy
- **WHEN** a developer runs `node marketing/deploy-marketing.js`
- **THEN** the marketing site SHALL be deployed to Run402 and accessible at the configured subdomain
