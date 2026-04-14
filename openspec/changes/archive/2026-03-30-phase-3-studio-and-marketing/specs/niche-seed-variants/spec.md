## ADDED Requirements

### Requirement: Church seed variant

The system SHALL provide a `seed-church.sql` file that configures a church portal with: roles (pastor, elder, member, visitor), event types (service, prayer group, youth night, bible study), Portuguese and English as default languages, sermon library section in resources, prayer request page, and committees (youth, worship, deacons). The seed SHALL set church-appropriate site_config values (name placeholder, feature flags, nav structure).

#### Scenario: Church seed creates church-specific config
- **WHEN** `schema.sql` and `seed-church.sql` are executed
- **THEN** `membership_tiers` SHALL include pastor, elder, member, and visitor tiers
- **THEN** `site_config` SHALL have nav entries for sermons and prayer requests
- **THEN** `pages` SHALL include sermon library and prayer request pages

#### Scenario: Church seed is idempotent
- **WHEN** `seed-church.sql` is executed twice
- **THEN** no duplicate rows are created

### Requirement: HOA seed variant

The system SHALL provide a `seed-hoa.sql` file that configures an HOA/condo portal with: roles (board member, resident, tenant), maintenance request tracking as a page type, document archive section, voting/polls page, and issue submission with photo support. The seed SHALL set HOA-appropriate site_config values.

#### Scenario: HOA seed creates HOA-specific config
- **WHEN** `schema.sql` and `seed-hoa.sql` are executed
- **THEN** `membership_tiers` SHALL include board member, resident, and tenant tiers
- **THEN** `site_config` SHALL have nav entries for maintenance requests and documents
- **THEN** `pages` SHALL include maintenance request and document archive pages

#### Scenario: HOA seed is idempotent
- **WHEN** `seed-hoa.sql` is executed twice
- **THEN** no duplicate rows are created

### Requirement: Professional association seed variant

The system SHALL provide a `seed-association.sql` file that configures a professional association portal with: directory as the core feature (with company profiles), committee tracking, event-heavy layout, membership tiers named by association conventions (e.g., fellow, member, associate, student). The seed SHALL set association-appropriate site_config values.

#### Scenario: Association seed creates association-specific config
- **WHEN** `schema.sql` and `seed-association.sql` are executed
- **THEN** `membership_tiers` SHALL include fellow, member, associate, and student tiers
- **THEN** `member_custom_fields` SHALL include a company/organization field
- **THEN** `site_config` SHALL emphasize directory and events in the nav structure

#### Scenario: Association seed is idempotent
- **WHEN** `seed-association.sql` is executed twice
- **THEN** no duplicate rows are created

### Requirement: Niche seed variant selection by Studio

Kychon Studio SHALL select the appropriate seed variant based on the community type chosen during the interview. If no niche variant matches, the default `seed.sql` SHALL be used.

#### Scenario: Church community type selected
- **WHEN** the Studio interview identifies community type as "church"
- **THEN** Studio SHALL use `seed-church.sql` during the build step

#### Scenario: HOA community type selected
- **WHEN** the Studio interview identifies community type as "HOA"
- **THEN** Studio SHALL use `seed-hoa.sql` during the build step

#### Scenario: Association community type selected
- **WHEN** the Studio interview identifies community type as "association"
- **THEN** Studio SHALL use `seed-association.sql` during the build step

#### Scenario: Unmatched community type
- **WHEN** the Studio interview identifies a community type without a niche variant (e.g., "coworking")
- **THEN** Studio SHALL use the default `seed.sql` during the build step
