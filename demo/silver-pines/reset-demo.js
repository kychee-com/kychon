// schedule: "0 * * * *"
// Reset demo site to seed state — auto-generated, do not edit manually
// Regenerate with: node scripts/generate-reset-function.js <seed.sql>
import { db } from 'run402-functions';

const SEED_SQL = `-- ============================================
-- Wild Lychee — Silver Pines Demo Seed (idempotent)
-- "Silver Pines Senior Center — Asheville, NC"
-- Active-adult community center, accessibility-first
-- ============================================

-- ============================================
-- 1. SITE CONFIG
-- ============================================

-- Branding
INSERT INTO site_config (key, value, category) VALUES
  ('site_name', '"Silver Pines Senior Center"', 'branding'),
  ('site_tagline', '"Where every day brings something new"', 'branding'),
  ('site_description', '"Silver Pines is Asheville''s favorite community center for active adults. From tai chi to tech help, watercolors to book clubs, there''s always something happening. Join your neighbors for classes, events, and great conversation in the heart of the Blue Ridge."', 'branding'),
  ('logo_url', '"/assets/logo.png"', 'branding'),
  ('favicon_url', '"/assets/logo.png"', 'branding')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- Theme (sage green + warm cream + amber)
INSERT INTO site_config (key, value, category) VALUES
  ('theme', '{
    "primary": "#5B7F5E",
    "primary_hover": "#4A6B4D",
    "bg": "#FFFDF7",
    "surface": "#F5F0E8",
    "text": "#2C2C2C",
    "text_muted": "#5A5A5A",
    "border": "#D5CFC4",
    "font_heading": "Merriweather",
    "font_body": "Source Sans 3",
    "radius": "0.75rem",
    "max_width": "68rem"
  }', 'theme')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- Feature flags
INSERT INTO site_config (key, value, category) VALUES
  ('feature_events', 'true', 'features'),
  ('feature_forum', 'true', 'features'),
  ('feature_directory', 'true', 'features'),
  ('feature_resources', 'true', 'features'),
  ('feature_blog', 'false', 'features'),
  ('feature_committees', 'true', 'features'),
  ('feature_reactions', 'true', 'features'),
  ('feature_activity_feed', 'true', 'features'),
  ('feature_ai_moderation', 'false', 'features'),
  ('feature_ai_translation', 'false', 'features'),
  ('feature_ai_newsletter', 'false', 'features'),
  ('feature_ai_insights', 'false', 'features'),
  ('feature_ai_onboarding', 'false', 'features'),
  ('feature_ai_event_recaps', 'false', 'features'),
  ('directory_public', 'false', 'features'),
  ('signup_mode', '"open"', 'features'),
  ('demo_mode', 'true', 'features')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- Navigation
INSERT INTO site_config (key, value, category) VALUES
  ('nav', '[
    {"label": "Home", "href": "/", "icon": "home", "public": true},
    {"label": "Daily Schedule", "href": "/page.html?slug=daily-schedule", "icon": "calendar", "public": true},
    {"label": "Getting Here", "href": "/page.html?slug=getting-here", "icon": "map", "public": true},
    {"label": "Our Members", "href": "/members.html", "icon": "users", "public": true},
    {"label": "Events", "href": "/events.html", "icon": "calendar", "feature": "feature_events"},
    {"label": "Resources", "href": "/resources.html", "icon": "book-open", "feature": "feature_resources"},
    {"label": "Forum", "href": "/forum.html", "icon": "message-circle", "feature": "feature_forum"},
    {"label": "Committees", "href": "/committees.html", "icon": "briefcase", "feature": "feature_committees"},
    {"label": "Announcements", "href": "/#announcements-section", "icon": "bell", "public": true},
    {"label": "Dashboard", "href": "/admin.html", "icon": "bar-chart-2", "admin": true},
    {"label": "Members", "href": "/admin-members.html", "icon": "users", "admin": true},
    {"label": "Settings", "href": "/admin-settings.html", "icon": "settings", "admin": true}
  ]', 'nav')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- ============================================
-- 2. MEMBERSHIP TIERS
-- ============================================

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Guest', 'Visitors and prospective members', ARRAY['View events', 'Browse resources', 'Visit the center'], 'Free', 1, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Guest');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Member', 'Registered community members', ARRAY['RSVP to events', 'Forum access', 'Member directory', 'Class enrollment', 'Newsletter'], 'Free', 2, true
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Member');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Volunteer', 'Members who give their time to help others', ARRAY['All member benefits', 'Committee membership', 'Volunteer recognition', 'Priority class enrollment'], 'Free', 3, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Volunteer');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Board', 'Center leadership and administration', ARRAY['Full access', 'Admin tools', 'Board meetings', 'Budget oversight'], 'By appointment', 4, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Board');

-- ============================================
-- 3. MEMBER CUSTOM FIELDS
-- ============================================

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'phone', 'Phone Number', 'text', NULL, false, false, 1
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'phone');

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'neighborhood', 'Neighborhood', 'text', NULL, false, true, 2
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'neighborhood');

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'interests', 'Interests', 'multi_select', '["gardening", "reading", "painting", "tai chi", "cooking", "walking", "crafts", "music", "technology", "cards"]', false, true, 3
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'interests');

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'emergency_contact', 'Emergency Contact', 'text', NULL, false, false, 4
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'emergency_contact');

-- ============================================
-- 4. MEMBERS (22 people)
-- ============================================

-- Member 1: Admin / Board Chair
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'helen.crawford@silverpines.org', 'Helen Crawford', '/assets/avatar-01.jpg',
  'Retired school principal and founding board chair. I started Silver Pines because every senior deserves a place to learn, laugh, and belong. Proud grandmother of five.',
  (SELECT id FROM membership_tiers WHERE name = 'Board'), 'admin', 'active',
  '{"phone": "828-555-0101", "neighborhood": "Montford", "interests": ["reading", "gardening", "walking"]}',
  now() - interval '1095 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'helen.crawford@silverpines.org');

-- Member 2: Admin / Board
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'james.whitfield@gmail.com', 'James Whitfield', '/assets/avatar-02.jpg',
  'Retired CPA and board treasurer. I keep our books balanced and our programs funded. When I''m not crunching numbers, you''ll find me on the nature trails.',
  (SELECT id FROM membership_tiers WHERE name = 'Board'), 'admin', 'active',
  '{"phone": "828-555-0102", "neighborhood": "North Asheville", "interests": ["walking", "reading", "cards"]}',
  now() - interval '1050 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'james.whitfield@gmail.com');

-- Member 3: Volunteer
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'rosa.martinez@outlook.com', 'Rosa Martinez', '/assets/avatar-03.jpg',
  'Former nurse, now full-time volunteer. I run our wellness check-ins and help coordinate the flu shot clinics. Health is wealth!',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'moderator', 'active',
  '{"phone": "828-555-0103", "neighborhood": "West Asheville", "interests": ["walking", "cooking", "gardening"]}',
  now() - interval '900 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'rosa.martinez@outlook.com');

-- Member 4: Volunteer
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'robert.chen@gmail.com', 'Robert Chen', '/assets/avatar-04.jpg',
  'Retired software engineer. I run the Tech Buddies program — helping fellow seniors with tablets, phones, and video calls. Patience is my superpower.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'moderator', 'active',
  '{"phone": "828-555-0104", "neighborhood": "Kenilworth", "interests": ["technology", "tai chi", "reading"]}',
  now() - interval '850 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'robert.chen@gmail.com');

-- Member 5: Volunteer
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'dorothy.banks@yahoo.com', 'Dorothy Banks', '/assets/avatar-05.jpg',
  'Master gardener and chair of our Garden Committee. Come visit our raised beds out back — we grew 200 pounds of tomatoes last summer!',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'active',
  '{"phone": "828-555-0105", "neighborhood": "Biltmore Forest", "interests": ["gardening", "cooking", "crafts"]}',
  now() - interval '800 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'dorothy.banks@yahoo.com');

-- Member 6: Volunteer
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'frank.oconnor@gmail.com', 'Frank O''Connor', '/assets/avatar-06.jpg',
  'Retired bus driver, now I drive our Silver Pines shuttle. Getting folks to their appointments and to the center is my way of giving back.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'active',
  '{"phone": "828-555-0106", "neighborhood": "Arden", "interests": ["cards", "walking", "music"]}',
  now() - interval '750 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'frank.oconnor@gmail.com');

-- Member 7: Volunteer
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'margaret.johnson@hotmail.com', 'Margaret Johnson', '/assets/avatar-07.jpg',
  'Retired art teacher. I lead our watercolor class every Wednesday. Watching people discover their creative side at 70 is pure joy.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'active',
  '{"phone": "828-555-0107", "neighborhood": "Oakley", "interests": ["painting", "crafts", "reading"]}',
  now() - interval '700 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'margaret.johnson@hotmail.com');

-- Member 8: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'william.thompson@gmail.com', 'William Thompson', '/assets/avatar-08.jpg',
  'Korean War veteran and history buff. I love the book club and Friday movie nights. Silver Pines keeps me young.',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0108", "neighborhood": "Haw Creek", "interests": ["reading", "cards", "walking"]}',
  now() - interval '650 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'william.thompson@gmail.com');

-- Member 9: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'betty.williams@outlook.com', 'Betty Williams', '/assets/avatar-09.jpg',
  'Quilter and pie baker extraordinaire. If there''s a potluck, I''m bringing my famous blueberry cobbler. Come to the Social Events committee!',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0109", "neighborhood": "Swannanoa", "interests": ["crafts", "cooking", "gardening"]}',
  now() - interval '600 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'betty.williams@outlook.com');

-- Member 10: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'george.nakamura@gmail.com', 'George Nakamura', '/assets/avatar-10.jpg',
  'Tai chi instructor for 20 years. I lead our Tuesday and Thursday morning sessions. Balance and breath — that''s the secret to aging well.',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0110", "neighborhood": "Montford", "interests": ["tai chi", "gardening", "walking"]}',
  now() - interval '550 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'george.nakamura@gmail.com');

-- Member 11: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'shirley.davis@yahoo.com', 'Shirley Davis', '/assets/avatar-11.jpg',
  'Former choir director at First Baptist. I organize our monthly sing-alongs and help pick movies for Friday Movie Night.',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0111", "neighborhood": "East Asheville", "interests": ["music", "reading", "cooking"]}',
  now() - interval '500 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'shirley.davis@yahoo.com');

-- Member 12: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'harold.peterson@gmail.com', 'Harold Peterson', '/assets/avatar-12.jpg',
  'Woodworker and handyman. I built the birdhouses in the garden and fix anything that breaks around the center. Retirement is busier than work!',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0112", "neighborhood": "Weaverville", "interests": ["crafts", "gardening", "walking"]}',
  now() - interval '480 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'harold.peterson@gmail.com');

-- Member 13: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'grace.lee@outlook.com', 'Grace Lee', '/assets/avatar-13.jpg',
  'Recently moved from Charlotte to be closer to grandkids. Silver Pines helped me find friends and purpose in my new city. Love the watercolor class!',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0113", "neighborhood": "South Asheville", "interests": ["painting", "tai chi", "cooking"]}',
  now() - interval '120 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'grace.lee@outlook.com');

-- Member 14: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'thomas.brown@gmail.com', 'Thomas Brown', '/assets/avatar-14.jpg',
  'Retired firefighter, 30 years BFD. I volunteer for the Transportation Committee — no one should miss a doctor''s appointment for lack of a ride.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'active',
  '{"phone": "828-555-0114", "neighborhood": "Black Mountain", "interests": ["walking", "cards", "music"]}',
  now() - interval '400 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'thomas.brown@gmail.com');

-- Member 15: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'evelyn.wright@yahoo.com', 'Evelyn Wright', '/assets/avatar-15.jpg',
  'Retired librarian. I curate our little lending library and lead the Thursday Book Club. Currently reading: "Demon Copperhead" by Barbara Kingsolver.',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0115", "neighborhood": "North Asheville", "interests": ["reading", "walking", "crafts"]}',
  now() - interval '350 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'evelyn.wright@yahoo.com');

-- Member 16: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'arthur.williams@gmail.com', 'Arthur Williams', '/assets/avatar-16.jpg',
  'Vietnam vet and amateur astronomer. I set up my telescope on clear nights and anyone''s welcome to look. Also a mean bridge player.',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0116", "neighborhood": "Montford", "interests": ["cards", "reading", "technology"]}',
  now() - interval '300 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'arthur.williams@gmail.com');

-- Member 17: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'mary.jackson@outlook.com', 'Mary Jackson', '/assets/avatar-17.jpg',
  'Church organist for 40 years. I teach piano basics here and love seeing folks who thought they couldn''t play discover they can.',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0117", "neighborhood": "West Asheville", "interests": ["music", "gardening", "cooking"]}',
  now() - interval '260 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'mary.jackson@outlook.com');

-- Member 18: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'charles.robinson@gmail.com', 'Charles Robinson', '/assets/avatar-18.jpg',
  'Retired postal carrier — I know every street in Asheville! Now I enjoy tai chi, the garden, and finally learning to paint.',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0118", "neighborhood": "Leicester", "interests": ["tai chi", "painting", "gardening"]}',
  now() - interval '220 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'charles.robinson@gmail.com');

-- Member 19: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'nancy.allen@yahoo.com', 'Nancy Allen', '/assets/avatar-19.jpg',
  'Former restaurant owner, now I teach the cooking class. Last month we made biscuits from scratch — you should have seen the smiles!',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0119", "neighborhood": "Biltmore Village", "interests": ["cooking", "gardening", "reading"]}',
  now() - interval '180 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'nancy.allen@yahoo.com');

-- Member 20: Member
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'richard.harris@gmail.com', 'Richard Harris', '/assets/avatar-20.jpg',
  'Recovering workaholic. After 40 years in banking, Silver Pines taught me it''s OK to slow down. The garden committee is my therapy.',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0120", "neighborhood": "Fairview", "interests": ["gardening", "walking", "cards"]}',
  now() - interval '150 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'richard.harris@gmail.com');

-- Member 21: Member (new)
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'patricia.nguyen@outlook.com', 'Patricia Nguyen', '/assets/avatar-21.jpg',
  'Just retired from teaching ESL. Excited to try tai chi and the watercolor class. My grandkids say I need more hobbies!',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0121", "neighborhood": "Candler", "interests": ["tai chi", "painting", "reading"]}',
  now() - interval '30 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'patricia.nguyen@outlook.com');

-- Member 22: Member (new)
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'samuel.washington@gmail.com', 'Samuel Washington', '/assets/avatar-22.jpg',
  'Moved here from Atlanta last month. Looking forward to the book club and making new friends. Someone told me the movie nights are great!',
  (SELECT id FROM membership_tiers WHERE name = 'Member'), 'member', 'active',
  '{"phone": "828-555-0122", "neighborhood": "Asheville", "interests": ["reading", "music", "walking"]}',
  now() - interval '14 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'samuel.washington@gmail.com');

-- ============================================
-- 5. COMMITTEES
-- ============================================

INSERT INTO committees (name, description)
SELECT 'Wellness Committee', 'Coordinates health screenings, flu shot clinics, wellness check-ins, and partners with local healthcare providers to keep our community healthy. Chair: Rosa Martinez.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Wellness Committee');

INSERT INTO committees (name, description)
SELECT 'Social Events Committee', 'Plans potlucks, holiday parties, movie nights, outings, and other fun gatherings that bring our community together. Chair: Betty Williams.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Social Events Committee');

INSERT INTO committees (name, description)
SELECT 'Garden Committee', 'Manages our raised-bed community garden, organizes seasonal planting, coordinates the harvest share, and maintains the outdoor spaces. Chair: Dorothy Banks.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Garden Committee');

INSERT INTO committees (name, description)
SELECT 'Tech Buddies', 'Provides one-on-one technology help with tablets, smartphones, video calling, email, and internet safety. No question is too basic! Chair: Robert Chen.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Tech Buddies');

INSERT INTO committees (name, description)
SELECT 'Transportation Committee', 'Coordinates the Silver Pines shuttle schedule, volunteer driver program, and helps members get to medical appointments and errands. Chair: Frank O''Connor.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Transportation Committee');

-- Committee memberships
INSERT INTO committee_members (committee_id, member_id)
SELECT c.id, m.id FROM committees c, members m
WHERE c.name = 'Wellness Committee' AND m.email IN ('rosa.martinez@outlook.com', 'helen.crawford@silverpines.org', 'george.nakamura@gmail.com', 'nancy.allen@yahoo.com')
ON CONFLICT DO NOTHING;

INSERT INTO committee_members (committee_id, member_id)
SELECT c.id, m.id FROM committees c, members m
WHERE c.name = 'Social Events Committee' AND m.email IN ('betty.williams@outlook.com', 'shirley.davis@yahoo.com', 'margaret.johnson@hotmail.com', 'mary.jackson@outlook.com', 'nancy.allen@yahoo.com')
ON CONFLICT DO NOTHING;

INSERT INTO committee_members (committee_id, member_id)
SELECT c.id, m.id FROM committees c, members m
WHERE c.name = 'Garden Committee' AND m.email IN ('dorothy.banks@yahoo.com', 'harold.peterson@gmail.com', 'richard.harris@gmail.com', 'charles.robinson@gmail.com', 'grace.lee@outlook.com')
ON CONFLICT DO NOTHING;

INSERT INTO committee_members (committee_id, member_id)
SELECT c.id, m.id FROM committees c, members m
WHERE c.name = 'Tech Buddies' AND m.email IN ('robert.chen@gmail.com', 'arthur.williams@gmail.com', 'james.whitfield@gmail.com', 'patricia.nguyen@outlook.com')
ON CONFLICT DO NOTHING;

INSERT INTO committee_members (committee_id, member_id)
SELECT c.id, m.id FROM committees c, members m
WHERE c.name = 'Transportation Committee' AND m.email IN ('frank.oconnor@gmail.com', 'thomas.brown@gmail.com', 'william.thompson@gmail.com')
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. EVENTS (6 upcoming + 6 past)
-- ============================================

-- Upcoming events
INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Morning Tai Chi with George',
  'Start your day with gentle movement and deep breathing. All levels welcome — George adapts every pose. Wear comfortable clothes and flat shoes. Meet in the main hall.',
  now() + interval '1 day' + time '09:00', now() + interval '1 day' + time '10:00',
  'Main Hall', '/assets/event-tai-chi.jpg', (SELECT id FROM members WHERE email = 'george.nakamura@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Morning Tai Chi with George' AND starts_at > now());

INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Watercolor Wednesday',
  'This week: painting autumn leaves! Margaret supplies all materials. Beginners especially welcome — we learn by doing, not by being perfect. Bring a smock or old shirt.',
  now() + interval '3 days' + time '14:00', now() + interval '3 days' + time '16:00',
  'Art Room', '/assets/event-watercolor.jpg', (SELECT id FROM members WHERE email = 'margaret.johnson@hotmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Watercolor Wednesday' AND starts_at > now());

INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Tech Help Desk — Drop In',
  'Bring your tablet, phone, laptop, or questions! Our Tech Buddies volunteers offer patient, friendly one-on-one help. This week: setting up video calls with family.',
  now() + interval '5 days' + time '10:00', now() + interval '5 days' + time '12:00',
  'Computer Room', '/assets/event-tech-help.jpg', (SELECT id FROM members WHERE email = 'robert.chen@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Tech Help Desk — Drop In' AND starts_at > now());

INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Thursday Book Club',
  'We''re reading "Demon Copperhead" by Barbara Kingsolver — perfect for our mountain setting! Evelyn leads the discussion. New readers always welcome. Coffee and cookies provided.',
  now() + interval '7 days' + time '15:00', now() + interval '7 days' + time '16:30',
  'Reading Room', '/assets/event-book-club.jpg', (SELECT id FROM members WHERE email = 'evelyn.wright@yahoo.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Thursday Book Club' AND starts_at > now());

INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Medicare Open Enrollment Info Session',
  'Confused about Medicare options? Our guest speaker from the NC Department of Insurance will explain your choices and answer questions. Bring your current plan documents.',
  now() + interval '10 days' + time '13:00', now() + interval '10 days' + time '14:30',
  'Main Hall', '/assets/event-medicare.jpg', (SELECT id FROM members WHERE email = 'helen.crawford@silverpines.org')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Medicare Open Enrollment Info Session' AND starts_at > now());

INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Friday Movie Night: "The Best Exotic Marigold Hotel"',
  'Popcorn, lemonade, and a feel-good film on the big screen! Shirley picked this month''s movie. Bring a blanket if you like — the air conditioning is strong!',
  now() + interval '12 days' + time '18:30', now() + interval '12 days' + time '20:30',
  'Main Hall', '/assets/event-movie-night.jpg', (SELECT id FROM members WHERE email = 'shirley.davis@yahoo.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title LIKE 'Friday Movie Night%' AND starts_at > now());

-- Past events
INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Spring Garden Party',
  'What a beautiful day! We planted marigolds, shared seedlings, and Betty''s strawberry shortcake was the talk of the afternoon. 40+ members attended!',
  now() - interval '14 days' + time '10:00', now() - interval '14 days' + time '13:00',
  'Garden & Patio', '/assets/event-garden.jpg', (SELECT id FROM members WHERE email = 'dorothy.banks@yahoo.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Spring Garden Party');

INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Annual Health Fair',
  'Free blood pressure checks, hearing tests, fall risk assessments, and flu shots. Thanks to our partners at Mission Hospital and the Wellness Committee for organizing!',
  now() - interval '21 days' + time '09:00', now() - interval '21 days' + time '15:00',
  'Main Hall', '/assets/event-health-fair.jpg', (SELECT id FROM members WHERE email = 'rosa.martinez@outlook.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Annual Health Fair');

INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Holiday Potluck & Sing-Along',
  'Our biggest event of the season! 60+ members brought dishes from around the world. Shirley led carols and George surprised us with a harmonica solo.',
  now() - interval '35 days' + time '17:00', now() - interval '35 days' + time '20:00',
  'Main Hall & Patio', '/assets/event-potluck.jpg', (SELECT id FROM members WHERE email = 'shirley.davis@yahoo.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Holiday Potluck & Sing-Along');

INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Blue Ridge Nature Walk',
  'A gentle 2-mile walk on the Botanical Gardens trail. Harold pointed out every bird species and Thomas told stories about the old fire lookout. Perfect fall weather.',
  now() - interval '42 days' + time '10:00', now() - interval '42 days' + time '12:00',
  'NC Arboretum (carpool)', '/assets/event-nature-walk.jpg', (SELECT id FROM members WHERE email = 'thomas.brown@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Blue Ridge Nature Walk');

INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Craft Fair & Bake Sale',
  'Members sold handmade quilts, birdhouses, paintings, and baked goods. We raised $840 for the Transportation Fund! Thank you to everyone who contributed.',
  now() - interval '50 days' + time '10:00', now() - interval '50 days' + time '15:00',
  'Main Hall', '/assets/event-craft-fair.jpg', (SELECT id FROM members WHERE email = 'betty.williams@outlook.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Craft Fair & Bake Sale');

INSERT INTO events (title, description, starts_at, ends_at, location, image_url, created_by)
SELECT 'Volunteer Appreciation Luncheon',
  'Honoring our amazing volunteers! Helen presented certificates and Frank surprised everyone with his famous cornbread. You all make Silver Pines what it is.',
  now() - interval '60 days' + time '12:00', now() - interval '60 days' + time '14:00',
  'Main Hall', '/assets/event-volunteer.jpg', (SELECT id FROM members WHERE email = 'helen.crawford@silverpines.org')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Volunteer Appreciation Luncheon');

-- RSVPs for upcoming events (make them look attended!)
INSERT INTO event_rsvps (event_id, member_id, status, created_at)
SELECT e.id, m.id, 'going', now() - interval '2 days'
FROM events e, members m
WHERE e.title = 'Morning Tai Chi with George' AND m.email IN ('grace.lee@outlook.com', 'charles.robinson@gmail.com', 'patricia.nguyen@outlook.com', 'helen.crawford@silverpines.org', 'george.nakamura@gmail.com', 'rosa.martinez@outlook.com')
ON CONFLICT (event_id, member_id) DO NOTHING;

INSERT INTO event_rsvps (event_id, member_id, status, created_at)
SELECT e.id, m.id, 'going', now() - interval '3 days'
FROM events e, members m
WHERE e.title = 'Watercolor Wednesday' AND m.email IN ('margaret.johnson@hotmail.com', 'grace.lee@outlook.com', 'charles.robinson@gmail.com', 'betty.williams@outlook.com', 'nancy.allen@yahoo.com')
ON CONFLICT (event_id, member_id) DO NOTHING;

INSERT INTO event_rsvps (event_id, member_id, status, created_at)
SELECT e.id, m.id, 'going', now() - interval '1 day'
FROM events e, members m
WHERE e.title LIKE 'Tech Help Desk%' AND m.email IN ('robert.chen@gmail.com', 'arthur.williams@gmail.com', 'mary.jackson@outlook.com', 'harold.peterson@gmail.com', 'patricia.nguyen@outlook.com', 'samuel.washington@gmail.com', 'evelyn.wright@yahoo.com')
ON CONFLICT (event_id, member_id) DO NOTHING;

INSERT INTO event_rsvps (event_id, member_id, status, created_at)
SELECT e.id, m.id, 'going', now() - interval '4 days'
FROM events e, members m
WHERE e.title = 'Thursday Book Club' AND m.email IN ('evelyn.wright@yahoo.com', 'william.thompson@gmail.com', 'helen.crawford@silverpines.org', 'arthur.williams@gmail.com', 'shirley.davis@yahoo.com')
ON CONFLICT (event_id, member_id) DO NOTHING;

INSERT INTO event_rsvps (event_id, member_id, status, created_at)
SELECT e.id, m.id, 'going', now() - interval '2 days'
FROM events e, members m
WHERE e.title = 'Medicare Open Enrollment Info Session' AND m.email IN ('helen.crawford@silverpines.org', 'james.whitfield@gmail.com', 'rosa.martinez@outlook.com', 'william.thompson@gmail.com', 'betty.williams@outlook.com', 'dorothy.banks@yahoo.com', 'frank.oconnor@gmail.com', 'thomas.brown@gmail.com', 'shirley.davis@yahoo.com', 'richard.harris@gmail.com')
ON CONFLICT (event_id, member_id) DO NOTHING;

INSERT INTO event_rsvps (event_id, member_id, status, created_at)
SELECT e.id, m.id, 'going', now() - interval '5 days'
FROM events e, members m
WHERE e.title LIKE 'Friday Movie Night%' AND m.email IN ('shirley.davis@yahoo.com', 'william.thompson@gmail.com', 'betty.williams@outlook.com', 'frank.oconnor@gmail.com', 'mary.jackson@outlook.com', 'evelyn.wright@yahoo.com', 'harold.peterson@gmail.com', 'grace.lee@outlook.com', 'samuel.washington@gmail.com', 'nancy.allen@yahoo.com', 'arthur.williams@gmail.com', 'thomas.brown@gmail.com')
ON CONFLICT (event_id, member_id) DO NOTHING;

-- Backfill image_url on existing events (idempotent)
UPDATE events SET image_url = '/assets/event-tai-chi.jpg' WHERE title = 'Morning Tai Chi with George' AND image_url IS NULL;
UPDATE events SET image_url = '/assets/event-watercolor.jpg' WHERE title = 'Watercolor Wednesday' AND image_url IS NULL;
UPDATE events SET image_url = '/assets/event-tech-help.jpg' WHERE title LIKE 'Tech Help Desk%' AND image_url IS NULL;
UPDATE events SET image_url = '/assets/event-book-club.jpg' WHERE title = 'Thursday Book Club' AND image_url IS NULL;
UPDATE events SET image_url = '/assets/event-movie-night.jpg' WHERE title LIKE 'Friday Movie Night%' AND image_url IS NULL;
UPDATE events SET image_url = '/assets/event-garden.jpg' WHERE title = 'Spring Garden Party' AND image_url IS NULL;
UPDATE events SET image_url = '/assets/event-potluck.jpg' WHERE title = 'Holiday Potluck & Sing-Along' AND image_url IS NULL;
UPDATE events SET image_url = '/assets/event-nature-walk.jpg' WHERE title = 'Blue Ridge Nature Walk' AND image_url IS NULL;
UPDATE events SET image_url = '/assets/event-volunteer.jpg' WHERE title = 'Volunteer Appreciation Luncheon';
UPDATE events SET image_url = '/assets/event-medicare.jpg' WHERE title = 'Medicare Open Enrollment Info Session';
UPDATE events SET image_url = '/assets/event-health-fair.jpg' WHERE title = 'Annual Health Fair';
UPDATE events SET image_url = '/assets/event-craft-fair.jpg' WHERE title = 'Craft Fair & Bake Sale';

-- ============================================
-- 7. RESOURCES
-- ============================================

INSERT INTO resources (title, description, category, file_url, uploaded_by)
SELECT 'Silver Pines Shuttle Schedule',
  'Current shuttle routes and times. The shuttle runs Mon-Fri and stops at all major medical centers, grocery stores, and the library. Call Frank to arrange a ride.',
  'Transportation', '/assets/shuttle-schedule.pdf',
  (SELECT id FROM members WHERE email = 'frank.oconnor@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Silver Pines Shuttle Schedule');

INSERT INTO resources (title, description, category, file_url, uploaded_by)
SELECT 'Volunteer Driver Sign-Up',
  'Want to help a neighbor get to an appointment? Sign up to be a volunteer driver. Background check required, mileage reimbursed.',
  'Transportation', '/assets/driver-signup.pdf',
  (SELECT id FROM members WHERE email = 'thomas.brown@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Volunteer Driver Sign-Up');

INSERT INTO resources (title, description, category, file_url, uploaded_by)
SELECT 'Medicare Basics Guide',
  'A plain-language guide to Medicare Parts A, B, C, and D. Covers enrollment periods, costs, and how to compare plans. Updated for 2026.',
  'Health', '/assets/medicare-guide.pdf',
  (SELECT id FROM members WHERE email = 'rosa.martinez@outlook.com')
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Medicare Basics Guide');

INSERT INTO resources (title, description, category, file_url, uploaded_by)
SELECT 'Flu Shot & Vaccine Schedule',
  'Dates and locations for free flu shots, COVID boosters, and shingles vaccines through our partnership with Mission Hospital.',
  'Health', '/assets/vaccine-schedule.pdf',
  (SELECT id FROM members WHERE email = 'rosa.martinez@outlook.com')
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Flu Shot & Vaccine Schedule');

INSERT INTO resources (title, description, category, file_url, uploaded_by)
SELECT 'Emergency Contact Card (Printable)',
  'Fill in your emergency contacts, medications, allergies, and doctor info. Print it, fold it into your wallet. Every member should have one.',
  'Health', '/assets/emergency-card.pdf',
  (SELECT id FROM members WHERE email = 'helen.crawford@silverpines.org')
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Emergency Contact Card (Printable)');

INSERT INTO resources (title, description, category, file_url, uploaded_by)
SELECT 'Weekly Meal Program Menu',
  'This week''s lunch menu for our Mon/Wed/Fri meal program. $3 suggested donation. Vegetarian options available. Meals served 11:30am-12:30pm.',
  'Meals', '/assets/weekly-menu.pdf',
  (SELECT id FROM members WHERE email = 'nancy.allen@yahoo.com')
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Weekly Meal Program Menu');

INSERT INTO resources (title, description, category, file_url, uploaded_by)
SELECT 'Meal Program Enrollment Form',
  'Sign up for our subsidized lunch program. Available to all members 60+. Income-based sliding scale. No one turned away.',
  'Meals', '/assets/meal-enrollment.pdf',
  (SELECT id FROM members WHERE email = 'nancy.allen@yahoo.com')
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Meal Program Enrollment Form');

INSERT INTO resources (title, description, category, file_url, uploaded_by)
SELECT 'Tablet Basics: Getting Started',
  'A step-by-step guide to using your tablet — turning it on, connecting to WiFi, downloading apps, and making video calls. Large print, lots of screenshots.',
  'Technology', '/assets/tablet-basics.pdf',
  (SELECT id FROM members WHERE email = 'robert.chen@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Tablet Basics: Getting Started');

INSERT INTO resources (title, description, category, file_url, uploaded_by)
SELECT 'Video Calling Guide (FaceTime & Zoom)',
  'How to set up and use FaceTime (iPhone/iPad) and Zoom (any device) to call family and friends. Includes troubleshooting common problems.',
  'Technology', '/assets/video-calling-guide.pdf',
  (SELECT id FROM members WHERE email = 'robert.chen@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Video Calling Guide (FaceTime & Zoom)');

INSERT INTO resources (title, description, category, file_url, uploaded_by)
SELECT 'Internet Safety for Seniors',
  'How to spot scam emails, protect your passwords, and shop safely online. Written by our Tech Buddies in plain language. Share with friends and family.',
  'Technology', '/assets/internet-safety.pdf',
  (SELECT id FROM members WHERE email = 'arthur.williams@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Internet Safety for Seniors');

INSERT INTO resources (title, description, category, file_url, uploaded_by)
SELECT 'Garden Plot Map & Guidelines',
  'Map of our 12 raised beds with plot assignments. Includes watering schedule, composting rules, and harvest-sharing guidelines.',
  'Garden', '/assets/garden-map.pdf',
  (SELECT id FROM members WHERE email = 'dorothy.banks@yahoo.com')
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Garden Plot Map & Guidelines');

-- ============================================
-- 8. FORUM
-- ============================================

-- Categories
INSERT INTO forum_categories (name, description, position)
SELECT 'Health & Wellness', 'Share health tips, ask questions about Medicare, discuss exercise and nutrition', 1
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Health & Wellness');

INSERT INTO forum_categories (name, description, position)
SELECT 'Activities & Hobbies', 'Talk about classes, share project photos, suggest new activities', 2
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Activities & Hobbies');

INSERT INTO forum_categories (name, description, position)
SELECT 'Tech Help', 'Ask tech questions, share tips, and help each other with devices', 3
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Tech Help');

-- Forum topics and replies
INSERT INTO forum_topics (title, body, category_id, author_id, created_at)
SELECT 'Best exercises for bad knees?',
  'My knees have been bothering me lately and I want to stay active. What do you all recommend? I''ve been doing tai chi but wondering about other options.',
  (SELECT id FROM forum_categories WHERE name = 'Health & Wellness'),
  (SELECT id FROM members WHERE email = 'william.thompson@gmail.com'),
  now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Best exercises for bad knees?');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Best exercises for bad knees?'),
  'Water aerobics at the YMCA changed my life! The pool takes all the pressure off your joints. I go twice a week and my knees feel so much better.',
  (SELECT id FROM members WHERE email = 'rosa.martinez@outlook.com'),
  now() - interval '10 days' + interval '3 hours'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'Water aerobics at the YMCA%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Best exercises for bad knees?'),
  'Tai chi is excellent for knees, William! The slow movements actually strengthen the muscles around the joint. Come to my Tuesday class and I''ll show you some modifications.',
  (SELECT id FROM members WHERE email = 'george.nakamura@gmail.com'),
  now() - interval '9 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'Tai chi is excellent for knees%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Best exercises for bad knees?'),
  'I had the same problem! My doctor recommended chair yoga. There are great videos on YouTube — Robert from Tech Buddies helped me set it up on my tablet.',
  (SELECT id FROM members WHERE email = 'grace.lee@outlook.com'),
  now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'I had the same problem! My doctor recommended chair yoga%');

INSERT INTO forum_topics (title, body, category_id, author_id, created_at)
SELECT 'Anyone interested in a walking group?',
  'I walk the Montford loop every morning at 7:30. Would love some company! We could do different routes each day. Maybe end at the French Broad Co-op for coffee?',
  (SELECT id FROM forum_categories WHERE name = 'Health & Wellness'),
  (SELECT id FROM members WHERE email = 'thomas.brown@gmail.com'),
  now() - interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Anyone interested in a walking group?');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Anyone interested in a walking group?'),
  'Count me in! 7:30 is perfect. I know some beautiful routes through the Botanical Gardens too.',
  (SELECT id FROM members WHERE email = 'helen.crawford@silverpines.org'),
  now() - interval '7 days' + interval '2 hours'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'Count me in! 7:30 is perfect%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Anyone interested in a walking group?'),
  'I''d love to join but can''t do 7:30 — too early for these old bones! Any chance of a 9am group?',
  (SELECT id FROM members WHERE email = 'shirley.davis@yahoo.com'),
  now() - interval '6 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'I''d love to join but can''t do 7:30%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Anyone interested in a walking group?'),
  'We could do both! 7:30 early birds and 9:00 for folks who prefer a later start. I''ll lead the 9am group.',
  (SELECT id FROM members WHERE email = 'thomas.brown@gmail.com'),
  now() - interval '6 days' + interval '1 hour'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'We could do both! 7:30 early birds%');

INSERT INTO forum_topics (title, body, category_id, author_id, created_at)
SELECT 'Watercolor class — what to expect?',
  'I''m thinking about joining the watercolor class but I haven''t painted since grade school. Is it really for beginners? I don''t want to slow everyone down.',
  (SELECT id FROM forum_categories WHERE name = 'Activities & Hobbies'),
  (SELECT id FROM members WHERE email = 'charles.robinson@gmail.com'),
  now() - interval '12 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Watercolor class — what to expect?');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Watercolor class — what to expect?'),
  'Charles, please come! Half the class started exactly where you are. I teach technique step by step and there is absolutely no wrong way to paint. Just bring an open mind.',
  (SELECT id FROM members WHERE email = 'margaret.johnson@hotmail.com'),
  now() - interval '12 days' + interval '1 hour'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'Charles, please come! Half the class%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Watercolor class — what to expect?'),
  'I joined 4 months ago with zero experience. Now I''m painting cards for my grandkids! Margaret is the most encouraging teacher. Just show up.',
  (SELECT id FROM members WHERE email = 'grace.lee@outlook.com'),
  now() - interval '11 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'I joined 4 months ago with zero experience%');

INSERT INTO forum_topics (title, body, category_id, author_id, created_at)
SELECT 'Recipe swap — holiday favorites?',
  'The holiday potluck is coming up! Who wants to share their go-to recipe? I''m making my grandmother''s sweet potato casserole. What are you bringing?',
  (SELECT id FROM forum_categories WHERE name = 'Activities & Hobbies'),
  (SELECT id FROM members WHERE email = 'betty.williams@outlook.com'),
  now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Recipe swap — holiday favorites?');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Recipe swap — holiday favorites?'),
  'My famous blueberry cobbler, of course! The secret is a pinch of cardamom. I''ll print out copies for anyone who wants the recipe.',
  (SELECT id FROM members WHERE email = 'betty.williams@outlook.com'),
  now() - interval '5 days' + interval '30 minutes'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'My famous blueberry cobbler%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Recipe swap — holiday favorites?'),
  'I''ll bring my biscochitos — a traditional New Mexican cookie my abuela taught me. Fair warning: they disappear fast!',
  (SELECT id FROM members WHERE email = 'rosa.martinez@outlook.com'),
  now() - interval '4 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'I''ll bring my biscochitos%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Recipe swap — holiday favorites?'),
  'Making my cornbread. Don''t let anyone tell you cornbread needs sugar — that''s cake. Fight me.',
  (SELECT id FROM members WHERE email = 'frank.oconnor@gmail.com'),
  now() - interval '4 days' + interval '2 hours'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'Making my cornbread%');

INSERT INTO forum_topics (title, body, category_id, author_id, created_at)
SELECT 'How do I share photos from my phone?',
  'My daughter sent me photos of the grandkids and I want to show them to friends, but I can''t figure out how to share them. Can someone help at the next Tech Help Desk?',
  (SELECT id FROM forum_categories WHERE name = 'Tech Help'),
  (SELECT id FROM members WHERE email = 'mary.jackson@outlook.com'),
  now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'How do I share photos from my phone?');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'How do I share photos from my phone?'),
  'Absolutely, Mary! Come to the Tech Help Desk on Thursday. We''ll show you how to share photos via text, email, and even how to make a little slideshow. It''s easier than you think!',
  (SELECT id FROM members WHERE email = 'robert.chen@gmail.com'),
  now() - interval '8 days' + interval '45 minutes'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'Absolutely, Mary! Come to the Tech Help Desk%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'How do I share photos from my phone?'),
  'I had the same question last month! Robert walked me through it. Now I text photos to my sister in Florida every day. You''ll get the hang of it.',
  (SELECT id FROM members WHERE email = 'evelyn.wright@yahoo.com'),
  now() - interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'I had the same question last month! Robert%');

INSERT INTO forum_topics (title, body, category_id, author_id, created_at)
SELECT 'Is there a way to make text bigger on my iPad?',
  'The text on websites is so small I need a magnifying glass. Is there a setting to make everything bigger? I have an iPad Air.',
  (SELECT id FROM forum_categories WHERE name = 'Tech Help'),
  (SELECT id FROM members WHERE email = 'harold.peterson@gmail.com'),
  now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Is there a way to make text bigger on my iPad?');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Is there a way to make text bigger on my iPad?'),
  'Yes! Go to Settings > Display & Brightness > Text Size and drag the slider. You can also turn on Bold Text right below that. Makes a huge difference!',
  (SELECT id FROM members WHERE email = 'robert.chen@gmail.com'),
  now() - interval '3 days' + interval '1 hour'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'Yes! Go to Settings > Display%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Is there a way to make text bigger on my iPad?'),
  'And if you''re on the Silver Pines website, try the accessibility button in the top right — you can bump the font size up to 150%. Robert showed me that one!',
  (SELECT id FROM members WHERE email = 'arthur.williams@gmail.com'),
  now() - interval '2 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'And if you''re on the Silver Pines website%');

INSERT INTO forum_topics (title, body, category_id, author_id, created_at)
SELECT 'Garden plot available — who wants it?',
  'Plot #7 is open now that the Hendersons moved to Hendersonville. It''s a sunny corner spot, perfect for tomatoes. First come, first served — let me know!',
  (SELECT id FROM forum_categories WHERE name = 'Activities & Hobbies'),
  (SELECT id FROM members WHERE email = 'dorothy.banks@yahoo.com'),
  now() - interval '2 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Garden plot available — who wants it?');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Garden plot available — who wants it?'),
  'Oh! I''d love it. I''ve been wanting to grow herbs. Can I plant basil and rosemary alongside tomatoes?',
  (SELECT id FROM members WHERE email = 'nancy.allen@yahoo.com'),
  now() - interval '2 days' + interval '30 minutes'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'Oh! I''d love it. I''ve been wanting%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Garden plot available — who wants it?'),
  'Basil and tomatoes are best friends in the garden! Companion planting at its finest. It''s yours, Nancy — come grab the key from me.',
  (SELECT id FROM members WHERE email = 'dorothy.banks@yahoo.com'),
  now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE body LIKE 'Basil and tomatoes are best friends%');

-- Backfill author_name on all forum topics and replies
UPDATE forum_topics SET author_name = m.display_name FROM members m WHERE forum_topics.author_id = m.id AND forum_topics.author_name IS NULL;
UPDATE forum_replies SET author_name = m.display_name FROM members m WHERE forum_replies.author_id = m.id AND forum_replies.author_name IS NULL;

-- Backfill reply_count and last_reply_at
UPDATE forum_topics t SET
  reply_count = (SELECT count(*) FROM forum_replies r WHERE r.topic_id = t.id),
  last_reply_at = (SELECT max(created_at) FROM forum_replies r WHERE r.topic_id = t.id);

-- ============================================
-- 9. ANNOUNCEMENTS
-- ============================================

INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Welcome, Patricia and Samuel!',
  'Please join us in welcoming our two newest members: Patricia Nguyen and Samuel Washington. If you see them around the center, say hello and show them the ropes! We''re so glad you''re here.',
  (SELECT id FROM members WHERE email = 'helen.crawford@silverpines.org'),
  false, now() - interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Welcome, Patricia and Samuel!');

INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Holiday Hours: Center Closed Dec 24-26',
  'Silver Pines will be closed December 24-26 for the holidays. The shuttle will not run during this time. We reopen Thursday, December 27 at 8am. Happy holidays to all!',
  (SELECT id FROM members WHERE email = 'helen.crawford@silverpines.org'),
  true, now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title LIKE 'Holiday Hours%');

INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Parking Lot Repaving — Use Side Entrance March 15-17',
  'The front parking lot will be repaved March 15-17. Please use the side entrance off Pine Street. The shuttle will drop off at the side door. Accessible parking available on Pine Street.',
  (SELECT id FROM members WHERE email = 'james.whitfield@gmail.com'),
  true, now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title LIKE 'Parking Lot Repaving%');

INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Flu Shot Clinic — This Saturday 9am-1pm',
  'Free flu shots for all members courtesy of Mission Hospital! No appointment needed, just bring your insurance card (or come without one — we''ll take care of you). Available in the Main Hall.',
  (SELECT id FROM members WHERE email = 'rosa.martinez@outlook.com'),
  false, now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title LIKE 'Flu Shot Clinic%');

INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Garden Club Harvest: 200 lbs of Tomatoes!',
  'Our garden produced over 200 pounds of tomatoes this season! Dorothy and the Garden Committee donated the surplus to MANNA FoodBank. Next year''s goal: 300 lbs. Want to help? Plot #7 is open!',
  (SELECT id FROM members WHERE email = 'dorothy.banks@yahoo.com'),
  false, now() - interval '14 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title LIKE 'Garden Club Harvest%');

INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Photo Contest Winners Announced!',
  'Congratulations to our "Beautiful Asheville" photo contest winners! 1st place: Margaret Johnson (sunrise over the Parkway), 2nd: Thomas Brown (fall colors at Craggy Gardens), 3rd: Grace Lee (downtown farmers market). Photos displayed in the Main Hall all month.',
  (SELECT id FROM members WHERE email = 'shirley.davis@yahoo.com'),
  false, now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title LIKE 'Photo Contest Winners%');

INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'New Tech Help Hours — Now Twice a Week!',
  'Due to popular demand, Tech Buddies is expanding! We now offer drop-in tech help every Tuesday AND Thursday from 10am-12pm. Big thanks to Robert, Arthur, and our new volunteer Patricia for making this possible.',
  (SELECT id FROM members WHERE email = 'robert.chen@gmail.com'),
  false, now() - interval '12 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title LIKE 'New Tech Help Hours%');

INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Craft Fair Raised $840 for Transportation Fund!',
  'Thank you to everyone who bought and sold at last month''s Craft Fair & Bake Sale! We raised $840, all going to the Transportation Fund to keep our shuttle running. Betty''s pies alone brought in $120!',
  (SELECT id FROM members WHERE email = 'betty.williams@outlook.com'),
  false, now() - interval '25 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title LIKE 'Craft Fair Raised%');

-- ============================================
-- 10. CUSTOM PAGES
-- ============================================

INSERT INTO pages (slug, title, published) VALUES
  ('getting-here', 'Getting Here', true),
  ('daily-schedule', 'Daily Schedule', true)
ON CONFLICT (slug) DO NOTHING;

-- Clear existing custom page sections
DELETE FROM sections WHERE page_slug IN ('getting-here', 'daily-schedule');

INSERT INTO sections (page_slug, section_type, config, position, visible) VALUES
  ('getting-here', 'custom', '{
    "html": "<div style=\\"max-width:52rem\\"><p style=\\"font-size:1.25rem;color:var(--color-text-muted);margin-bottom:2rem\\">142 Pine Street, Asheville, NC 28801 &bull; Open Mon-Fri 8am-5pm &bull; <strong>828-555-0100</strong></p><div class=\\"card mb-2\\" style=\\"padding:2rem\\"><h3 style=\\"margin-bottom:1rem\\">By Car</h3><p>From <strong>I-240</strong>, take Exit 5A (Merrimon Ave). Go south 0.5 miles, turn right on Pine Street. The center is on the left.</p><p><strong>Parking:</strong> Free lot behind the building (enter from Pine Street). 4 accessible parking spaces by the front entrance.</p></div><div class=\\"card mb-2\\" style=\\"padding:2rem\\"><h3 style=\\"margin-bottom:1rem\\">Silver Pines Shuttle</h3><p>Our <strong>free shuttle</strong> runs Monday-Friday with 3 routes covering North Asheville, West Asheville, and South Asheville.</p><ul style=\\"margin:1rem 0 1rem 1.5rem\\"><li><strong>Route A (North):</strong> Montford, Merrimon Ave, North Asheville — Departs 8:15am, 10:15am, 1:15pm</li><li><strong>Route B (West):</strong> West Asheville, Candler, Leicester — Departs 8:30am, 10:30am, 1:30pm</li><li><strong>Route C (South):</strong> Biltmore, South Asheville, Arden — Departs 8:00am, 10:00am, 1:00pm</li></ul><p>Return trips depart the center at 12:00pm, 3:00pm, and 5:00pm. Call Frank at <strong>828-555-0106</strong> to arrange a ride or <a href=''/resources.html''>download the full schedule</a>.</p></div><div class=\\"card mb-2\\" style=\\"padding:2rem\\"><h3 style=\\"margin-bottom:1rem\\">Volunteer Driver Program</h3><p>Need a ride to a <strong>medical appointment</strong>? Our volunteer drivers are happy to help. Call the center at <strong>828-555-0100</strong> at least 24 hours in advance. Rides available within 15 miles of Asheville.</p></div><div class=\\"card mb-2\\" style=\\"padding:2rem\\"><h3 style=\\"margin-bottom:1rem\\">Public Transit</h3><p><strong>ART Bus Route 170</strong> stops at Pine &amp; Merrimon (2 minute walk). Route runs every 30 minutes weekdays.</p></div><div class=\\"card mb-2\\" style=\\"padding:2rem;border-left:4px solid var(--color-primary)\\"><h3 style=\\"margin-bottom:1rem\\">Accessibility</h3><p>Silver Pines is <strong>fully wheelchair accessible</strong>. We have:</p><ul style=\\"margin:1rem 0 0 1.5rem\\"><li>Ramp at the main entrance</li><li>Wide doorways throughout</li><li>Accessible restrooms on both floors</li><li>Elevator to the second floor</li><li>Hearing loop in the Main Hall</li><li>Large-print materials available</li><li>Service animals welcome</li></ul></div></div>"
  }', 1, true),
  ('daily-schedule', 'custom', '{
    "html": "<div style=\\"max-width:60rem\\"><p style=\\"font-size:1.25rem;color:var(--color-text-muted);margin-bottom:2rem\\">Drop in anytime! All classes and activities are free for members unless noted.</p><div class=\\"table-wrap\\"><table><thead><tr><th>Time</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th></tr></thead><tbody><tr><td><strong>9:00-10:00</strong></td><td>Chair Yoga</td><td style=\\"background:color-mix(in srgb, var(--color-primary) 8%, transparent)\\">Tai Chi (George)</td><td>Chair Yoga</td><td style=\\"background:color-mix(in srgb, var(--color-primary) 8%, transparent)\\">Tai Chi (George)</td><td>Gentle Stretch</td></tr><tr><td><strong>10:00-12:00</strong></td><td>Open Craft Room</td><td style=\\"background:color-mix(in srgb, var(--color-primary) 8%, transparent)\\">Tech Help Desk</td><td>Open Craft Room</td><td style=\\"background:color-mix(in srgb, var(--color-primary) 8%, transparent)\\">Tech Help Desk</td><td>Open Craft Room</td></tr><tr><td><strong>11:30-12:30</strong></td><td>Lunch ($3)</td><td>—</td><td>Lunch ($3)</td><td>—</td><td>Lunch ($3)</td></tr><tr><td><strong>1:00-2:00</strong></td><td>Bridge &amp; Cards</td><td>Piano Basics (Mary)</td><td>Bridge &amp; Cards</td><td>Cooking Class (Nancy)</td><td>Bridge &amp; Cards</td></tr><tr><td><strong>2:00-4:00</strong></td><td style=\\"background:color-mix(in srgb, var(--color-primary) 8%, transparent)\\">Garden Hours</td><td style=\\"background:color-mix(in srgb, var(--color-primary) 8%, transparent)\\">Garden Hours</td><td style=\\"background:color-mix(in srgb, var(--color-primary) 8%, transparent)\\">Watercolor (Margaret)</td><td style=\\"background:color-mix(in srgb, var(--color-primary) 8%, transparent)\\">Garden Hours</td><td style=\\"background:color-mix(in srgb, var(--color-primary) 8%, transparent)\\">Garden Hours</td></tr><tr><td><strong>3:00-4:30</strong></td><td>—</td><td>—</td><td>—</td><td>Book Club (Evelyn)</td><td>—</td></tr><tr style=\\"border-top:2px solid var(--color-border)\\"><td><strong>6:30 PM</strong></td><td>—</td><td>—</td><td>—</td><td>—</td><td style=\\"background:color-mix(in srgb, var(--color-primary) 8%, transparent)\\">Movie Night (2nd &amp; 4th Fri)</td></tr></tbody></table></div><div class=\\"card mt-2\\" style=\\"padding:1.5rem;border-left:4px solid var(--color-primary)\\"><p style=\\"margin:0\\"><strong>Center hours:</strong> Mon-Fri 8am-5pm (6:30pm on Movie Fridays) &bull; <strong>Meal program:</strong> Mon/Wed/Fri 11:30am-12:30pm, $3 suggested donation &bull; <strong>Questions?</strong> Call 828-555-0100</p></div></div>"
  }', 1, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 11. HOMEPAGE SECTIONS
-- ============================================

-- Clear existing homepage sections to avoid duplicates
DELETE FROM sections WHERE page_slug = 'index';

INSERT INTO sections (page_slug, section_type, config, position, visible) VALUES
  ('index', 'hero', '{
    "heading": "Welcome to Silver Pines",
    "subheading": "Asheville''s community center for active adults. Classes, events, friends, and a warm cup of coffee — every day.",
    "cta_text": "See What''s Happening",
    "cta_href": "/events.html",
    "bg_image": "/assets/hero.jpg"
  }', 1, true),
  ('index', 'stats', '{
    "items": [
      {"value": "22+", "label": "Active Members", "href": "/members.html"},
      {"value": "12+", "label": "Events This Month", "href": "/events.html"},
      {"value": "5", "label": "Committees"},
      {"value": "8", "label": "Years Serving Asheville"}
    ]
  }', 2, true),
  ('index', 'features', '{
    "columns": 3,
    "items": [
      {"icon": "calendar", "title": "Classes & Events", "desc": "Tai chi, watercolor, book club, tech help, movie nights, and more — there''s always something to do."},
      {"icon": "users", "title": "A Real Community", "desc": "22 members and growing. Make friends, share skills, and look out for each other."},
      {"icon": "home", "title": "Your Second Home", "desc": "A warm, accessible space in the heart of Asheville with a garden, art room, and the best coffee in town."}
    ]
  }', 3, true),
  ('index', 'testimonials', '{
    "items": [
      {"quote": "Silver Pines gave me a reason to get out of the house every day. I have more friends now than I did at 40.", "name": "Grace Lee", "role": "Member since 2025"},
      {"quote": "The Tech Buddies program changed my life. I can finally video call my grandkids in California!", "name": "Mary Jackson", "role": "Member since 2024"},
      {"quote": "I was nervous about retiring. Now I''m busier than ever — garden committee, walking group, and I just started painting!", "name": "Richard Harris", "role": "Member since 2025"}
    ]
  }', 4, true),
  ('index', 'activity_feed', '{}', 5, true),
  ('index', 'cta', '{
    "heading": "Come Visit Us",
    "text": "Silver Pines is open Monday-Friday, 8am-5pm (6:30pm on Movie Fridays). Drop by for a tour, a cup of coffee, and meet your new neighbors.",
    "cta_text": "How to Get Here",
    "cta_href": "/page.html?slug=getting-here"
  }', 6, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 12. ACTIVITY LOG (seed some recent activity)
-- ============================================

INSERT INTO activity_log (member_id, action, metadata, created_at)
SELECT m.id, 'member_join', '{}', now() - interval '14 days'
FROM members m WHERE m.email = 'samuel.washington@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = m.id AND action = 'member_join');

INSERT INTO activity_log (member_id, action, metadata, created_at)
SELECT m.id, 'member_join', '{}', now() - interval '30 days'
FROM members m WHERE m.email = 'patricia.nguyen@outlook.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = m.id AND action = 'member_join');

INSERT INTO activity_log (member_id, action, metadata, created_at)
SELECT m.id, 'rsvp', '{"event_title": "Morning Tai Chi with George"}', now() - interval '2 days'
FROM members m WHERE m.email = 'grace.lee@outlook.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = m.id AND action = 'rsvp' AND metadata->>'event_title' = 'Morning Tai Chi with George');

INSERT INTO activity_log (member_id, action, metadata, created_at)
SELECT m.id, 'forum_post', '{"title": "Garden plot available — who wants it?"}', now() - interval '2 days'
FROM members m WHERE m.email = 'dorothy.banks@yahoo.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = m.id AND action = 'forum_post' AND metadata->>'title' = 'Garden plot available — who wants it?');

INSERT INTO activity_log (member_id, action, metadata, created_at)
SELECT m.id, 'announcement', '{"title": "Parking Lot Repaving — Use Side Entrance March 15-17"}', now() - interval '3 days'
FROM members m WHERE m.email = 'james.whitfield@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = m.id AND action = 'announcement' AND metadata->>'title' LIKE 'Parking Lot Repaving%');

INSERT INTO activity_log (member_id, action, metadata, created_at)
SELECT m.id, 'resource_upload', '{"title": "Internet Safety for Seniors"}', now() - interval '5 days'
FROM members m WHERE m.email = 'arthur.williams@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = m.id AND action = 'resource_upload' AND metadata->>'title' = 'Internet Safety for Seniors');

INSERT INTO activity_log (member_id, action, metadata, created_at)
SELECT m.id, 'rsvp', '{"event_title": "Thursday Book Club"}', now() - interval '1 day'
FROM members m WHERE m.email = 'evelyn.wright@yahoo.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = m.id AND action = 'rsvp' AND metadata->>'event_title' = 'Thursday Book Club');

INSERT INTO activity_log (member_id, action, metadata, created_at)
SELECT m.id, 'rsvp', '{"event_title": "Watercolor Wednesday"}', now() - interval '1 day'
FROM members m WHERE m.email = 'charles.robinson@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = m.id AND action = 'rsvp' AND metadata->>'event_title' = 'Watercolor Wednesday');
`;

