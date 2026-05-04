# Consultation Result

**Model**: gpt-5.5-pro
**Submitted**: 2026-05-04T17:27:19.816680
**Completed**: 2026-05-04T17:38:35.573912
**Status**: completed

---

## Verdict

The direction is right: PostgreSQL FTS + a normalized `search_documents` table is a good “great but not overkill” fit for small association sites, and deferring PDF body/OCR/external search services is the right call.

I would revise the OpenSpec before implementation. The current design is strong on the search UI shape, but under-specifies three things that matter a lot for Kychon ports:

1. **Kychon’s real page content lives in `sections`, not just `pages.content`.**
2. **Members-only search privacy needs database/API-level guarantees, not client filtering.**
3. **The sync model is too fragile if every write path must remember to update `search_documents`.**

Below are prioritized findings and exact artifact changes.

---

## P0 — Must fix before implementation

### 1. Page search will miss most copied-site content unless it indexes `sections`

The proposal says “search pages, resources, and events,” but Kychon’s visible pages are config-driven through `sections`. A copied Wild Apricot page may have its heading, body, FAQ, hero, promo cards, custom HTML, etc. in `sections.config`, not in `pages.content`.

**Recommendation**

Index a **page document per page slug** that aggregates:

- `pages.title`
- `pages.content`
- visible page-scoped sections for that slug, especially `zone = 'main'`
- optionally page-scoped `page_banner` caption text
- not global nav/footer/header chrome

Search result URL should be page-level, not section-level, to avoid noisy results.

**Change artifacts**

Add to `design.md`:

> Page search documents SHALL aggregate `pages` rows and visible page-scoped `sections` text. Global chrome sections SHALL NOT be indexed.

Add to `site-search/spec.md`:

> Requirement: Page search includes schema-driven section content.

Add scenarios:

- homepage hero/FAQ/custom section text is searchable
- global footer attribution text is not searchable
- updating a section config refreshes the page search document

Add to `tasks.md`:

- Add plain-text extraction from relevant section configs.
- Wire `sections` create/update/delete/visibility changes to refresh the corresponding page document.
- Add tests for section-derived search hits.

---

### 2. Privacy/visibility needs a hard server-side and database boundary

The spec correctly says anonymous users must not see members-only content, but the design does not yet guarantee that `search_documents` itself cannot be queried directly through PostgREST. If `search_documents` stores members-only resource/event titles and snippets, direct REST access would leak them unless protected.

Also clarify that “authenticated member” means an **active** member/admin/moderator, not merely any logged-in user with `status = pending`, `expired`, or `suspended`.

**Recommendation**

Use a Run402 server function as the only public search API, and ensure `search_documents` is not directly readable by browsers unless equivalent RLS/policies are in place.

Endpoint visibility should be based on:

- anonymous: `published = true AND is_members_only = false`
- active member/admin/moderator: published public + published members-only
- pending/expired/suspended/no member row: same as anonymous

Also add privacy cache headers:

- `Cache-Control: no-store` or `private, max-age=0`
- `Vary: Authorization`

**Change artifacts**

Add to `design.md` decision:

> The search endpoint SHALL enforce visibility server-side and `search_documents` SHALL NOT be directly selectable from browser/PostgREST clients unless the same visibility policy is enforced at the database layer.

Add to `site-search/spec.md` scenarios:

- pending authenticated user does not receive members-only results
- anonymous suggestions do not expose gated titles
- direct REST selection of `search_documents` is denied or returns only rows allowed by the same policy
- endpoint responses include private/no-store cache headers

Add to `tasks.md`:

- Add RLS/privilege or equivalent direct-table-access protection.
- Add endpoint tests for anonymous, active member, admin, pending, suspended.
- Add a “no gated title leak through suggestions” test.

---

### 3. The synchronization model is fragile with current direct REST write paths

The design says to update `search_documents` “at content write/import boundaries” and explicitly chooses not to use triggers. That is risky in this codebase because content is modified from many places:

- inline admin editor PATCHes arbitrary tables/fields
- `resources.astro` posts/deletes resources directly
- `events.astro` posts events directly
- upload-resource function creates resources
- seed/import generation creates pages/sections/resources/events
- future agents may add content paths

It is easy for search to become stale.

**Recommendation**

Either:

1. **Prefer DB sync functions/triggers** for this change, or
2. Require every write path to go through a central server function that updates source + index transactionally.

For Kychon, triggers/functions are probably less overkill than manually wiring every direct REST mutation.

Suggested shape:

- `kychon_upsert_search_page(slug TEXT)`
- `kychon_upsert_search_resource(id INT)`
- `kychon_upsert_search_event(id INT)`
- optionally `kychon_upsert_search_announcement(id INT)`
- `kychon_reindex_search()` for repair/import/deploy
- triggers on `pages`, `sections`, `resources`, `events`, and maybe `announcements`

If triggers are rejected, the spec should explicitly list every write path that must call the sync helper.

**Change artifacts**

Modify `design.md` “Maintain the index…” decision. Either replace the no-trigger choice or add the central write-boundary requirement.

Add to `tasks.md`:

