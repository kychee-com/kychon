## Context

After [composable-layout](../composable-layout/proposal.md) lands, the `BLOCK_TYPES` registry in `src/lib/blocks.ts` is the only surface that needs extending to add new visible block types. Each entry follows a stable contract:

```ts
interface BlockType {
  render: (section: Section, ctx: BlockRenderContext) => string;
  defaultConfig: Record<string, unknown>;
  label: string;
  icon: string;
  dynamic: boolean;
  zoneHints?: ('header' | 'main' | 'footer')[];
}
```

This change adds six entries. Five are config-static (the renderer takes `section.config` and emits HTML); two are `dynamic: true` (events_list and link_list-in-resources-mode hydrate from API after bake skeleton).

Constraints driving this design:
- Renderers must work in both bake (Node) and hydrate (browser) — same string-returning contract as every existing block type.
- Slideshow needs runtime JS for rotation, but the JS must not block first paint and must respect `prefers-reduced-motion`. The bake produces visible static content (first slide); JS layers in rotation when ready.
- Events_list and link_list-resources read from other tables. They follow the existing `dynamic: true` pattern: bake emits a skeleton, runtime hydrator fetches and replaces.
- Page_banner is the first systematic use of `scope='page', zone='header'` block scoping. It validates that composable-layout's substrate handles per-page chrome correctly.
- Block configs are JSONB. PostgREST PATCH replaces the column. `data-editable-config` snapshots already handle this for the existing types; the new types use the same pattern.

## Goals / Non-Goals

**Goals:**
- Each new block type is fully usable through the existing block-type picker, drag-reorder, and edit popover. No new admin infrastructure.
- Each block type ships with a typed `defaultConfig` that's a working starting point.
- The ODBC port re-render after this change shows promo cards, events list, slideshow, link list (news updates), tagline strip, and per-page banners — all from the source's actual content.
- Each block type has at least one demo using it so the live demo sites exercise the new code path on every deploy.
- Test coverage: each block type has a unit test for `render()` shape + at least one integration test for admin editing flow.

**Non-Goals:**
- Side-by-side block layouts within a zone. Tracked separately as G_GRID; every block in this proposal renders correctly stacked.
- Block-type plugins. The registry is a TS module; extending requires a code change.
- Animation libraries. Slideshow uses native CSS transitions and `setInterval`. No GSAP, no Swiper, no Framer Motion.
- Multi-source aggregation in link_list. The two source modes (`manual` and `resources`) are separate; you don't pull from both.

## Decisions

### 1. Bundling versus splitting per block type

**Decision**: One change covering six block types, internally phased per type. Each phase is independently deployable; a partial landing (say, four of six) leaves the substrate in a working state.

