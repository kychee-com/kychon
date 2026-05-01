## MODIFIED Requirements

### Requirement: `nav` block carries the navigation that used to live in `site_config.nav`

The `site_config.nav` key SHALL be removed from the system. Navigation SHALL be expressed as a `nav` block in `zone = 'header'`. The `nav` block's `config.items` SHALL be an array of nav items, each carrying `label`, `href`, `icon`, optional `public`, `auth`, `feature`, `admin` properties, AND an optional `children: NavItem[]` field that recursively contains nav items. When `children` is present and non-empty, the item SHALL be rendered as a hover/focus dropdown trigger; when `children` is absent, empty, or undefined, the item SHALL render as today's flat nav link. The block edit popover SHALL be the editor surface for nav items, replacing the separate nav editor that wrote to `site_config`. The popover SHALL support adding, removing, editing, and drag-reordering child items (scoped within their parent's `children` array).

#### Scenario: Site nav comes from a sections row, not site_config
- **WHEN** a Kychon page loads
- **THEN** the navigation in the header zone is rendered by `BLOCK_TYPES.nav.render` against the `nav` block's `config.items`
- **THEN** no code path reads `site_config.nav`

#### Scenario: Admin edits nav via the block popover
- **WHEN** an admin clicks the edit affordance on the `nav` block in the header
- **THEN** a popover opens with the nav items as editable rows (label, href, visibility flags, drag-reorder)
- **WHEN** the admin saves
- **THEN** the system PATCHes the `nav` block's `config.items`

#### Scenario: Flat nav configs continue to work
- **WHEN** a `nav` block has items with no `children` field set
- **THEN** the rendered nav is flat — each item is an `<a class="nav-link">` with no chevron and no dropdown

#### Scenario: An item with children renders as a dropdown trigger
- **WHEN** a `nav` block has an item `{ label: 'Marina', children: [{ label: 'Layout', href: '/marina/layout' }, { label: 'How-To', href: '/marina/howto' }] }`
- **THEN** the rendered HTML contains a chevron toggle: `<button class="nav-chevron-toggle" aria-haspopup="menu" aria-expanded="false" aria-controls="..."`
- **THEN** the rendered HTML contains an `<ul class="nav-dropdown" role="menu" hidden>` with two `<li role="none"><a role="menuitem" href>...</a></li>` children
- **THEN** if the parent also has `href` set, an additional `<a class="nav-link" href={href}>` is rendered alongside the chevron

#### Scenario: Hover opens the dropdown on pointer devices
- **WHEN** a user with a pointer device hovers a parent nav item with children
- **THEN** the dropdown becomes visible (CSS-driven via `@media (hover: hover) and (pointer: fine)`)
- **THEN** `aria-expanded` is updated to `"true"` by the runtime handler

#### Scenario: Focus opens the dropdown for keyboard users
- **WHEN** a keyboard user tabs to the chevron of a parent nav item
- **WHEN** the user presses `↓` (Down arrow) or `Enter`
- **THEN** the dropdown opens and focus moves to the first menu item

#### Scenario: Keyboard navigation inside an open dropdown
- **WHEN** a user presses `↓` while focus is on a menu item
- **THEN** focus moves to the next menu item (wrapping at the end)
- **WHEN** a user presses `↑`
- **THEN** focus moves to the previous menu item (wrapping at the start)
- **WHEN** a user presses `Enter` or `Space` on a menu item
- **THEN** the link is activated and the menu closes

#### Scenario: Escape closes the menu and returns focus
- **WHEN** a dropdown is open with a menu item focused
- **WHEN** the user presses `Escape`
- **THEN** the dropdown closes
- **THEN** focus returns to the chevron trigger

#### Scenario: Tab advances out of the menu
- **WHEN** a dropdown is open with a menu item focused
- **WHEN** the user presses `Tab`
- **THEN** the dropdown closes
- **THEN** focus advances to the next top-level nav item

#### Scenario: Click outside closes any open dropdown
- **WHEN** a dropdown is open
- **WHEN** the user clicks anywhere outside the dropdown subtree (and outside the chevron)
- **THEN** the dropdown closes

#### Scenario: Mobile renders inline expansion, not hover fly-out
- **WHEN** the viewport matches `@media (hover: none) or (max-width: 768px)`
- **WHEN** a user taps the parent of a nav item with children
- **THEN** the dropdown expands inline below the parent (not absolutely positioned)
- **THEN** the chevron rotates 180° via CSS transform
- **THEN** child items are indented to indicate hierarchy

#### Scenario: Recursive children render at depth ≥ 2
- **WHEN** a `nav` block has a parent item whose child has its own `children` array
- **THEN** the rendered HTML supports a second-level dropdown
- **THEN** keyboard and pointer handling work the same way at every depth

#### Scenario: Removing a parent in the editor prompts about its children
- **WHEN** an admin clicks the remove affordance on a parent nav item that has children
- **THEN** the editor prompts: `"Remove this item and its N children?"`
- **WHEN** the admin confirms
- **THEN** the parent and its entire subtree are removed from `config.items`
