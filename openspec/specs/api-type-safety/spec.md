## Purpose

Kychon's API layer provides typed, runtime-validated access to Run402 PostgREST entities while preserving raw REST helpers for new or project-specific tables.

## Requirements

### Requirement: Zod schemas for API entities

The project SHALL define Zod schemas in `src/schemas/` for PostgREST entity types including SiteConfig, Member, MemberTier, Event, EventRSVP, Announcement, ForumCategory, ForumTopic, ForumReply, Resource, Committee, CommitteeMember, Page, Section, Reaction, and other first-party content entities.

Each schema SHALL match the corresponding database table columns and types.

#### Scenario: Schema validates correct data
- **WHEN** PostgREST returns a valid event record
- **THEN** `EventSchema.parse(data)` succeeds and returns a typed object

#### Scenario: Schema rejects invalid data
- **WHEN** PostgREST returns data with a missing required field
- **THEN** `EventSchema.parse(data)` throws a ZodError with a descriptive message
- **AND** the error identifies which field failed validation

### Requirement: Typed API wrapper functions

The `src/lib/api.ts` module SHALL export typed wrapper functions for common PostgREST queries. Each function SHALL parse the response through the appropriate Zod schema.

#### Scenario: Typed event fetch
- **WHEN** code calls `getEvents()`
- **THEN** the return type is `Event[]` inferred from the Zod schema
- **AND** the response is validated at runtime against `EventSchema`

#### Scenario: Build-time type error
- **WHEN** an agent writes code that accesses `event.nonExistentField`
- **THEN** TypeScript reports an error at build time
- **AND** `astro check` or `astro build` fails with a clear error message

### Requirement: Raw API access preserved

The base `api.get()`, `api.post()`, `api.patch()`, and `api.del()` functions SHALL remain available for cases where typed wrappers do not exist. Typed wrappers are a convenience layer, not a replacement.

#### Scenario: Agent uses raw API for custom table
- **WHEN** an agent adds a `volunteer_hours` table and calls `api.get('volunteer_hours')`
- **THEN** the call succeeds and returns untyped JSON
- **AND** no build error occurs
