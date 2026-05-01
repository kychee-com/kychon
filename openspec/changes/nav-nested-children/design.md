## Context

After [composable-layout](../composable-layout/proposal.md), navigation is rendered by the `nav` block in `src/lib/blocks.ts`. Today its `config.items` is a flat array of `{ label, href, icon, public, auth, feature, admin }`. This change adds an optional recursive `children: NavItem[]` field to that schema.

Constraints:
- The renderer must work in both bake (Node, build-time) and hydrate (browser) contexts; same `renderBlock(section, ctx): string` contract.
- The dropdown must be operable via mouse, keyboard, touch, and screen reader, satisfying WCAG 2.1 AA. The standard ARIA pattern for menu buttons + menus applies.
- Existing flat nav configs must continue to work unchanged. This is purely additive at the data layer.
- The mobile experience uses the existing hamburger; nested items must expand inline rather than fly out, to match small-screen interaction conventions.
- The block is rendered once per page and persists across SPA transitions via Astro's `transition:persist` (per composable-layout). Event handlers attach idempotently — re-binding on `astro:after-swap` must not double-bind.

## Goals / Non-Goals

**Goals:**
- Two-level minimum nesting (parent → children → optionally grandchildren).
- Hover-open on pointer + focus-open on keyboard, with full keyboard navigation inside open menus.
- Inline expansion on mobile.
- Editor popover supports adding/removing/reordering children with the same drag UX as top-level items.
- Idempotent runtime binding so SPA navigation doesn't break the menu.

**Non-Goals:**
- Mega-menus (multi-column dropdowns with rich content). Out of scope; keep dropdowns to a single column of links.
- Click-to-open on desktop (every nav menu in this codebase uses hover-open; `aria-haspopup="menu"` + chevron click are sufficient affordances).
- Animation choreography. A simple fade-in / slide-down (200ms) is enough; bounce/spring animations are not.
- Per-item icons inside dropdowns. Top-level items keep their icons; child items are text-only for visual hierarchy.

## Decisions

### 1. The schema extension

**Decision**: Extend the `NavItem` type in `src/lib/blocks.ts`:

```ts
interface NavItem {
  label: string;
  href?: string;
  icon?: string;
  public?: boolean;
  auth?: boolean;
  feature?: string;
  admin?: boolean;
  children?: NavItem[];   // NEW
}
```

Rules:
- If `children` is present and non-empty, the item is a parent.
- If `href` and `children` are both present, the parent is a navigable link AND a dropdown trigger.
- If only `children` is present, the parent is purely a trigger (`<button>`, no navigation).
- Children inherit no defaults — each is independent and may itself carry `children`.

**Why**: matches the issue's proposed config shape without schema migration. Recursion is natural; depth is implicit.

### 2. ARIA pattern: disclosure-button + menu

**Decision**: Use the disclosure-button pattern (`button[aria-haspopup="menu"][aria-expanded="false|true"]` + `ul[role="menu"]`), not the menubar pattern.

```html
<a class="nav-link" href="/marina">Marina</a>
<button class="nav-chevron-toggle" aria-haspopup="menu" aria-expanded="false" aria-controls="nav-menu-marina">▾</button>
<ul class="nav-dropdown" role="menu" id="nav-menu-marina" hidden>
  <li role="none"><a role="menuitem" href="/marina/layout">Marina Layout</a></li>
  <li role="none"><a role="menuitem" href="/marina/howto">How-To Guide</a></li>
</ul>
```

**Why disclosure over menubar**: site nav with submenus is the standard disclosure pattern (per WAI-ARIA Authoring Practices, "Disclosure (Show/Hide)" section). Menubar implies app-style cursor management that isn't appropriate for a website nav. Screen readers handle disclosure correctly without requiring users to enter "menu mode."

**Why `role="menu"` and not `role="navigation"` for the dropdown**: the dropdown specifically holds menuitems triggered by a menu button. The outer `<nav>` already has `aria-label="Primary navigation"`; the dropdown is a menu inside that nav.

### 3. Top-level with both `href` and `children`: split affordances

**Decision**: When an item has both `href` and `children`, render two separate elements: an `<a>` for the link, a `<button>` chevron for the menu trigger.

**Why**: collapsing them into a single click target forces a choice (does click navigate or open menu?) that's bad either way. Splitting them mirrors the macOS Finder pattern (file row + disclosure triangle) and works on every input modality.

**Hit targets**: chevron button minimum 32x32px; `<a>` link absorbs the rest of the row's hover area. CSS keeps them visually grouped.

### 4. Hover for pointer, focus for keyboard

**Decision**: CSS handles hover-open behind a `@media (hover: hover) and (pointer: fine)` query. JS handles focus-open and click-on-chevron for both modalities.

```css
@media (hover: hover) and (pointer: fine) {
  .nav-parent:hover + .nav-chevron-toggle + .nav-dropdown,
  .nav-parent:focus + .nav-chevron-toggle + .nav-dropdown,
  .nav-chevron-toggle:hover + .nav-dropdown,
  .nav-chevron-toggle:focus + .nav-dropdown,
  .nav-dropdown:hover { display: block; }
}
```

