## Why

Communities need lightweight decision-making tools built into their portal. Currently, admins who want member input resort to external tools (Google Forms, Strawpoll) that fragment the experience and lose context. Polls embedded directly in announcements, forum topics, and the homepage keep members engaged within the portal and give admins actionable signal without leaving the platform.

Polls are also one of the highest-engagement features across community platforms — they require minimal effort from members (one click) and create visible social proof that draws more participation.

## What Changes

- **Add polls as standalone entities that can be embedded anywhere** — a poll is a first-class object with its own table, attachable to announcements, forum topics, homepage sections, or standing alone at `/polls`
- **Poll creation inline** — admins (and optionally members) create polls via an inline form that appears inside announcement/forum editors or on the standalone `/polls` page
- **Voting with configurable visibility** — members vote with one click; results display based on per-poll policy: always visible, after voting, or after poll closes
- **Anonymous voting option** — per-poll boolean controls whether voter identity is exposed in results
- **Poll auto-close on page load** — polls with a `closes_at` timestamp are marked closed when viewed after expiry (scheduled auto-close deferred to later)
- **Feature-flagged** — `feature_polls` toggle; `polls_member_create` controls whether non-admin members can create polls

## Capabilities

### New Capabilities

- `polls`: Poll CRUD, voting, results display, embedding in other content types, feature flags, and the standalone `/polls` page

### Modified Capabilities

- `announcements`: Announcements can have an attached poll; poll form appears in announcement editor for admins; poll widget renders below announcement body
- `forum`: Forum topics can have an attached poll; poll form appears in topic creation; poll widget renders in topic detail view
- `config-driven-ui`: New homepage section type `polls` renders featured polls; new feature flags `feature_polls` and `polls_member_create` added to site_config
