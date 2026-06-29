# Deploy Kychon To Run402 Core On AWS

This guide shows how to deploy Kychon from this open-source repo to a
self-hosted Run402 Core Gateway running in your AWS account.

This is a source-to-Core deploy. It is not a Run402 Cloud export/import flow and
it does not need a `.r402ar` archive.

## What This Proves

The deployment uses the normal Run402 apply path:

```bash
npm install -g run402
run402 init --api-base=http://my-core:4020
run402 projects provision --name "my-kychon"
KYCHON_PROJECT=kychon npm run build
npm run build:run402-manifest
run402 deploy apply --manifest app.json --final-only
```

`app.json` contains the Core-compatible Kychon release: schema and seed SQL,
static site files, Astro SSR, the same-origin `/api/kychon` function route, and
trusted local functions.

## Supported Slice

Run402 Core Developer Preview runs the application data plane. Run402 Cloud
remains the managed path for fleet operations and Cloud-only services.

| Kychon capability | Core treatment |
| --- | --- |
| Static site | Included |
| Astro SSR | Included through `astro.ssr.v1` |
| Database schema and seed data | Included as inline SQL migrations |
| PostgREST and RLS | Included |
| `/api/kychon` Capability API | Included |
| Non-scheduled Node functions | Included |
| Upload functions | Included, with local Core storage |
| Managed subdomains | Omitted |
| Custom domains and TLS automation | Omitted |
| i18n routing slice | Omitted |
| Scheduled/background functions | Omitted |
| Email and AI managed helpers | Omitted |
| Hosted OAuth | Omitted |
| Billing, backups, monitoring, abuse controls | Run402 Cloud only |

## Prerequisites

Start a Run402 Core Gateway on AWS first. Follow the Core repo's EC2 guide:

```text
run402-core/docs/deployment/aws-ec2/README.md
```

You need:

- Node.js 22+
- npm
- Git LFS
- network access to the Core Gateway on ports `4020` and `4300`
- `run402` CLI `3.5.5` or newer
- `@run402/astro` `2.4.5` or newer in this checkout

Set your Core URLs:

```bash
export RUN402_CORE_URL="http://<ec2-public-dns-or-ip>:4020"
export RUN402_CORE_POSTGREST_URL="http://<ec2-public-dns-or-ip>:4300"

curl -fsS "$RUN402_CORE_URL/health"
```

Expected response includes:

```json
{"status":"ok","mode":"core"}
```

## Walkthrough

Clone and install Kychon:

```bash
git clone https://github.com/kychee-com/kychon.git
cd kychon
git lfs install
git lfs pull
npm install
```

Configure the Run402 client surface for Core:

```bash
npm install -g run402
run402 init --api-base="$RUN402_CORE_URL"
```

Provision a Core project:

```bash
run402 projects provision --name "kychon-core-smoke" | tee core-provision.json
```

The output includes `project_id`, `anon_key`, `service_key`, and endpoint URLs.
`core-provision.json` is ignored by git.

Build Kychon:

```bash
KYCHON_PROJECT=kychon npm run build
```

Generate the Core manifest:

```bash
npm run build:run402-manifest
```

Expected output lists:

- Core API base source
- active project source
- migration id
- included functions: `export-csv`, `kychon-api`, `site-search`, `ssr`,
  `upload-asset`, `upload-resource`
- omitted Cloud-only or scheduled functions

Apply the release:

```bash
run402 deploy apply --manifest app.json --final-only
```

Save the returned `release_id`, `operation_id`, and `urls`.

## Browser URL

The static diagnostic URL is always:

```bash
export PROJECT_ID="$(jq -r '.project_id' core-provision.json)"
export CORE_PROJECT_STATIC="$RUN402_CORE_URL/projects/v1/$PROJECT_ID/static"

curl -fsS "$CORE_PROJECT_STATIC/" | head
curl -fsS "$CORE_PROJECT_STATIC/js/env.js" | head
```

For browser-shaped routes such as `/`, `/search`, `/admin`, and `/api/kychon`,
configure the Core Gateway root project on the AWS host as described in the Core
EC2 guide. Kychon emits root-relative links, so the normal browser target is:

```bash
export CORE_SITE_URL="$RUN402_CORE_URL"
```

## Smoke Checks

Static and runtime config:

```bash
curl -fsS "$CORE_SITE_URL/" | head
curl -fsS "$CORE_SITE_URL/js/env.js" | grep "$RUN402_CORE_URL"
```

Kychon Capability API:

```bash
curl -fsS "$CORE_SITE_URL/api/kychon" \
  -X POST \
  -H 'content-type: application/json' \
  --data-binary '{"apiVersion":"2026-05-08","operation":"portal.capabilities","phase":"query","input":{}}' \
  | jq .

curl -fsS "$CORE_SITE_URL/api/kychon" \
  -X POST \
  -H 'content-type: application/json' \
  --data-binary '{"apiVersion":"2026-05-08","operation":"config.get","phase":"query","input":{}}' \
  | jq .

curl -fsS "$CORE_SITE_URL/api/kychon" \
  -X POST \
  -H 'content-type: application/json' \
  --data-binary '{"apiVersion":"2026-05-08","operation":"sections.list","phase":"query","input":{}}' \
  | jq .
```

SSR routes:

```bash
curl -fsS "$CORE_SITE_URL/ssr-probe" | head
curl -i -sS "$CORE_SITE_URL/search" | head
curl -i -sS "$CORE_SITE_URL/admin" | head
curl -i -sS "$CORE_SITE_URL/some-ssr-path" | head
```

Expected:

- `/ssr-probe` returns `200`.
- `/search` returns `200` with `x-run402-cache: dynamic-bypass`.
- `/admin` redirects to `/join?returnTo=%2Fadmin`.
- `/some-ssr-path` may be Kychon's 404 page.
- No route returns `Astro app not loaded (dev/test stub)`.

PostgREST and RLS:

```bash
curl -fsS "$RUN402_CORE_URL/projects/v1/$PROJECT_ID" \
  | tee core-project.json | jq .

export SCHEMA_SLOT="$(jq -r '.schema_slot' core-project.json)"

curl -fsS \
  -X POST "$RUN402_CORE_URL/auth/v1/dev-tokens" \
  -H 'content-type: application/json' \
  --data-binary '{"project_id":"'"$PROJECT_ID"'","role":"authenticated","sub":"core-smoke-user"}' \
  | tee core-user-token.json | jq .

export USER_AUTH="$(jq -r '.authorization' core-user-token.json)"

curl -fsS \
  "$RUN402_CORE_POSTGREST_URL/site_config?select=key,value&limit=5" \
  -H "accept-profile: $SCHEMA_SLOT" \
  -H "authorization: $USER_AUTH" \
  | jq .
```

Expected rows include `site_name`, `site_tagline`, and `brand_text`.

## Troubleshooting

`unsupported_capability`
: The manifest still contains a Cloud-only slice. Regenerate with
  `npm run build:run402-manifest`, not the Cloud deploy script.

`No Run402 Core API base found`
: Run `run402 init --api-base="$RUN402_CORE_URL"` or set `RUN402_API_BASE`.

`No anon_key found`
: Run `run402 projects provision --name "kychon-core-smoke"` first, or keep the
  provision output in `core-provision.json`.

`Astro app not loaded (dev/test stub)`
: Upgrade to `@run402/astro@2.4.5` or newer, reinstall, rebuild, regenerate
  `app.json`, and re-apply.

Root URL serves a different project
: Update the Core Gateway root project on the AWS host, then restart the Core
  Gateway and function worker containers.