- Wire `AdminEditor` section/page edits.
- Wire resource direct post/delete and upload-resource function.
- Wire event create/delete/update.
- Wire generated seed/import post-pass.
- Add stale-index repair test.

Also remove/clarify “publish” language for resources/events unless the change is adding `published` columns to those tables.

---

## P1 — Important scope/design corrections

### 4. Resolve whether announcements/news are in v1

Pages/resources/events is close, but slightly under-scoped for association sites. Kychon’s announcements are the closest equivalent to Wild Apricot news/blog posts, and users will expect them to be searchable.

However, announcements currently need a stable URL target.

**Recommendation**

Include announcements in v1 **if** you add a stable target:

- `/announcement.html?id=123`, or
- homepage/listing anchors such as `/#announcement-123` with reliable rendering

If you do not want that extra URL work, explicitly make announcements a non-goal and say Wild Apricot blog/news parity is follow-up.

**Change artifacts**

In `design.md`, answer the open question:

> Announcements are included in v1 as source type `announcement`, with stable result URLs.

Or:

> Announcements are intentionally deferred because Kychon does not yet have stable announcement permalinks.

Update `site-search/spec.md`, `database-schema/spec.md`, and `tasks.md` consistently either way.

I would **not** include forum or member directory in this v1. Add them as explicit non-goals/follow-ups.

---

### 5. Tighten the `search_documents` schema contract

There is a mismatch around `source_id`: the spec example uses `source_id = 'about'`, but event/resource IDs are integers. Use a text key.

**Recommendation**

Use something like:

- `source_type TEXT NOT NULL CHECK (...)`
- `source_key TEXT NOT NULL`
- `UNIQUE (source_type, source_key)`

For pages, `source_key = slug`.
For resources/events/announcements, `source_key = id::text`.

Return a stable public identifier like `${source_type}:${source_key}`. Do not rely on the serial `id` as the stable result identifier, especially if reindex ever deletes/reinserts rows.

Also add a title-only vector for autosuggest:

- `title_vector TSVECTOR`
- `search_vector TSVECTOR` weighted title > body

**Change artifacts**

In `database-schema/spec.md`:

- Replace `source_id` with `source_key TEXT`, or explicitly state `source_id TEXT`.
- Add `title_vector` if autosuggest must be title-only.
- Clarify `search_vector` is generated or maintained automatically.
- Include all existing tables in the modified “Core tables” list; the current change omits existing `polls`, `poll_options`, `poll_votes`, and `reactions`.

Suggested source types if announcements are included:

```txt
page
resource
event
announcement
```

If not including announcements, do not mention it elsewhere.

---

### 6. PostgreSQL FTS approach is right, but needs precise behavior

Postgres FTS is the correct tool here. To make it predictable:

**Recommendation**

Use a simple, deterministic query plan:

- default text search config: probably `simple` for association names/acronyms/mixed content
- `websearch_to_tsquery` for normal searches
- fallback substring/prefix matching for short/simple terms
- title matches sort ahead of body-only matches
- deterministic secondary ordering

Example ordering intent:

```sql
ORDER BY
  title_match DESC,
  rank DESC,
  updated_at DESC,
  source_type ASC,
  source_key ASC
```

Autosuggest should use `title_vector` and/or prefix matching, because normal FTS will not suggest “Membership” for `mem` unless prefix behavior is implemented.

Snippets must be generated from plain text and rendered safely. If using `ts_headline`, avoid trusting raw HTML; use sentinel markers, escape the text, then replace markers with `<mark>`.

**Change artifacts**

Add to `site-search/spec.md`:

- empty/whitespace query returns no results, not an error
- `page_size` is capped
- snippets escape user/content HTML except allowed `<mark>`
- title match ranks above body match
- autosuggest supports prefix-like behavior after min chars

Add to `tasks.md` endpoint tests:

- XSS in title/body does not execute
- short query behavior
- page_size cap
- deterministic tie ordering

---

### 7. Resource/PDF handling is scoped correctly, but result URLs need care

Metadata-only resource indexing is the right v1. Do not add PDF extraction yet.

But clarify:

- filename label must be derived from the final path segment only
- strip query strings/tokens
- decode URL-encoded names safely
- do not expose raw storage URLs for members-only resources in search results
- resource result should link to a resource page/anchor or secure download endpoint

This aligns better with Wild Apricot behavior, where document-name matches often return the page that links to the document rather than the file body as an independent result.

**Change artifacts**

Add to `site-search/spec.md` scenarios:

- filename query string is not indexed
- members-only resource result URL is not a raw public file URL
- public resource filename label is searchable

Add to `tasks.md`:

- add `id="resource-<id>"` anchors or a resource detail route if search results link to resource cards
- add tests for safe filename extraction

---

### 8. Autosuggest is acceptable if explicitly progressive enhancement

Autosuggest is not required to match Wild Apricot, but it is a nice modern improvement. Keep it lightweight and do not let it delay the secure endpoint/results page.

**Recommendation**

Make it progressive:

