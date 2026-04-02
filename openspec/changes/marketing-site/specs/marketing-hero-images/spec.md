## ADDED Requirements

### Requirement: Hero section displays a generated community mashup image
The hero section SHALL include a visually rich image showing a mashup of diverse communities — people gathering, events, activities — conveying that Kychon works for many community types. The image SHALL be stored as a static asset in `site/marketing/assets/hero/`.

#### Scenario: Hero image loads on page visit
- **WHEN** a visitor loads the marketing page
- **THEN** a hero image is visible in the hero section, rendered at full width on desktop and scaled proportionally on mobile

#### Scenario: Hero image is optimized for web
- **WHEN** the hero image is served
- **THEN** the file size is under 300KB and the format is WebP or optimized PNG/JPG

### Requirement: Feature section images illustrate key capabilities
The demo showcase and/or feature sections MAY include additional generated images showing community scenarios (forum discussions, event listings, member directories, multilingual interfaces). These SHALL be stored in `site/marketing/assets/`.

#### Scenario: Feature images enhance visual storytelling
- **WHEN** a visitor views the demo or feature sections
- **THEN** images complement the text content and show realistic community portal scenarios

### Requirement: All images are responsive
All marketing site images SHALL scale correctly from mobile (375px) to desktop (1440px+) viewports without overflow, distortion, or layout shift.

#### Scenario: Images scale on mobile viewport
- **WHEN** a visitor views the marketing site on a 375px wide viewport
- **THEN** all images fit within the viewport width and maintain aspect ratio

#### Scenario: No layout shift from images
- **WHEN** images load on the marketing page
- **THEN** the surrounding layout does not shift (images have explicit width/height or aspect-ratio CSS)
