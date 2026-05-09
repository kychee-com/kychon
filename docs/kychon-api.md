# Kychon Capability API

Kychon exposes a versioned Capability API at `POST /functions/v1/kychon-api`.
The human UI is a reference renderer over the same product capabilities.

## Versions

Every request includes an explicit date-based `apiVersion`.
The initial version is `2026-05-08`.

Engine version, schema version, SDK version, and CLI version are reported separately through discovery.

## Envelope

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

Errors return `ok: false`, `correlationId`, and stable dotted codes such as `request.invalidJson`, `api.unsupportedVersion`, `permission.denied`, `validation.failed`, `conflict.idempotencyKey`, `notFound.object`, and `confirmation.required`.

## Catalog

The registry covers portal, auth, search, config, pages, sections, members, tiers, member fields, events, registration options, RSVPs, announcements, resources, assets, forum, polls, committees, reactions, moderation, translations, newsletters, insights, exports, activity, jobs, and raw access guidance.