- normal form submit works without JS
- debounce 150–250ms
- min query length 2 or 3
- AbortController cancels stale requests
- max 5 suggestions
- no persistent localStorage caching of suggestions
- ARIA combobox/listbox behavior
- keyboard selection, Escape close, pointer selection
- same visibility rules as full search

**Change artifacts**

In `site-search/spec.md`, expand autosuggest requirement with accessibility/no-JS scenarios.

In `tasks.md` 5.3, explicitly mention:

- debounce
- min chars
- abort stale request
- ARIA combobox/listbox
- no-JS fallback

---

## P2 — UX/import/artifact polish

### 9. Search results UX should define facets/counts and empty-query state

The results page requirement is good but should be slightly more explicit.

**Recommendation**

Endpoint response should include:

```ts
{
  query: string,
  type: 'all' | 'pages' | 'resources' | 'events' | 'announcements',
  page: number,
  page_size: number,
  total: number,
  has_next: boolean,
  facets?: {
    all: number,
    pages: number,
    resources: number,
    events: number,
    announcements?: number
  },
  results: [...]
}
```

Facet counts should be for **visible results only**. Do not reveal “hidden members-only result counts” to anonymous visitors.

Add:

- loading state
- no-query state
- no-results state
- mobile-friendly filters
- `<meta name="robots" content="noindex,follow">` on `/search.html`
- i18n keys for default labels/placeholders/result type names

---

### 10. Clarify `type` vs `types`

The block config says “source-filter defaults” plural, but the endpoint accepts `type` singular.

**Recommendation**

Pick one.

For v1, I recommend singular:

```txt
type=all|pages|resources|events|announcements
```

If a Wild Apricot bitmask maps to multiple native types, map it to `all` unless it maps exactly to one supported type.

**Change artifacts**

Update `site-search/spec.md` and `tasks.md` to say `default_type`, not plural `source-filter defaults`, unless you intentionally support comma-separated multi-type filters.

---

### 11. Wild Apricot import mapping needs a concrete mapping table

The import requirement is correct, but the spec should define how bitmasks map.

**Recommendation**

Add a small mapping table to `design.md`, for example:

```txt
WA pages bit      -> Kychon pages
WA blog/news bit  -> Kychon announcements, or pages if blogs were imported as pages
WA forum bit      -> unsupported in v1; ignored or mapped to all with warning
WA all/7/missing  -> all
unknown bits      -> all, with importer warning
```

Also require the importer to:

- detect absolute and relative `/Sys/Search` and `/Sys/Search/DoSearch`
- convert POST/source-domain forms to native GET `/search.html`
- preserve placeholder/button label
- remove WA hidden parameters from emitted native URLs
- ensure no copied output still points at the source domain

**Change artifacts**

Add import fixture tests for:

- absolute `https://source.example/Sys/Search`
- relative `/Sys/Search`
- custom placeholder/button
- hidden WA `types`
- no remaining `/Sys/Search` in emitted HTML/sections

Also name the actual importer module/script in `tasks.md`; otherwise task 6 is hard to implement unambiguously.

---

## Specific artifact edits before implementation

### `proposal.md`

Add:

- page documents include visible `sections`
- search endpoint is a Run402 server function, not direct PostgREST table access
- `search_documents` direct browser access must be denied or visibility-policy protected
- resource search never exposes raw gated file URLs
- announcements decision: included or explicitly deferred
- member directory/forum/translation-aware search non-goals for v1

### `design.md`

Change/clarify:

- Replace “pages” with “page documents generated from `pages` + `sections`.”
- Revise index-maintenance decision: use DB triggers/sync functions or require central write API.
- Remove or clarify the claim that importers can use `search_documents` as a stable target for unmapped content. For v1, importers should create native pages/sections/resources/events and run reindex.
- Resolve all three open questions before implementation.

### `specs/site-search/spec.md`

Add requirements/scenarios for:

- section-derived page text
- active-member-only visibility
- direct table access protection
- private/no-store cache headers
- XSS-safe snippets
- empty query/page-size cap
- resource safe URL/filename behavior
- autosuggest accessibility/debounce/min-chars
- announcements if included

### `specs/database-schema/spec.md`

Fix:

- `source_id` ambiguity: use `source_key TEXT` or explicitly `source_id TEXT`
- include `title_vector` if title-only autosuggest is required
- preserve existing table list: polls and reactions should not disappear from the modified core table requirement
- source type constraint should match final v1 sources
- stable result identifier should be source tuple, not serial id

### `tasks.md`

Add:

- section text extraction and sync
- direct-table/RLS/privilege protection task
- active-member visibility tests
- post-seed/post-import reindex or trigger-based sync
- resource safe URL/filename tests
- XSS snippet tests
- WA import “no `/Sys/Search` remains” test

Remove/clarify:

- “event publish” and “resource publish” tasks unless adding those columns
- plural source-filter language unless supporting multi-type filters

Overall: with these revisions, the feature will match the useful part of Wild Apricot search, feel native in Kychon, and avoid the two biggest risks: stale indexes and gated-content leakage.

---
**Wall time**: 11m 15s
**Tokens**: 95,944 input, 13,030 output (13,030 reasoning), 108,974 total
**Estimated cost**: $5.2237
