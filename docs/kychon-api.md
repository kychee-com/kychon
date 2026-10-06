# Kychon Capability API

Kychon exposes a versioned Capability API through the Run402 function transport.
The current public endpoint is `POST https://api.run402.com/functions/v1/kychon-api`.
The human UI is a reference renderer over the same product capabilities.

## Versions

Every request includes an explicit date-based `apiVersion`.
The API version is `2026-05-08`.

Engine version, schema version, SDK version, and CLI version are reported separately through discovery.

## Envelope

Requests include the portal's public Run402 anon key in the `apikey` header.
Agents can discover the endpoint from `/.well-known/kychon.json` and the public key from `/js/env.js`; the typed SDK does this automatically from `portalUrl`.

```json
{
  "apiVersion": "2026-05-08",
  "operation": "events.create",
  "phase": "validate",
  "input": {},
  "idempotencyKey": "required-for-execute",
  "confirmed": false
}
```

Operations use lower-camel dot names. Reads use `phase: "query"`. Mutations support `phase: "validate"` and `phase: "execute"`.

## Actors

The API derives actor state server-side from Run402 `getUser(req)` and Kychon member rows:

`anonymous`, `authenticated_non_member`, `pending_member`, `active_member`, `moderator`, `admin`, `project_admin`.

Client-supplied role fields are ignored for authorization.

## Safety

Mutations return an `ActionPlan` during validation and an `ActionResult` during execution. Executions require idempotency keys. Confirmation-required operations reject execution until `confirmed: true`.

## Discovery

- `GET /.well-known/kychon.json`
- `GET /kychon-capabilities.json`
- `GET /llms.txt`
- `portal.discover`
- `portal.capabilities`
- `portal.version`
- `portal.describe`
- `assistant.guide`

## AI connector (MCP)

Run402 serves every portal as an MCP server at `https://<portal>/_run402/mcp`, and `kychon-api` is its one tool (`export const tool` in `functions/kychon-api.js`). ChatGPT, Claude and other MCP clients connect there, sign in through the portal, and every call acts as that person with their permissions. The tool's arguments are the operation envelope, and a tool call (header `x-run402-trigger: mcp_tool`) gets these defaults: the current `apiVersion`, empty `input`, `phase` `query` for reads and `validate` for writes (so a write without a phase only previews), and a fresh `idempotencyKey` for an `execute`.

- `assistant.guide` returns who the call acts as and the tasks this actor can do, grouped by area, with the safety rules.
- `portal.describe` with `{ "operation": "<name>" }` returns that operation's input JSON Schema and an example. Operations the guide lists validate their input against the schema and fail with `validation.failed` and `detail.errors` field paths.
- Admins turn connectors off with `site_config.feature_ai_connector = false`; connector calls then fail with `connector.disabled`.
- `members.changeRole`, `members.linkUser`, `exports.*` and `jobs.*` are never available through a connector (`connector.operationUnavailable`); they stay in the portal UI.
- An anonymous connector call to a member-only operation gets the platform's sign-in challenge (HTTP 401), so the client can offer to sign in.
- `confirmation.required` errors carry `detail.plan`, a plain-language description of what the operation will do and whether it can be undone.

The guide and schemas are authored in `src/lib/capability-api/connector.ts`; `npx tsx scripts/generate-connector-schemas.ts` copies them into the function.

## Errors

There are two error layers, distinguishable by a `source` field on the error.

**Operation errors** are raised by a capability handler once the request reaches the function. They return `{ ok: false, correlationId, error: { code, message, ... } }` with stable dotted codes such as `request.invalidJson`, `api.unsupportedVersion`, `permission.denied`, `validation.failed`, `conflict.idempotencyKey`, `notFound.object`, `confirmation.required`, `rateLimit.exceeded`, and `api.notImplemented`. A `rateLimit.exceeded` error is HTTP 429 with `retryable: true`, `detail.retryAfterSeconds`, and a matching `Retry-After` header.

**Gateway-boundary errors** are raised by the Run402 gateway *before* the function runs — a malformed JSON body, or a missing or invalid `apikey`. These carry `source: "gateway"`, a `category`, a coarse `code` (`VALIDATION_FAILED`, `AUTH_REQUIRED`, `INVALID_AUTH`), and a `next_actions` array describing how to recover. They are **not** part of the dotted operation catalog — branch on `source === "gateway"` to handle them.

In short: treat any error carrying `source: "gateway"` as a transport/auth problem to fix in the request itself (well-formed JSON, a valid `apikey`), and reserve dotted-code handling for operation errors.

## Catalog

The registry covers portal, auth, search, config, pages, sections, members, tiers, member fields, events, registration options, RSVPs, announcements, resources, assets, forum, polls, committees, reactions, moderation, translations, newsletters, insights, exports, activity, jobs, and raw access guidance.
