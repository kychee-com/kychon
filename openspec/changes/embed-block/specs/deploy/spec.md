## ADDED Requirements

### Requirement: Deploy ships baseline security headers

The deploy pipeline SHALL include the project's static-asset security headers (`public/_headers` or equivalent) in every deploy. The headers file SHALL be processed at deploy time so that `{PROVIDER_HOSTS}` placeholders in the CSP are substituted with the current registered embed providers' `frameAncestor` hosts. The deployed site SHALL respond to every HTML request with the generated CSP and the adjacent headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

The deploy script SHALL run a CSP validity check before invoking the Run402 SDK; if the check fails, the deploy SHALL abort with a non-zero exit and a clear, actionable error.

#### Scenario: Deploy includes generated headers
- **WHEN** `npx tsx scripts/deploy.ts` runs
- **THEN** the deploy bundle includes a headers configuration whose CSP `frame-src` lists every embed provider's `frameAncestor`
- **THEN** the bundle includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`

#### Scenario: Deploy aborts on missing required directive
- **WHEN** the headers file lacks `default-src` or `frame-src`
- **THEN** the deploy script exits with a non-zero status and a message identifying the missing directive

#### Scenario: Deploy aborts on missing provider host
- **WHEN** the registry contains a provider whose `frameAncestor` is not present in the generated CSP
- **THEN** the deploy script exits with a non-zero status and a message naming the provider and missing host

#### Scenario: Deploy aborts on dangerous wildcards
- **WHEN** the headers contain `*` in a critical directive (e.g. `frame-src *`) or `'unsafe-eval'`
- **THEN** the deploy script exits with a non-zero status
