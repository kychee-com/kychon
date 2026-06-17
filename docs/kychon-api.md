# Kychon Capability API

Kychon exposes a versioned Capability API through the Run402 function transport.
The current public endpoint is `POST https://api.run402.com/functions/v1/kychon-api`.
The human UI is a reference renderer over the same product capabilities.

## Versions

Every request includes an explicit date-based `apiVersion`.
The initial version is `2026-05-08`.

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

## Errors

There are two error layers, distinguishable by a `source` field on the error.

**Operation errors** are raised by a capability handler once the request reaches the function. They return `{ ok: false, correlationId, error: { code, message, ... } }` with stable dotted codes such as `request.invalidJson`, `api.unsupportedVersion`, `permission.denied`, `validation.failed`, `conflict.idempotencyKey`, `notFound.object`, `confirmation.required`, and `api.notImplemented`.

**Gateway-boundary errors** are raised by the Run402 gateway *before* the function runs — a malformed JSON body, or a missing or invalid `apikey`. These carry `source: "gateway"`, a `category`, a coarse `code` (`VALIDATION_FAILED`, `AUTH_REQUIRED`, `INVALID_AUTH`), and a `next_actions` array describing how to recover. They are **not** part of the dotted operation catalog — branch on `source === "gateway"` to handle them.

In short: treat any error carrying `source: "gateway"` as a transport/auth problem to fix in the request itself (well-formed JSON, a valid `apikey`), and reserve dotted-code handling for operation errors.

## Catalog

The registry covers portal, auth, search, config, pages, sections, members, tiers, member fields, events, registration options, RSVPs, announcements, resources, assets, forum, polls, committees, reactions, moderation, translations, newsletters, insights, exports, activity, jobs, and raw access guidance.
