# Kychon API Examples

## Discover

```json
{ "apiVersion": "2026-05-08", "operation": "portal.discover", "phase": "query", "input": {} }
```

## Read

```json
{ "apiVersion": "2026-05-08", "operation": "search.query", "phase": "query", "input": { "q": "meeting" } }
```

## Dry Run

```json
{ "apiVersion": "2026-05-08", "operation": "members.approve", "phase": "validate", "input": { "id": 42 } }
```

## Execute

```json
{
  "apiVersion": "2026-05-08",
  "operation": "announcements.publish",
  "phase": "execute",
  "input": { "title": "News", "body": "Hello" },
  "idempotencyKey": "announcements-publish-2026-05-08-1",
  "confirmed": true
}
```

## Raw Access Caution

Raw PostgREST and SQL remain available for customization, seeds, and migrations. Avoid raw writes for workflows such as approving members, creating events, publishing announcements, posting forum topics, casting poll votes, uploading resources, or exporting data.
