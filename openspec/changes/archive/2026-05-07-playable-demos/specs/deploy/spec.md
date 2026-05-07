## MODIFIED Requirements

### Requirement: Deploy includes scheduled functions with cron

The deploy manifest SHALL include all edge functions with their cron schedules parsed from `// schedule:` comments. For demo site deploys, the manifest SHALL include `reset-demo.js` with schedule `"0 * * * *"` and SHALL exclude `check-expirations.js` (irrelevant for demo sites: no real members, no real emails, data resets hourly). This swap keeps each demo project within the prototype tier's 1-scheduled-function limit.

#### Scenario: Demo deploy includes reset function
- **WHEN** a demo deploy script runs (e.g., `demo/silver-pines/deploy.sh`)
- **THEN** the manifest includes `reset-demo.js` with schedule `"0 * * * *"`
- **AND** the manifest does NOT include `check-expirations.js`

#### Scenario: Production deploy unchanged
- **WHEN** the main `deploy.js` runs for a production portal
- **THEN** the manifest includes `check-expirations.js` and any other scheduled functions as before
- **AND** `reset-demo.js` is NOT included (it lives in `demo/` directory, not `functions/`)