The `.nav-dropdown:hover` rule keeps the dropdown open while the cursor is inside it (otherwise it closes the moment the cursor leaves the parent's bounding box).

JS layer (loaded for everyone, ~3kB):
- Listens to focusin/focusout on the parent + dropdown to set `aria-expanded` and toggle `[hidden]`
- Listens to `click` on the chevron to toggle the dropdown
- Listens to keydown for arrow/Escape/Enter handling

**Why this split**: CSS hover-open is instant, has no JS dependency, and degrades gracefully if JS hasn't loaded. JS focus-open ensures keyboard parity. The two layers don't fight because each updates `aria-expanded` and `[hidden]` consistently.

### 5. Keyboard navigation matrix

**Decision**: standard menu-button keyboard model.

| Key | When focus is on… | Behavior |
|---|---|---|
| `↓` (Down) | Top-level chevron | Open menu, focus first item |
| `↑` (Up) | Top-level chevron | Open menu, focus last item |
| `↓` | Menu item | Move focus to next item; wrap |
| `↑` | Menu item | Move focus to previous item; wrap |
| `Enter` / `Space` | Menu item | Activate item (navigate to its href) |
| `Enter` / `Space` | Chevron | Toggle menu open/closed |
| `Escape` | Inside menu | Close menu, focus trigger |
| `Tab` | Inside menu | Close menu, advance focus to next top-level item |
| `Shift+Tab` | Inside menu | Close menu, retreat focus to previous top-level item |

**Why these specific behaviors**: matches the WAI-ARIA Authoring Practices `menu-button` pattern. The Tab → close-and-advance behavior is what users expect from site nav (vs. trapping inside menu indefinitely).

### 6. Click-outside dismissal

**Decision**: Single document-level click handler attached on first nav block hydration:

```ts
document.addEventListener('click', (e) => {
  document.querySelectorAll('.nav-dropdown:not([hidden])').forEach((dropdown) => {
    if (!dropdown.contains(e.target) && !dropdown.previousElementSibling?.contains(e.target)) {
      closeDropdown(dropdown);
    }
  });
});
```

Idempotent: if the handler is already attached (`window.__navDropdownClickHandler === true`), the second hydration skips re-attachment.

**Why document-level**: simpler than tracking per-dropdown listeners. The handler is cheap (a single `querySelectorAll` per click), runs only when at least one dropdown is open in practice (the for-each is a no-op otherwise).

### 7. Mobile (no hover)

**Decision**: Under `@media (hover: none)` or `@media (max-width: 768px)`, dropdowns become inline accordions:

- `.nav-parent` and `.nav-chevron-toggle` collapse into a single full-width row tap target.
- Tapping the parent (anywhere on the row) toggles `aria-expanded` and reveals/hides the dropdown inline below it (no absolute positioning).
- Children indent 1.5rem to indicate hierarchy.
- Chevron rotates 180° via CSS transform when expanded.
- The mobile menu container (the existing hamburger flyout) handles vertical scroll if the menu exceeds viewport height.

**Why**: hover-fly-out is unusable on touch. Inline expansion matches every modern site's mobile nav pattern.

### 8. Editor UX in `NavEditor` popover

**Decision**: The nav block edit popover (from composable-layout's "edit popover replaces site_config nav editor" decision) gets:

- An "Add child" button per row, rendering child rows indented 1.5rem under their parent.
- Children are draggable using the existing sortable engine, scoped to their parent's children array.
- Children can be added recursively (a child can itself have children, indented 3rem).
- Removing a parent with children prompts: "Remove this item and its 4 children?" before deletion.
- The visual hierarchy uses indentation + a vertical guide line on the left of children groups.

**Why**: the popover already handles the flat case via the sortable engine. Adding children is a recursive UI extension, not a redesign — same row template, same handlers, scoped to a different array.

### 9. Idempotent runtime binding

**Decision**: All event handler attachment in the nav renderer's hydrator follows the existing pattern:

```ts
function bindNavBlock(blockEl: HTMLElement) {
  if (blockEl.dataset.navBound === 'true') return;
  blockEl.dataset.navBound = 'true';
  // … attach handlers
}
```

Re-binding triggered by `astro:after-swap` or `wl-content-rendered` events is safe and has no side effects.

**Why**: same pattern used by AdminEditor and other modules. Avoids double-binding without a global registry.

## Risks / Trade-offs

### A. Hover-open dropdowns close when the cursor crosses a gap

If there's any vertical space between the parent and its dropdown, the cursor leaving the parent before reaching the dropdown closes it. Mitigation: zero gap, with the dropdown directly attached to the parent's bottom edge. Slight visual trade-off (tight) but standard UX.

### B. Two-element split for parent-with-href is visually busier

A row with both `<a>` and chevron `<button>` looks more crowded than today's flat nav. Mitigation: chevron is small (12px), low-contrast, separated by 4px from the link.

### C. Mobile inline expansion competes with the hamburger menu's existing scroll

The mobile menu is already a vertical list inside a flyout. Adding nested expansion increases scroll length. Mitigation: cap mobile menu height at `100vh` with `overflow-y: auto` (already in place); accept that deeply-nested mobile menus require scrolling.

### D. JS-disabled fallback

If JS doesn't run, hover-open via CSS still works on desktop, but keyboard users lose dropdown access. Mitigation: progressive enhancement — render `[hidden]` attribute server-side via the bake; CSS removes hidden in hover/focus. Without JS, focus management is limited but core flat nav still works.

## Migration / Rollout

This change is purely additive — the renderer treats `children: undefined` and `children: []` identically to today's flat behavior. We can ship the renderer change, deploy, and adopt nested nav per-demo at our pace.

1. Renderer + CSS land first.
2. Editor popover updated to support adding children.
3. One demo gains a nested nav config (e.g. silver-pines's "Resources" item gets sub-items: "Documents", "Forms", "Calendar"); deploy and visually verify on real device.
4. Documentation updated.
5. ODBC port re-runnable with nested nav (parallel with composable-layout's Phase 7 ODBC verification — this change unlocks the second half of that test).
