## ADDED Requirements

### Requirement: Landing page hero section

The kychon.com landing page SHALL display a hero section with headline "Tell us about your community. We'll build your platform in 5 minutes.", a subheading listing key features (member directory, events, forum, newsletter) with pricing ($5/mo), and three CTAs: [Build My Portal], [See Demo], [Fork the Template].

#### Scenario: Hero renders with CTAs
- **WHEN** a visitor loads kychon.com
- **THEN** the hero section SHALL display the headline, subheading, and three CTA buttons

#### Scenario: Build My Portal CTA
- **WHEN** a visitor clicks "Build My Portal"
- **THEN** the visitor SHALL be directed to the Studio onboarding flow

#### Scenario: Fork the Template CTA
- **WHEN** a visitor clicks "Fork the Template"
- **THEN** the visitor SHALL be directed to the Run402 marketplace or GitHub template

### Requirement: Competitive positioning section

The landing page SHALL include a "The Problem" section showing competitor pricing pain points (Wild Apricot $530/mo, Circle $89/mo + fees, Bettermode price hikes) and a side-by-side comparison section contrasting Kychon's modern design, flat pricing, AI features, and data ownership against incumbents.

#### Scenario: Problem cards render
- **WHEN** the landing page loads
- **THEN** three competitor pain-point cards SHALL be visible with specific pricing complaints

#### Scenario: Comparison table renders
- **WHEN** the visitor scrolls to the comparison section
- **THEN** a side-by-side comparison SHALL show Kychon advantages across design, pricing, AI, and data ownership

### Requirement: AI features showcase

The landing page SHALL include a section highlighting five AI capabilities: content moderation, auto-translation, newsletter writer, smart onboarding, and member insights. Each feature SHALL have an icon, name, and one-line description.

#### Scenario: AI features section renders
- **WHEN** the visitor scrolls to the AI features section
- **THEN** five AI feature cards SHALL be displayed with icons, names, and descriptions

### Requirement: Pricing table

The landing page SHALL display two pricing tables: (1) a competitor comparison table showing per-member-count pricing for Wild Apricot, Circle, and Kychon; (2) a Kychon plans table showing Template (DIY), Studio + Starter, and Studio + Unlimited tiers with pricing breakdown.

#### Scenario: Competitor pricing comparison renders
- **WHEN** the visitor scrolls to the pricing section
- **THEN** a table SHALL show pricing at 100, 500, 2000, and 5000 member tiers across Wild Apricot, Circle, and Kychon

#### Scenario: Kychon plans table renders
- **WHEN** the visitor scrolls to the plans section
- **THEN** a table SHALL show three Kychon tiers with initial build, hosting, and AI customizer pricing

### Requirement: Niche audience cards

The landing page SHALL include a "Who It's For" section with cards for target verticals: churches & religious orgs, professional associations, sports leagues & clubs, HOAs & condo associations, coworking spaces, alumni networks, nonprofits & charities. Each card SHALL link to its niche landing page.

#### Scenario: Niche cards render with links
- **WHEN** the visitor scrolls to the "Who It's For" section
- **THEN** vertical cards SHALL be displayed, each linking to the corresponding niche landing page

### Requirement: Final CTA section

The landing page SHALL end with a CTA section containing [Build My Portal] ("Live in 5 minutes") and [Fork the Template] ("For developers and agents") buttons.

#### Scenario: Bottom CTA renders
- **WHEN** the visitor scrolls to the bottom of the page
- **THEN** two CTA buttons SHALL be visible with their respective taglines

### Requirement: Niche landing pages

The marketing site SHALL include niche-specific landing pages at `/churches`, `/hoa`, `/sports`, and `/associations`. Each page SHALL use the same layout as the main landing page but with niche-specific hero text, screenshots, sample data examples, and language tailored to that audience.

#### Scenario: Church niche page
- **WHEN** a visitor navigates to kychon.com/churches
- **THEN** the page SHALL display church-specific messaging, features (sermon archive, prayer requests), and Portuguese/English examples

#### Scenario: HOA niche page
- **WHEN** a visitor navigates to kychon.com/hoa
- **THEN** the page SHALL display HOA-specific messaging, features (maintenance requests, document archive, voting), and resident vs board role examples

#### Scenario: Sports niche page
- **WHEN** a visitor navigates to kychon.com/sports
- **THEN** the page SHALL display sports league-specific messaging, features (teams, standings, schedules), and league management examples

#### Scenario: Association niche page
- **WHEN** a visitor navigates to kychon.com/associations
- **THEN** the page SHALL display professional association-specific messaging, features (company profiles, committees), and directory-focused examples

### Requirement: Marketing site responsive design

The marketing site (landing page and all niche pages) SHALL be fully responsive across desktop (1200px+), tablet (768-1199px), and mobile (< 768px) viewports. Navigation, pricing tables, and feature cards SHALL reflow appropriately.

#### Scenario: Mobile viewport
- **WHEN** the site is viewed on a device with viewport width under 768px
- **THEN** navigation SHALL collapse to a hamburger menu, pricing tables SHALL scroll horizontally or stack, and feature cards SHALL stack vertically

#### Scenario: Desktop viewport
- **WHEN** the site is viewed on a device with viewport width 1200px or greater
- **THEN** the full navigation SHALL be visible, pricing tables SHALL display in full, and feature cards SHALL display in a grid
