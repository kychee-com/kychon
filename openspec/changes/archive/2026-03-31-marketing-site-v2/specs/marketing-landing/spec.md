## MODIFIED Requirements

### Requirement: Hero section with three CTAs

The hero SHALL display the headline "Own your member portal." with a subheading describing Kychon's value proposition (membership portal you own, $5-20/mo, no per-member fees). The hero SHALL include a browser mockup showing the Eagles demo homepage screenshot. CTAs SHALL be: "Explore Live Demo" (links to eagles.kychon.com), "Get a Custom Build — $29" (links to #pricing), and a text link "View on GitHub". The hero SHALL NOT reference competitor names.

#### Scenario: Hero renders without competitor names
- **WHEN** a visitor loads kychon.com
- **THEN** the hero SHALL display headline, subheading, browser mockup screenshot, and three CTAs
- **THEN** no competitor names SHALL appear in the hero section

#### Scenario: Primary CTA links to live demo
- **WHEN** a visitor clicks "Explore Live Demo"
- **THEN** the visitor SHALL be directed to eagles.kychon.com in a new tab

### Requirement: Product tour replaces showcase gallery

The homepage SHALL include a "Tour a real portal" section showing 4-6 screenshot tiles from the Eagles demo. Each tile SHALL display a screenshot of a different Eagles page (home, directory, events, forum), the page name, and a link to that page on eagles.kychon.com. No "Coming Soon" placeholders SHALL appear.

#### Scenario: Tour tiles render with screenshots
- **WHEN** the visitor scrolls to the product tour section
- **THEN** 4-6 tiles SHALL display screenshots of different Eagles subpages

#### Scenario: No placeholder cards
- **WHEN** the product tour section renders
- **THEN** zero "Coming Soon" cards SHALL be visible

### Requirement: Three benefit cards replace problem section

The homepage SHALL include a "Why organizations choose Kychon" section with three benefit cards: predictable cost (no per-member fees), ownership (your data, your branding), and customization (open source + AI). A small link SHALL read "Switching from Wild Apricot, Circle, or Bettermode? See the full comparison." and link to /compare.html.

#### Scenario: Benefits render without competitor attacks
- **WHEN** the visitor scrolls to the benefits section
- **THEN** three positive benefit cards SHALL be visible
- **THEN** competitor names SHALL only appear in the subtle compare link, not in headlines or cards

### Requirement: Niche cards show only active niches

The "Who It's For" section SHALL display only niches with existing landing pages (churches, associations, sports, HOAs). No "Coming Soon" or disabled cards SHALL appear.

#### Scenario: Only active niches shown
- **WHEN** the visitor scrolls to the niche section
- **THEN** exactly 4 niche cards SHALL be visible, all clickable
- **THEN** zero disabled or "coming soon" cards SHALL appear

### Requirement: Brand color includes lychee-rose accent

The CSS SHALL introduce a lychee-rose accent color (`#f15b86`) used for hero headline highlights, secondary hover states, and gradient accents. Indigo SHALL remain the primary trust color.

#### Scenario: Rose accent visible
- **WHEN** the homepage loads
- **THEN** the hero headline highlight SHALL use the rose accent color instead of coral

### Requirement: Pricing section shows plans only

The pricing section SHALL display the three plan cards (DIY, Studio, Pro) without the competitor comparison table. The comparison table SHALL be moved to /compare.html.

#### Scenario: No competitor table on homepage
- **WHEN** the visitor scrolls to pricing
- **THEN** three plan cards SHALL be visible
- **THEN** no competitor pricing comparison table SHALL appear on the homepage
