## Purpose

The Eagles demo portal ships a complete visual identity — logo, hero, member avatars, event photography, colour theme, and homepage sections — so the demo reads as a real organization rather than a template.

## Requirements

### Requirement: Demo logo

The demo SHALL have a logo depicting an eagle motif with "The Eagles" text. The image SHALL live in `demo/eagles/assets/`, be copied into `public/assets/` at deploy time, and be referenced from `site_config` `logo_url` in `src/seeds/eagles.ts`.

#### Scenario: Logo appears in navigation
- **WHEN** any page loads on the demo site
- **THEN** the nav bar SHALL display the Eagles logo

### Requirement: Demo hero image

The demo SHALL have a hero image showing community volunteering in a Wichita setting, shipped in `demo/eagles/assets/` and referenced from the homepage hero section config.

#### Scenario: Homepage hero shows the community image
- **WHEN** a user visits the homepage
- **THEN** the hero section SHALL display the Eagles community image

### Requirement: Member avatars

The demo SHALL ship at least 25 distinct headshot-style avatar images in `demo/eagles/assets/` (`avatar-NN.jpg`), each assigned to a member's `avatar_url` in the seed.

#### Scenario: Directory shows member photos
- **WHEN** a user views the member directory
- **THEN** each member SHALL display a distinct avatar photo

### Requirement: Event photos

The demo SHALL ship at least 6 event photos depicting volunteer activities (food drives, park cleanups, fundraisers, youth programs), each assigned to an event in the seed.

#### Scenario: Events show photos
- **WHEN** a user views the events page
- **THEN** events with images SHALL display their photos

### Requirement: Eagles colour theme

`src/seeds/eagles.ts` SHALL define a navy primary (`#1b365d`), a gold accent (`#d99a29`), and the font pairing `Cormorant Garamond` (headings) with `Inter` (body). The theme SHALL be applied via `site_config` and render across all pages.

#### Scenario: Site renders with Eagles branding
- **WHEN** any page loads on the demo site
- **THEN** the primary colour SHALL be navy, the accent colour SHALL be gold, and headings SHALL use the configured heading font

### Requirement: Custom homepage sections

The homepage sections config SHALL include: a hero with Eagles-specific headline and CTA, a features grid highlighting volunteering and community, a stats section (years active, members helped, volunteer hours), and a CTA to join.

#### Scenario: Homepage renders Eagles-specific content
- **WHEN** a user visits the homepage
- **THEN** the hero SHALL show Eagles branding, features SHALL describe volunteer capabilities, and stats SHALL show community impact numbers