const MUTABLE_TABLES = [
  'newsletter_drafts', 'member_insights', 'moderation_log',
  'content_translations', 'committee_members', 'committees',
  'forum_replies', 'forum_topics', 'forum_categories',
  'reactions', 'activity_log', 'event_rsvps', 'events',
  'resources', 'announcements',
];

export default async (_req) => {
  // 1. Read demo account user_ids
  const configResult = await db.sql("SELECT value FROM site_config WHERE key = 'demo_accounts'");
  const demoAccounts = configResult.rows?.[0]?.value || {};
  const adminUserId = demoAccounts.admin_user_id;
  const memberUserId = demoAccounts.member_user_id;

  // 2. TRUNCATE mutable content tables (order matters for FK constraints)
  for (const table of MUTABLE_TABLES) {
    await db.sql(`TRUNCATE ${table} CASCADE`);
  }

  // 3. Delete non-demo members (keep demo accounts by user_id)
  // First nullify tier_id on kept members to avoid FK constraint on membership_tiers
  if (adminUserId || memberUserId) {
    const keepIds = [adminUserId, memberUserId].filter(Boolean).map(id => `'${id}'`).join(',');
    await db.sql(`UPDATE members SET tier_id = NULL WHERE user_id IN (${keepIds})`);
    await db.sql(`DELETE FROM members WHERE user_id IS NULL OR user_id NOT IN (${keepIds})`);
  } else {
    await db.sql('DELETE FROM members');
  }

  // 4. Reset membership_tiers, pages, sections, custom_fields
  await db.sql('DELETE FROM membership_tiers');
  await db.sql('DELETE FROM sections');
  await db.sql('DELETE FROM pages');
  await db.sql('DELETE FROM member_custom_fields');

  // 5. Re-run seed SQL (idempotent INSERTs)
  await db.sql(SEED_SQL);

  // 6. Re-link demo accounts to seed member records
  if (adminUserId) {
    // Link admin user_id to the first admin member record
    const adminMembers = await db.sql("SELECT id FROM members WHERE role = 'admin' AND (user_id IS NULL OR user_id = '" + adminUserId + "') ORDER BY id LIMIT 1");
    if (adminMembers.rows?.length) {
      await db.sql("UPDATE members SET user_id = '" + adminUserId + "', status = 'active' WHERE id = " + adminMembers.rows[0].id);
    }
  }
  if (memberUserId) {
    // Link member user_id to the first non-admin active member
    const memberRecords = await db.sql("SELECT id FROM members WHERE role = 'member' AND (user_id IS NULL OR user_id = '" + memberUserId + "') ORDER BY id LIMIT 1");
    if (memberRecords.rows?.length) {
      await db.sql("UPDATE members SET user_id = '" + memberUserId + "', status = 'active' WHERE id = " + memberRecords.rows[0].id);
    }
  }

  // 7. Write last_reset timestamp
  const now = new Date().toISOString();
  await db.sql(`INSERT INTO site_config (key, value, category) VALUES ('last_reset', '"${now}"', 'features') ON CONFLICT (key) DO UPDATE SET value = '"${now}"'`);

  return new Response(JSON.stringify({ status: 'ok', reset_at: now }));
};
