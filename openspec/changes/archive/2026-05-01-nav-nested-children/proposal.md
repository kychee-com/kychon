## Why

ODBC's source site at [olddominionboatclub.com](https://www.olddominionboatclub.com/) — and most Wild Apricot member-org sites — use cascading hover dropdowns in the header. Hovering `MARINA ▸` reveals four sub-items (Marina Layout, How-To Guide, M&B Application, Transient Dockage). The Kychon port at `odbc-port.run402.com` flattens this into 12+ top-level nav items because today's `nav` block (post-`composable-layout`) renders `config.items` as a flat list. Without nested nav, any port of a multi-section club site looks visibly degraded.

This change extends the `nav` block introduced by [composable-layout](../composable-layout/proposal.md) to support a recursive `children: [...]` array on each item, renders the result as a hover dropdown with full keyboard a11y on desktop, and degrades to inline expansion under the existing hamburger toggle on mobile.

Closes [#52 nav: nested children with hover dropdowns + keyboard a11y](https://github.com/kychee-com/kychon/issues/52).

## What Changes

- **Schema-free.** Nothing changes in the database. The `nav` block's `config.items` array gains an optional `children: NavItem[]` field per item. Existing flat configs keep working unchanged.
- **Renderer.** `BLOCK_TYPES.nav.render` in `src/lib/blocks.ts` emits a top-level item with children as `<button class="nav-link nav-parent" aria-haspopup="menu" aria-expanded="false">{label} <span class="nav-chevron">▾</span></button>` followed by `<ul class="nav-dropdown" role="menu" hidden>` containing each child as `<li role="none"><a role="menuitem" href={child.href}>{child.label}</a></li>`. Recursive — children can themselves have children, supported at least two levels deep.
- **Top-level item with both `href` and `children`.** The parent renders as a `<a>` link to `href`; a sibling `<button class="nav-chevron-toggle" aria-haspopup="menu">▾</button>` opens the dropdown. The link navigates; the chevron toggles the menu.
- **Hover behavior on pointer devices.** A media query `@media (hover: hover) and (pointer: fine)` enables CSS-driven hover-open: `.nav-parent:hover ~ .nav-dropdown, .nav-parent:focus ~ .nav-dropdown { display: block }` — augmented by JS for keyboard parity (focus opens, blur with no focus inside closes).
- **Keyboard navigation.** Arrow keys (↓/↑) navigate items inside an open menu, Enter activates the focused item, Escape closes the menu and returns focus to the trigger, Tab moves to the next top-level item (closing the current dropdown). Focus is trapped inside the open menu while it's open.
- **Click-outside dismissal.** A single `document.addEventListener('click', …)` in the nav block's runtime handler closes any open dropdown when the click target isn't inside it.
- **Mobile (no hover).** Under the existing `.nav-toggle` hamburger, dropdowns expand inline (vertical accordion) instead of hovering. The chevron rotates 180° to indicate expansion. Tapping the parent toggles its children's visibility; tapping a leaf navigates and closes the menu.
- **`NavEditor` popover.** The block edit popover (introduced by composable-layout's nav-as-block) gains a "Add child" button per row. Children render as indented sub-rows beneath their parent, themselves draggable for reorder and editable for label/href. Removing a parent removes its entire subtree (with confirmation if children are present).
- **Storybook + a11y test.** A new test verifies NVDA + VoiceOver announce the parent's role (`button`), `aria-expanded` state, and the menu's `role="menu"`. Programmatic test confirms keyboard arrow-key navigation lands on the right items.

## Capabilities

### Modified Capabilities

- `composable-layout`: extends the `nav` block-type to render nested children with full a11y, hover/focus opening on pointer devices, inline expansion on mobile, and keyboard navigation.

## Impact

- **New files**: none. Possible new CSS file `public/css/nav-dropdown.css` (~2kB) loaded alongside existing nav styles.
- **Modified files**: `src/lib/blocks.ts` (extend `nav` renderer), `src/components/AdminEditor.astro` (nested children UI in nav popover), `public/css/styles.css` or new `nav-dropdown.css`, `tests/blocks-nav.test.ts` (a11y + keyboard tests).
- **Dependencies**: none new. Standard ARIA patterns + HTML5 keyboard handlers.
- **Bundle impact**: ~3kB extra JS for keyboard handling and click-outside, ~2kB extra CSS for the dropdown chrome. Loaded for everyone (the dropdown is member-facing, not admin-only).
- **Demo update**: Optionally update silver-pines or eagles seed to demonstrate nested nav, so the feature is visible without re-running the ODBC port.
- **Hard dep**: ships only after [composable-layout](../composable-layout/proposal.md) lands. The `nav` block must exist as the storage and render path before this change can extend it.
