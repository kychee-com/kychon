## ADDED Requirements

### Requirement: Hero section with three CTAs

The landing page SHALL display a hero section with headline, subheading listing key features (member directory, events, forum, newsletter, AI features) with pricing context, and three CTA buttons: "Try the Demo" (links to Run402 demo mode instance), "Browse a Showcase" (scrolls to showcase gallery), and "Fork on GitHub" (links to the GitHub repo).

#### Scenario: Hero renders on page load
- **WHEN** a visitor loads kychon.com
- **THEN** the hero section SHALL be the first visible content with headline, subheading, and three CTA buttons

#### Scenario: Try the Demo CTA
- **WHEN** a visitor clicks "Try the Demo"
- **THEN** the visitor SHALL be directed to the Run402 demo mode instance URL

#### Scenario: Fork on GitHub CTA
- **WHEN** a visitor clicks "Fork on GitHub"
- **THEN** the visitor SHALL be directed to the Kychon GitHub repository

### Requirement: Problem section with competitor comparison

The landing page SHALL include a "The Problem" section showing competitor pricing pain points (Wild Apricot, Circle, Bettermode) with specific pricing examples and a side-by-side comparison highlighting Kychon's advantages: modern design, flat pricing, AI features, data ownership, and open source.

#### Scenario: Problem cards render
- **WHEN** the landing page loads
- **THEN** three competitor pain-point cards SHALL be visible with specific pricing complaints

#### Scenario: Comparison table
- **WHEN** the visitor scrolls to the comparison area
- **THEN** a comparison grid SHALL contrast Kychon against incumbents across design, pricing, AI, and data ownership dimensions

### Requirement: Feature grid

The landing page SHALL display a feature grid showing core capabilities: member directory, events with RSVP, announcements with reactions, resource library, forum, committees, inline editing, and config-driven pages. Each feature SHALL have an icon, name, and one-line description.

#### Scenario: Feature grid renders
- **WHEN** the visitor scrolls to the features section
- **THEN** a grid of 8+ feature cards SHALL be displayed

### Requirement: AI features showcase

The landing page SHALL include a dedicated section for AI capabilities: content moderation, auto-translation, newsletter writer, smart onboarding, member insights, and event recaps. Each SHALL have an icon, name, description, and a "BYOK" note (bring your own key).

#### Scenario: AI section renders
- **WHEN** the visitor scrolls to the AI section
- **THEN** six AI feature cards SHALL be displayed with BYOK context

### Requirement: Showcase gallery with live links

The landing page SHALL include a "See It Live" gallery section showing 2-4 showcase community sites. Each card SHALL display a screenshot image, community name, niche label (e.g., "Charity / Volunteers"), and a "Browse →" link to the live showcase site. The Eagles demo SHALL be the first card.

#### Scenario: Showcase gallery renders with Eagles
- **WHEN** the visitor scrolls to the showcase section
- **THEN** at least one showcase card SHALL be visible featuring the Eagles community with a link to eagles.kychon.com (or eagles.run402.com)

#### Scenario: Showcase card links to live site
- **WHEN** a visitor clicks "Browse →" on a showcase card
- **THEN** the visitor SHALL be taken to the live showcase community site in a new tab

### Requirement: Pricing table

The landing page SHALL display pricing information in two parts: (1) a competitor comparison showing per-member-count pricing for Wild Apricot, Circle, and Kychon at 100, 500, 2000, and 5000 member tiers; (2) Kychon plans showing DIY Template (free + $5-20/mo hosting), Studio build ($29 one-time), and Kychon Pro ($9-29/mo ongoing AI customization).

#### Scenario: Competitor pricing table renders
- **WHEN** the visitor scrolls to pricing
- **THEN** a comparison table SHALL show pricing across member count tiers

#### Scenario: Kychon plans render
- **WHEN** the visitor scrolls to the plans section
- **THEN** three plan cards SHALL be visible with pricing breakdowns

### Requirement: "Who It's For" niche cards

The landing page SHALL include niche audience cards for: churches, professional associations, sports leagues, HOAs, nonprofits, coworking spaces, and alumni networks. Each card SHALL link to the corresponding niche landing page (e.g., /churches.html).

#### Scenario: Niche cards render with links
- **WHEN** the visitor scrolls to the "Who It's For" section
- **THEN** niche cards SHALL be displayed, each linking to its niche landing page

### Requirement: Final CTA section

The landing page SHALL end with a CTA section containing "Try the Demo" and "Fork on GitHub" buttons with taglines.

#### Scenario: Bottom CTA renders
- **WHEN** the visitor scrolls to the bottom
- **THEN** two CTA buttons SHALL be visible

### Requirement: Responsive design

The marketing site SHALL be fully responsive across desktop (1200px+), tablet (768-1199px), and mobile (<768px). Navigation, pricing tables, feature grids, and showcase cards SHALL reflow appropriately.

#### Scenario: Mobile viewport
- **WHEN** viewed under 768px width
- **THEN** feature cards and showcase cards SHALL stack vertically, pricing tables SHALL scroll horizontally or stack

#### Scenario: Desktop viewport
- **WHEN** viewed at 1200px+ width
- **THEN** full grid layouts SHALL be visible
