## ADDED Requirements

### Requirement: Forum Feature Flag

The forum module SHALL be feature-flagged. When the feature flag is disabled, all forum routes and UI elements SHALL be hidden.

#### Scenario: Forum feature flag disabled
- **WHEN** the forum feature flag is turned off
- **THEN** forum navigation links, listing pages, and topic pages SHALL NOT be accessible

#### Scenario: Forum feature flag enabled
- **WHEN** the forum feature flag is turned on
- **THEN** forum navigation links and pages SHALL be accessible to users

### Requirement: Forum Categories

The system SHALL support forum categories with a name, color, and display ordering. Categories SHALL be used to organize topics.

#### Scenario: Admin creates a forum category
- **WHEN** an admin creates a new category with a name, color, and sort order
- **THEN** the category SHALL appear in the forum at the specified position

#### Scenario: Categories displayed in order
- **WHEN** a user views the forum
- **THEN** categories SHALL be displayed according to their configured ordering

### Requirement: Forum Topics

The system SHALL support topics with title, body (rich text), author, pinned status, and locked status. Each topic MUST belong to a category.

#### Scenario: Member creates a topic
- **WHEN** a member submits a new topic with title, body, and category
- **THEN** the topic SHALL be created with the member as author and appear in the selected category listing

#### Scenario: Topic listing by category
- **WHEN** a user selects a forum category
- **THEN** all visible topics in that category SHALL be listed, with pinned topics appearing first

### Requirement: Forum Replies

The system SHALL support replies to topics with body and author fields. The reply count MUST be tracked on the topic record and updated when replies are added or removed.

#### Scenario: Member replies to a topic
- **WHEN** a member submits a reply to a topic
- **THEN** the reply SHALL be saved and the topic's reply count SHALL increment

#### Scenario: Reply thread view
- **WHEN** a user views a topic
- **THEN** all visible replies SHALL be displayed in chronological order below the topic body

### Requirement: Admin Moderation

Admin users SHALL be able to hide/unhide topics and replies, delete topics and replies, and pin/lock topics.

#### Scenario: Admin hides a topic
- **WHEN** an admin hides a topic
- **THEN** the topic SHALL no longer be visible to non-admin members

#### Scenario: Admin unhides a topic
- **WHEN** an admin unhides a previously hidden topic
- **THEN** the topic SHALL become visible to members again

#### Scenario: Admin hides a reply
- **WHEN** an admin hides a reply
- **THEN** the reply SHALL no longer be visible to non-admin members

#### Scenario: Admin deletes a topic
- **WHEN** an admin deletes a topic
- **THEN** the topic and its replies SHALL be removed

#### Scenario: Admin pins a topic
- **WHEN** an admin pins a topic
- **THEN** the topic SHALL appear at the top of its category listing

#### Scenario: Admin locks a topic
- **WHEN** an admin locks a topic
- **THEN** no new replies SHALL be accepted for that topic

### Requirement: Hidden Content Visibility

Hidden topics and replies SHALL NOT be visible to regular members. Only admin users SHALL see hidden content, clearly marked as hidden.

#### Scenario: Member views category with hidden topic
- **WHEN** a member views a category containing a hidden topic
- **THEN** the hidden topic SHALL NOT appear in the listing

#### Scenario: Admin views category with hidden topic
- **WHEN** an admin views a category containing a hidden topic
- **THEN** the hidden topic SHALL appear in the listing with a hidden indicator
