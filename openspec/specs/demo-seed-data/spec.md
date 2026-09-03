## Purpose

The Eagles demo's typed seed module (`src/seeds/eagles.ts`) populates every portal feature with enough realistic, relatively-dated content that the demo always reads as an active organization.

## Requirements

### Requirement: Site config with full branding

The seed SHALL declare `site_config` entries for `site_name` ("The Eagles — Good Samaritans of Wichita"), `site_tagline`, `site_description`, `logo_url`, and `favicon_url`, plus the theme and nav, and SHALL enable the events, forum, directory, resources, and committees feature flags.

#### Scenario: Site config populates on deploy
- **WHEN** the generated seed is executed after `schema.sql`
- **THEN** `site_config` SHALL contain branding, theme, nav, and the enabled feature flags

### Requirement: 25+ members with diverse profiles

The seed SHALL insert at least 25 members with display names, bios, avatar URLs, varied tiers, statuses (mostly active, a few pending), custom fields, and joined dates spread over the past 2 years. Members SHALL include a mix of roles: 1 admin, 2 moderators, and members for the remainder.

#### Scenario: Directory shows populated member list
- **WHEN** a user visits the directory page
- **THEN** at least 25 members SHALL appear with names, avatars, bios, and tier badges

#### Scenario: Members have varied join dates
- **WHEN** the seed is executed
- **THEN** member joined dates SHALL span from 2 years ago to 1 week ago

### Requirement: 10+ events with mix of past and upcoming

The seed SHALL insert at least 5 upcoming events and 5-7 past events. Events SHALL include titles, descriptions, Wichita-area locations, start/end times, capacity, and image URLs. Past events SHALL have RSVP records showing attendance.

#### Scenario: Events page shows upcoming and past sections
- **WHEN** a user visits the events page
- **THEN** at least 5 upcoming events and 5 past events SHALL be visible

#### Scenario: Past events have RSVP data
- **WHEN** a past event is viewed
- **THEN** it SHALL show going/maybe attendees from seed data

### Requirement: Active forum with 5 categories and 15+ topics

The seed SHALL insert 5 forum categories (General, Volunteering, Fundraising Ideas, Community Stories, Feedback), at least 15 topics with bodies, and 40-60 replies across those topics. Reply counts on topics SHALL be accurate.

#### Scenario: Forum shows active discussions
- **WHEN** a user visits the forum page
- **THEN** 5 categories SHALL appear with topic counts, and clicking a category SHALL show multiple topics with replies

### Requirement: 6 committees with member assignments

The seed SHALL insert 6 committees (Fundraising, Outreach, Youth Programs, Events Planning, Communications, Board of Directors) with descriptions. At least 30 committee-member assignments SHALL be created so each member serves on 1-3 committees.

#### Scenario: Committees page shows all committees with members
- **WHEN** a user visits the committees page
- **THEN** 6 committees SHALL appear, each showing its assigned members

### Requirement: 8-10 announcements with history

The seed SHALL insert 8-10 announcements with titles, HTML bodies, author IDs, and created dates spread over the past 3 months. At least 2 SHALL be pinned.

#### Scenario: Homepage shows announcements with pinned items first
- **WHEN** a user visits the homepage
- **THEN** announcements SHALL appear with pinned items at the top

### Requirement: 12-15 resources in the library

The seed SHALL insert 12-15 resources with titles, descriptions, categories (Handbooks, Forms, Training, Media), and file URLs. Some SHALL be members-only.

#### Scenario: Resources page shows categorized content
- **WHEN** a user visits the resources page
- **THEN** resources SHALL appear organized by category with members-only badges where applicable

### Requirement: Activity log with recent entries

The seed SHALL insert 30-40 activity-log entries with varied actions (signup, rsvp, post, announcement, resource_upload) and member IDs, with created dates spread over the past 2 weeks.

#### Scenario: Admin dashboard shows recent activity
- **WHEN** an admin visits the admin dashboard
- **THEN** the activity feed SHALL show recent entries with member names and actions

### Requirement: Seed uses relative dates

All date values in the generated seed SHALL be computed relative to execution time using PostgreSQL interval expressions (e.g. `now() - interval '3 days'`) so the demo reads as current whenever it is deployed or reset.

#### Scenario: Rebuilt demo has fresh dates
- **WHEN** the generated seed is executed at any date
- **THEN** all event, announcement, and activity dates SHALL be relative to the current date
