## MODIFIED Requirements

### Requirement: Config-driven navigation

The nav config SHALL include items for events, resources, forum, and committees, each gated by their respective feature flag. Kychon-owned navigation hrefs SHALL use clean public paths when a clean public path exists.

#### Scenario: Events nav item shown when enabled
- **WHEN** `feature_events` is true
- **THEN** the nav includes an "Events" link to `/events`

#### Scenario: Forum nav item hidden when disabled
- **WHEN** `feature_forum` is false
- **THEN** the nav does not include a "Forum" link

#### Scenario: Legacy configured nav href is canonicalized
- **WHEN** stored navigation config contains a Kychon-owned href such as `/events.html`
- **THEN** rendered navigation uses `/events`
- **AND** it does not render `/events.html` as the public href
