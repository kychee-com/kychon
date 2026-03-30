## ADDED Requirements

### Requirement: AI-generated logo

The demo SHALL have an AI-generated logo depicting an eagle motif with "The Eagles" text. The logo SHALL be generated via an AI image API, saved as PNG, and uploaded to Run402 storage. The storage URL SHALL be referenced in site_config logo_url.

#### Scenario: Logo appears in navigation
- **WHEN** any page loads on the demo site
- **THEN** the nav bar SHALL display the AI-generated Eagles logo

### Requirement: AI-generated hero image

The demo SHALL have an AI-generated hero image showing community volunteering / good samaritan activity in a Wichita setting. The image SHALL be uploaded to Run402 storage and referenced in the homepage hero section config.

#### Scenario: Homepage hero shows AI-generated image
- **WHEN** a user visits the homepage
- **THEN** the hero section SHALL display the AI-generated community image

### Requirement: AI-generated member avatars

The demo SHALL generate 25+ unique AI headshot-style avatar images representing a diverse group of people. Each avatar SHALL be uploaded to Run402 storage and its URL assigned to a member's avatar_url in the seed.

#### Scenario: Directory shows AI-generated member photos
- **WHEN** a user views the member directory
- **THEN** each member SHALL display a unique AI-generated avatar photo

### Requirement: AI-generated event photos

The demo SHALL generate 6+ event photos depicting volunteer activities (food drives, park cleanups, fundraisers, youth programs). Each SHALL be uploaded to Run402 storage and assigned to events in the seed.

#### Scenario: Events show AI-generated images
- **WHEN** a user views the events page
- **THEN** events with images SHALL display AI-generated photos

### Requirement: Eagles color theme

The brand.json SHALL define a navy (#1b365d) and gold (#d4a843) color scheme with warm fonts (e.g., "Nunito" headings, "Open Sans" body). The theme SHALL be applied via site_config and render across all pages.

#### Scenario: Site renders with Eagles branding
- **WHEN** any page loads on the demo site
- **THEN** the primary color SHALL be navy, accent/hover color SHALL be gold, and headings SHALL use the configured font

### Requirement: Custom homepage sections

The homepage sections config SHALL include: a hero with Eagles-specific headline and CTA, a features grid highlighting volunteering/community, a stats section (years active, members helped, volunteer hours), and a CTA to join.

#### Scenario: Homepage renders Eagles-specific content
- **WHEN** a user visits the homepage
- **THEN** the hero SHALL show Eagles branding, features SHALL describe volunteer capabilities, and stats SHALL show community impact numbers