**Why**: Same renderer contract, same registry surface, same pattern repeated six times. Splitting into six proposals would generate six near-identical sets of artifacts. The exception is `embed` (#59), which has a security envelope justifying its own proposal — split there, bundle here.

**Phasing**: tasks are ordered shortest first (`tagline_strip` → `page_banner` → `link_list` → `promo_cards` → `events_list` → `slideshow`) so the simplest types validate the pattern early and complexity ramps up. Each phase's work is independent within `BLOCK_TYPES`.

### 2. The renderer pattern for static blocks

**Decision**: Each non-dynamic block's `render(section, ctx)` is a pure function that takes config and returns an HTML string built from template literals. No runtime mutation needed beyond admin-editing data attributes.

```ts
BLOCK_TYPES.tagline_strip = {
  render: (section, ctx) => {
    const c = section.config;
    const cls = `block-tagline-strip block-tagline-strip--${c.color_scheme ?? 'primary'} block-tagline-strip--${c.size ?? 'medium'}`;
    const editAttrs = ctx.admin
      ? ` data-editable="sections.${section.id}.config.text"`
      : '';
    return `<section class="${cls}"><div class="container">${c.icon ? renderIcon(c.icon) : ''}<p${editAttrs}>${esc(c.text ?? '')}</p></div></section>`;
  },
  defaultConfig: { text: 'Your tagline here', color_scheme: 'primary', size: 'medium', alignment: 'center' },
  label: 'Tagline Strip',
  icon: 'quote',
  dynamic: false,
  zoneHints: ['main'],
};
```

**Why string templates and not JSX/h() functions**: composable-layout already established string renderers as the contract. JSX would require a renderer at build AND runtime, with mode-specific imports. Strings are universal. The downside is no compile-time HTML correctness — mitigated by tests against the rendered output.

### 3. Dynamic blocks: `events_list` and `link_list` (resources mode)

**Decision**: Bake renders a skeleton with `data-block-hydrate="events_list"` and config attributes embedded. Runtime hydrator fetches data, replaces the skeleton's contents, binds any handlers.

```ts
// Bake side
render: (section, ctx) => {
  const c = section.config;
  return `<section class="block-events-list" data-block-hydrate="events_list"
            data-config='${escAttr(JSON.stringify(c))}'>
    <h2>${esc(c.heading ?? 'Upcoming Events')}</h2>
    <div class="block-events-list__skeleton">
      ${'<div class="event-skeleton-card"></div>'.repeat(c.count ?? 4)}
    </div>
  </section>`;
}

// Runtime side
async function hydrateEventsList(el: HTMLElement) {
  const c = JSON.parse(el.dataset.config!);
  const events = await fetchEvents(c.filter, c.count);
  el.innerHTML = renderEventsListContent(c, events);
}
```

**Why embed config in `data-config`**: the renderer needs the config at hydrate time (which layout? which filter?). Re-fetching the section row to get config is wasteful when bake already had it. JSON-encode into a data attribute, parse at hydrate.

**Idempotent hydration**: hydrators check `el.dataset.hydrated === 'true'` and bail out. Re-running on `astro:after-swap` is safe.

### 4. Slideshow JS approach

**Decision**: ~4kB of vanilla JS, inlined into the page (not a separate fetch), feature-gated by the presence of any `[data-block-hydrate="slideshow"]` element on the page.

Behavior:
- Auto-rotate every `auto_rotate_seconds` seconds via `setInterval`.
- Pause when:
  - Mouse hovers the slideshow (`mouseenter`)
  - Any element inside has `:focus-within`
  - `document.visibilityState !== 'visible'` (tab backgrounded)
- Resume when:
  - Mouse leaves AND nothing inside is focused AND tab is visible
- Disable rotation entirely when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
- Arrow keys navigate when slideshow has focus.
- Dots are buttons with `aria-label="Slide N of M"`. The active dot has `aria-current="true"`.
- A live region (`aria-live="polite"`) announces the active slide's caption when it changes.

**Why no library**: 4kB of bespoke code is smaller than any slideshow library's minimal bundle (Swiper is ~30kB minified). The behavior is simple. The cost of bespoke is a few extra tests; the win is no third-party dep.

**Lazy-loading**: first slide gets `loading="eager"` (visible above fold). Slides 2+ get `loading="lazy"`. The slideshow does NOT preload all images; the browser fetches the next slide as it scrolls into the viewport (the slideshow tracks intersection with `IntersectionObserver` on each `<img>`).

### 5. `promo_cards` layout

**Decision**: CSS Grid with `grid-template-columns: repeat(var(--cols), 1fr)`. The `columns` config maps to a CSS custom property on the section: `style="--cols: 4"`. Mobile breakpoints override:

```css
.block-promo-cards { grid-template-columns: repeat(var(--cols), 1fr); }
@media (max-width: 1024px) { .block-promo-cards { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px)  { .block-promo-cards { grid-template-columns: 1fr; } }
```

Each card is `<a class="promo-card" href={cta_href}>` — the entire card is the link. Inside: `<div class="promo-card__image" style="background-image: url(...)" data-overlay={overlay_color}>` (image as background for cropping control), `<h3 class="promo-card__title" data-position={title_position}>` (positioned via CSS based on `data-position`), and `<span class="promo-card__cta">{cta_text}</span>` (visual reinforcement, not a separate `<a>`).

**Why background-image and not `<img>`**: easier to crop to card aspect (overlay positioning is simpler over a uniform background). Trade-off: no `alt` text on the image directly. Mitigation: the card's `<a>` wraps an accessible-name string built from the title — screen readers announce "Membership, Click Here to Learn More" or similar.

**Why required `image_alt`**: even with background-image, the alt is preserved in `aria-label` on the card link. Build-time warning if missing.

### 6. `link_list` dual-source

**Decision**: Static config has `source: 'manual' | 'resources'`. When `manual`, items are config-embedded. When `resources`, the renderer reads `filter.category` and `filter.limit` from config; the hydrator fetches from `resources?category=eq.{category}&order={order}&limit={limit}` and renders the response.

The block is `dynamic: true` only when `source === 'resources'`. This is a per-block-instance dynamic flag (not a registry-level one) — handled by the renderer outputting either complete HTML (manual) or a hydration skeleton (resources).

**Why this hybrid**: data-bound mode covers the "auto-update from leadership uploads" use case without requiring admins to re-curate the block. Manual mode covers "this week's curated headlines." Both belong in one block type because the visual output is identical — the only difference is the source.

### 7. `page_banner` and per-page chrome

**Decision**: `page_banner` is a block type with `zoneHints: ['header']` and `defaultConfig: { ... scope: 'page' }` (the picker auto-sets scope to 'page' when adding a page_banner from a non-home page).

Renderer:
- Emits `<section class="block-page-banner" style="height: var(--banner-height-{height})">` with the image as background.
- Optional `overlay_color` darkens the image.
- `caption_html` is sanitized (same allowlist as hero foreground caption) and rendered inside a centered div.

When the page-level hydrate flow runs, the global header chrome (brand, nav, sign-in bar) renders first; the `page_banner` block (page-scoped, `zone='header'`) renders below it but before main content. Per composable-layout's per-page chrome override semantics, page-scoped blocks in the same zone come AFTER global blocks in render order, so a banner appears between the global nav and the main content — exactly the right place.

**Why not modify the `pages` table**: parallel data path that does what `sections` already does. Composable-layout's whole point is "every block is a row in `sections`." Adding columns to `pages` for banners would split the block model in two.

### 8. Block icons in the picker

**Decision**: Each block type registers an `icon` field (string). The picker renders the icon via the existing `featureIcon()` helper (or its successor in the new registry's helper module).

Icons chosen:
- `tagline_strip`: `quote` (or `'❦'`) — a curly quotation/decorative mark
- `page_banner`: `image-plus` — banner-style with overlay
- `link_list`: `list` — bulleted list icon
- `promo_cards`: `grid-2x2` — 4-up grid
- `events_list`: `calendar`
- `slideshow`: `images` — stacked photos icon

These are emoji or simple Unicode chars; no icon library dep.

## Risks / Trade-offs

### A. Block-type proliferation in the picker

After this change, the picker shows 17+ types (10 existing + 6 new + 5 footer types from composable-layout). Trade-off: increased visual noise versus full coverage. Mitigation: the picker filters by `zoneHints` — adding to a header zone shows only header-eligible types; same for footer. The main zone shows the most.

### B. `events_list` filter `featured` requires a column on `events`

The `is_featured` column doesn't exist today. Trade-off: this proposal adds the column to `events` if and only if anyone configures `filter: 'featured'` — defer until needed. v1 ships without it; the picker omits 'featured' as an option until the column lands. Tracking: a lightweight schema migration ships in this change ONLY if a demo or test needs it; otherwise it's a follow-up.

**Resolution**: skip `featured` in v1. Add when first project needs it.

### C. Slideshow's vanilla JS edge cases

`setInterval` in long-lived SPAs leaks if the slideshow is removed without clearing the interval. Mitigation: hydrator stores the interval handle on `el.dataset.intervalId`; AdminEditor's `wl-content-rendered` and `astro:before-swap` events trigger cleanup that clears intervals on outgoing slideshows.

### D. `page_banner` interacts with hero foreground (#53)

Both can render at the top of a page. If a page has both a `page_banner` (in `zone='header', scope='page'`) and a `hero` (in `zone='main'`), the banner appears first, then the hero. That's usually wrong for a home page (you'd want one or the other). Mitigation: documentation note — use page_banner for interior pages; use hero for the home page. The admin can drag/delete to fix overlap.

### E. CSS bundle growth

Six new block types add ~3kB CSS. Acceptable. If the CSS file approaches 100kB, split per-block CSS files loaded conditionally.

### F. Empty-state UX consistency

Each dynamic block needs an empty-state pattern. Decisions:
- `events_list`: show an inline message ("No upcoming events").
- `link_list` (resources): hide the section entirely when zero items (avoids "News Updates" header with no list).
- `slideshow`: hide the section when no items configured.

These are deliberate per-block choices — a single empty-state strategy doesn't fit all.

## Migration / Rollout

This is purely additive on top of composable-layout. Each phase is deployable in isolation:

1. Phase 1 lands `tagline_strip`. Validates the pattern. Smallest possible block.
2. Phase 2 lands `page_banner`. Validates per-page chrome scoping.
3. Phase 3 lands `link_list` (manual + resources). Validates dual-source pattern.
4. Phase 4 lands `promo_cards`. Validates image-heavy block + admin upload integration.
5. Phase 5 lands `events_list`. Validates dynamic + multi-layout.
6. Phase 6 lands `slideshow`. Validates runtime JS + a11y.
7. Phase 7 re-runs ODBC port and visually verifies the new types render the source patterns faithfully.

Demos pick up new types incrementally as they land.
