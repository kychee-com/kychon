## ADDED Requirements

### Requirement: Silver Pines site configuration
The seed SQL SHALL configure a Silver Pines Senior Center portal with: sage green/cream/amber theme, Merriweather + Source Sans 3 fonts, 18px base font size, 1.7 line-height, feature flags enabling directory, events, announcements, resources, forum, committees, and accessibility toolbar.

#### Scenario: Theme applied on load
- **WHEN** the Silver Pines portal loads
- **THEN** CSS custom properties reflect the sage/cream/amber palette with `--wl-font-size-base: 18px` and `--wl-line-height: 1.7`

#### Scenario: Nav structure matches senior center
- **WHEN** a visitor views the navigation
- **THEN** nav items include Home, Directory, Events, Resources, Announcements, Forum, and Getting Here

### Requirement: Member seed data
The seed SHALL include 20-25 members with realistic senior profiles: diverse ages (60-85), diverse ethnicities, Asheville-area names, hobbies, volunteer roles, and profile photos referencing Run402 storage URLs. Members SHALL have varied roles (member, volunteer, admin/board).

#### Scenario: Directory is populated
- **WHEN** a visitor browses the member directory
- **THEN** at least 20 members appear with names, photos, and brief bios mentioning hobbies or volunteer work

#### Scenario: Role distribution is realistic
- **WHEN** querying members by role
- **THEN** there are 2-3 board/admin members, 5-7 volunteers, and the remainder are regular members

### Requirement: Event seed data
The seed SHALL include 12+ events: 6 upcoming (tai chi, watercolor class, tech help desk, book club, Medicare info session, movie night) and 6 past (garden party, health fair, holiday potluck, nature walk, craft fair, volunteer appreciation). Events SHALL use `NOW() - INTERVAL` / `NOW() + INTERVAL` for relative dating.

#### Scenario: Calendar shows upcoming events
- **WHEN** a visitor views the events page
- **THEN** at least 6 future events are listed with dates, times, locations, and descriptions

#### Scenario: Past events show history
- **WHEN** a visitor views past events
- **THEN** at least 6 past events appear, demonstrating the center's activity history

### Requirement: Resource seed data
The seed SHALL include 10+ resources across categories: transportation (shuttle schedules, ride-share info), health (Medicare guide, flu shot schedule, emergency contacts), meals (weekly menu, meal program enrollment), and technology (tablet basics, video calling guide, internet safety).

#### Scenario: Resources organized by category
- **WHEN** a visitor browses resources
- **THEN** resources are grouped into clear categories relevant to senior living

### Requirement: Committee seed data
The seed SHALL include 5 committees: Wellness, Social Events, Garden, Tech Buddies, and Transportation. Each committee SHALL have 3-6 assigned members, a description, and a designated chair.

#### Scenario: Committees have active membership
- **WHEN** a visitor views a committee page
- **THEN** the committee shows its chair, members, description, and purpose

### Requirement: Forum seed data
The seed SHALL include 3 forum categories (Health & Wellness, Activities & Hobbies, Tech Help) with 10-12 topics and 25-35 replies. Forum tone SHALL be warm, supportive, and practical.

#### Scenario: Forum has active discussions
- **WHEN** a visitor browses the forum
- **THEN** categories show recent topics with multiple replies in a helpful, conversational tone

### Requirement: Announcement seed data
The seed SHALL include 8 announcements mixing practical notices (holiday hours, parking lot repaving, flu shot clinic dates) and social updates (welcome new members, garden club harvest, photo contest winners). 1-2 announcements SHALL be pinned.

#### Scenario: Announcements mix practical and social
- **WHEN** a visitor views announcements
- **THEN** both practical notices and social updates are visible, with pinned items at the top

### Requirement: Custom pages
The seed SHALL include 2 custom schema-driven pages: "Getting Here" (directions, parking, shuttle schedule, accessibility info) and "Daily Schedule" (weekly grid of recurring classes and activities by day/time).

#### Scenario: Getting Here page shows transportation info
- **WHEN** a visitor navigates to the "Getting Here" page
- **THEN** they see directions, parking info, shuttle schedule, and accessibility accommodations

#### Scenario: Daily Schedule shows weekly grid
- **WHEN** a visitor navigates to the "Daily Schedule" page
- **THEN** a table or grid displays recurring classes and activities organized by day and time

### Requirement: Membership tiers
The seed SHALL define 4 membership tiers: Guest (free, view-only), Member ($0, registered, can RSVP and post), Volunteer (member + committee roles), Board (admin access).

#### Scenario: Tiers reflect senior center model
- **WHEN** an admin views membership tier configuration
- **THEN** 4 tiers are defined with appropriate permissions and descriptions
