## ADDED Requirements

### Requirement: Demo showcase section displays three live demo sites
The marketing page SHALL include a "See it in action" section containing three demo cards, one for each live demo site. Each card SHALL display:
- A screenshot of the demo site in a styled browser frame
- The community name and one-line description
- 3-4 feature pills highlighting the demo's key capabilities
- A "Visit Demo" button linking to the live site (opens in new tab)

The three demos are:
1. **Barrio Unido** (barrio.kychon.com) — pills: Multilingual, AI Translation, Moderated Forums, Spanish-First UI
2. **Silver Pines** (silver-pines.kychon.com) — pills: Accessibility, Font Scaling, High Contrast, Keyboard Navigation
3. **Eagles** (eagles.kychon.com) — pills: Member Directory, AI Features, Reactions, Activity Feed

#### Scenario: Desktop layout shows three cards side by side
- **WHEN** a visitor views the demo section on a viewport >= 1024px
- **THEN** the three demo cards display in a horizontal row with equal width

#### Scenario: Mobile layout stacks demo cards vertically
- **WHEN** a visitor views the demo section on a viewport < 768px
- **THEN** the demo cards stack vertically with full-width screenshots

#### Scenario: Clicking "Visit Demo" opens the live site
- **WHEN** a visitor clicks the "Visit Demo" button on a demo card
- **THEN** the corresponding demo site opens in a new browser tab

### Requirement: Demo cards include feature pill badges
Each demo card SHALL display feature pills as small, styled badges below the screenshot. Pills SHALL use the site's primary color palette and be readable at small sizes.

#### Scenario: Feature pills are visible and legible
- **WHEN** a visitor views a demo card
- **THEN** all feature pills are visible, use consistent styling, and text is readable at 14px minimum

### Requirement: Demo section has a section header with context
The demo showcase section SHALL include a header with a title (e.g., "See it in action") and a subtitle explaining that these are real communities running on Kychon.

#### Scenario: Section header provides context
- **WHEN** a visitor scrolls to the demo section
- **THEN** they see a title and subtitle before the demo cards that explain these are live production sites

### Requirement: All navigation and CTA links point to real destinations
Every link on the marketing page SHALL resolve to a real destination. Internal section links SHALL scroll to the correct section. Demo links SHALL point to live URLs. The "Fork Template" CTA SHALL link to the GitHub repository (or a placeholder anchor until the repo is public).

#### Scenario: Nav links scroll to correct sections
- **WHEN** a visitor clicks a nav link (Why, AI Features, Pricing, Demos, Who It's For)
- **THEN** the page scrolls to the corresponding section

#### Scenario: No broken or placeholder-only links
- **WHEN** a visitor inspects any link on the page
- **THEN** every `href` resolves to either an anchor section, a live URL, or an explicit placeholder with clear intent (e.g., `#fork` for pre-launch GitHub link)
