## Tasks

### Phase 1: Renderer + CSS

- [x] **1.1 Extend `NavItem` type with optional recursive `children`**
  Add `children?: NavItem[]` to the `NavItem` interface in `src/lib/blocks.ts`. No schema migration needed.

- [x] **1.2 Update `BLOCK_TYPES.nav.render` to emit dropdown HTML for items with children**
  Render top-level items per the disclosure-button pattern: `<a class="nav-link">label</a>` (if `href`), `<button class="nav-chevron-toggle" aria-haspopup="menu" aria-expanded="false" aria-controls="...">▾</button>`, `<ul class="nav-dropdown" role="menu" hidden>` containing children. Recursively handle children-of-children. Generate stable `aria-controls` IDs from item label + position.

- [x] **1.3 CSS: hover-open behind pointer media query**
  New `public/css/nav-dropdown.css` (or extend `styles.css`). Inside `@media (hover: hover) and (pointer: fine)`: open dropdown on parent hover/focus, dropdown hover, and chevron hover/focus. Outside that query: dropdown is hidden by default; expanded only when `aria-expanded="true"`. Add fade-in/slide-down 150ms transition.

- [x] **1.4 Mobile inline expansion**
  Under `@media (hover: none) or (max-width: 768px)`: dropdown is `display: block` only when `aria-expanded="true"`, indented 1.5rem, no absolute positioning, no fly-out. Chevron rotates 180° via `transform` when expanded. Tap target = full row.

### Phase 2: Keyboard a11y + click-outside

- [x] **2.1 Hydrator: focus-open + chevron-click + state sync**
  In the nav block's runtime hydrator (`bindNavDropdowns` in `src/lib/nav-dropdown.ts`): bind `click` on chevron to toggle `aria-expanded` and `[hidden]`. Bind `focusout` on the parent + dropdown subtree to keep `aria-expanded` consistent (close when focus exits the subtree). Per WAI-ARIA menu-button pattern, focus alone does not auto-open — only ↓/↑/Enter/Space on the trigger does.

- [x] **2.2 Keyboard handlers for inside-menu navigation**
  On menu open: focus first item. Bind `keydown` on the dropdown: `↓` next item (wrap), `↑` previous item (wrap), `Enter`/`Space` activate, `Escape` close + return focus to chevron, `Tab`/`Shift+Tab` close + advance/retreat to next/prev top-level item. `Home`/`End` jump to first/last.

- [x] **2.3 Document-level click-outside handler (idempotent)**
  Single `document.addEventListener('click', ...)` attached once (guarded by `window.__navDropdownClickBound`). Closes any open `.nav-dropdown` whose subtree doesn't contain the click target.

- [x] **2.4 Idempotent re-binding on `astro:after-swap`**
  `bindNavDropdowns` checks per-element flags (`dataset.navBound`, `dataset.chevronBound`, `dataset.navHoverWrapBound`); each handler bails out if already bound. Re-runs harmlessly on `astro:after-swap` and `wl-content-rendered`. Confirmed safe across SPA navigations.

### Phase 3: Editor popover supports children

- [x] **3.1 `NavEditor` popover: nested rows**
  In the nav block edit popover (`src/components/AdminEditor.astro`): render children as indented sub-rows. "+ child" button per row creates a new child item with empty defaults. Removing a parent with children prompts confirmation: `"Remove this item and its N children?"`.

- [x] **3.2 Drag-reorder within children scope**
  The drag handler now uses dotted paths (`0.children.2`) so children form a sibling group scoped to their parent's `children` array. Dragover only accepts drops with matching `parentPath`, so a child cannot be dragged across parent scopes in v1. Cross-level drag is a follow-up.

- [x] **3.3 Visual hierarchy in popover**
  Children indent 1.5rem per depth via inline `margin-left`; vertical guide line on their left edge (`.admin-nav-guide`). Grandchildren indent another 1.5rem. Beyond depth 2, a row warning is shown: "Nested deeper than 2 levels — may not render well on mobile". Deeper nesting still saves to DB.

### Phase 4: Tests + demo

- [x] **4.1 Renderer unit tests**
  `tests/integration/blocks-nav.test.ts`: nav with no children renders flat (existing behavior preserved); nav with children renders chevron + dropdown; nav with both `href` and `children` renders both `<a>` and chevron `<button>`; recursive children render second-level dropdowns; children visibility gating correctly drops admin/auth/feature-gated children and collapses parents that lose all children.

- [x] **4.2 Keyboard navigation test**
  Programmatic test using happy-dom in `tests/integration/blocks-nav.test.ts`: simulate focus on chevron, `ArrowDown` to open + focus first item, repeated `ArrowDown` to navigate (wraps at end), `Escape` to close + return focus to chevron, click outside to close. All assertions pass.

- [x] **4.3 A11y attribute audit**
  Test confirms: chevron is `<button>` (implicit role=button), `aria-haspopup="menu"`, `aria-expanded` toggles `false`/`true`, `aria-controls` resolves to the dropdown's id, dropdown has `role="menu"`, items have `role="menuitem"` inside `role="none"` `<li>` wrappers. Verified via axe-core (`wcag2a, wcag2aa, wcag21aa`) on the live silver-pines build: 0 violations, 19 passes.

- [x] **4.4 Update one demo with a nested nav**
  Updated `src/seeds/silver-pines.ts`: the `Resources` item gains three children (Documents, Forms, Calendar). Visually verified via Chrome MCP on the built `astro preview` of silver-pines: hover-open, chevron rotation, ArrowDown/Escape keyboard flow, click-outside dismissal, mouseleave close.

- [x] **4.5 ODBC port verification — nested nav from source** *(deferred, depends on composable-layout Phase 7)*
  Composable-layout Phase 7 (re-running `/copy-website` against ODBC) is currently blocked. Once that runs, the resulting site will exercise this change's renderer end-to-end. The renderer/CSS/hydrator/editor work in this change supports cascading menus at any depth (verified via depth-2 unit test in `blocks-nav.test.ts` and the silver-pines demo above). When Phase 7 unblocks, no additional work is expected on this change — the import simply needs `children: [...]` populated on `nav` block items.
