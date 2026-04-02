// schedule: "0 * * * *"
// Reset demo site to seed state — auto-generated, do not edit manually
// Regenerate with: node scripts/generate-reset-function.js <seed.sql>
import { db } from 'run402-functions';

const SEED_SQL = `-- ============================================
-- Wild Lychee — Eagles Demo Seed (idempotent)
-- "The Eagles — Good Samaritans of Wichita"
-- Community volunteering / charity organization
-- ============================================

-- ============================================
-- 1. SITE CONFIG
-- ============================================

-- Branding
INSERT INTO site_config (key, value, category) VALUES
  ('site_name', '"The Eagles — Good Samaritans of Wichita"', 'branding'),
  ('site_tagline', '"Lifting our community, one neighbor at a time"', 'branding'),
  ('site_description', '"The Eagles are a Wichita-based volunteer organization dedicated to serving our neighbors through food drives, mentoring, habitat builds, and community outreach. Founded in 2014, we believe that small acts of kindness create lasting change."', 'branding'),
  ('logo_url', '"/assets/logo.png"', 'branding'),
  ('favicon_url', '"/assets/logo.png"', 'branding')
ON CONFLICT (key) DO NOTHING;

-- Theme (navy + warm cream)
INSERT INTO site_config (key, value, category) VALUES
  ('theme', '{
    "primary": "#1b365d",
    "primary_hover": "#142a4d",
    "bg": "#fffdf7",
    "surface": "#f5f0e8",
    "text": "#1a1a2e",
    "text_muted": "#6b7280",
    "border": "#d4d0c8",
    "font_heading": "Nunito",
    "font_body": "Open Sans",
    "radius": "0.5rem",
    "max_width": "72rem"
  }', 'theme')
ON CONFLICT (key) DO NOTHING;

-- Feature flags (ALL enabled)
INSERT INTO site_config (key, value, category) VALUES
  ('feature_events', 'true', 'features'),
  ('feature_forum', 'true', 'features'),
  ('feature_directory', 'true', 'features'),
  ('feature_resources', 'true', 'features'),
  ('feature_blog', 'false', 'features'),
  ('feature_committees', 'true', 'features'),
  ('feature_ai_moderation', 'true', 'features'),
  ('feature_ai_translation', 'true', 'features'),
  ('feature_ai_newsletter', 'true', 'features'),
  ('feature_ai_insights', 'true', 'features'),
  ('feature_ai_onboarding', 'true', 'features'),
  ('feature_ai_event_recaps', 'true', 'features'),
  ('directory_public', 'false', 'features'),
  ('signup_mode', '"approved"', 'features'),
  ('demo_mode', 'true', 'features')
ON CONFLICT (key) DO NOTHING;

-- Navigation
INSERT INTO site_config (key, value, category) VALUES
  ('nav', '[
    {"label": "Home", "href": "/", "icon": "home", "public": true},
    {"label": "About", "href": "/page.html?slug=about", "icon": "info", "public": true},
    {"label": "Volunteer", "href": "/page.html?slug=volunteer", "icon": "heart", "public": true},
    {"label": "Members", "href": "/directory.html", "icon": "users", "auth": true, "feature": "feature_directory"},
    {"label": "Events", "href": "/events.html", "icon": "calendar", "feature": "feature_events"},
    {"label": "Resources", "href": "/resources.html", "icon": "book-open", "feature": "feature_resources"},
    {"label": "Forum", "href": "/forum.html", "icon": "message-circle", "feature": "feature_forum"},
    {"label": "Committees", "href": "/committees.html", "icon": "briefcase", "feature": "feature_committees"},
    {"label": "Dashboard", "href": "/admin.html", "icon": "bar-chart-2", "admin": true},
    {"label": "Members", "href": "/admin-members.html", "icon": "users", "admin": true},
    {"label": "Settings", "href": "/admin-settings.html", "icon": "settings", "admin": true}
  ]', 'nav')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 2. MEMBERSHIP TIERS
-- ============================================

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Volunteer', 'Join our volunteer roster and start making a difference', ARRAY['Event sign-ups', 'Forum access', 'Announcements'], 'Free', 1, true
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Volunteer');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Eagle Member', 'Annual supporter of Eagles programs and operations', ARRAY['Volunteer benefits', 'Member directory', 'Resources library', 'Voting rights', 'Eagles t-shirt'], '$25/year', 2, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Eagle Member');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Eagle Sponsor', 'Generous sponsor fueling our biggest initiatives', ARRAY['All member benefits', 'Sponsor recognition', 'Gala VIP table', 'Quarterly impact report', 'Tax receipt'], '$100/year', 3, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Eagle Sponsor');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Board Member', 'Appointed leadership guiding the Eagles mission', ARRAY['Full access', 'Admin tools', 'Board meetings', 'Strategic planning', 'Financial oversight'], 'By appointment', 4, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Board Member');

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
SELECT 'employer', 'Employer', 'text', NULL, false, false, 3
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'employer');

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'skills', 'Skills', 'multi_select', '["construction", "cooking", "driving", "mentoring", "fundraising", "organizing", "tech"]', false, true, 4
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'skills');

-- ============================================
-- 4. MEMBERS (28 people)
-- ============================================

-- Member 1: Admin
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'marcus.reid@eagleswichita.org', 'Marcus Reid', '/assets/avatar-01.jpg',
  'Founding president of The Eagles. Retired teacher who believes every Wichitan deserves a helping hand. Passionate about youth mentoring and food security.',
  (SELECT id FROM membership_tiers WHERE name = 'Board Member'), 'admin', 'active',
  '{"phone": "316-555-0101", "neighborhood": "Riverside", "employer": "Retired — USD 259", "skills": ["mentoring", "organizing", "fundraising"]}',
  now() - interval '730 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'marcus.reid@eagleswichita.org');

-- Member 2: Moderator
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'diana.flores@gmail.com', 'Diana Flores', '/assets/avatar-02.jpg',
  'Bilingual community organizer and proud Wichita native. I coordinate our Spanish-language outreach and help families navigate local services.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Sponsor'), 'moderator', 'active',
  '{"phone": "316-555-0102", "neighborhood": "Planeview", "employer": "Catholic Charities of Wichita", "skills": ["organizing", "mentoring", "cooking"]}',
  now() - interval '680 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'diana.flores@gmail.com');

-- Member 3: Moderator
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'terrence.washington@yahoo.com', 'Terrence Washington', '/assets/avatar-03.jpg',
  'Construction foreman by day, Eagle volunteer on weekends. I lead our Habitat Build crews and love seeing families get their keys.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Member'), 'moderator', 'active',
  '{"phone": "316-555-0103", "neighborhood": "McAdams", "employer": "Dondlinger Construction", "skills": ["construction", "driving", "organizing"]}',
  now() - interval '650 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'terrence.washington@yahoo.com');

-- Member 4
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'sarah.nguyen@outlook.com', 'Sarah Nguyen', '/assets/avatar-04.jpg',
  'Pediatric nurse at Wesley Medical Center. I volunteer because healthy communities start with caring neighbors.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Member'), 'member', 'active',
  '{"phone": "316-555-0104", "neighborhood": "College Hill", "employer": "Wesley Medical Center", "skills": ["cooking", "mentoring"]}',
  now() - interval '600 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'sarah.nguyen@outlook.com');

-- Member 5
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'james.mcallister@gmail.com', 'James McAllister', '/assets/avatar-05.jpg',
  'Wichita State alum and IT consultant. I handle our website and help seniors with tech literacy classes.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Sponsor'), 'member', 'active',
  '{"phone": "316-555-0105", "neighborhood": "Delano", "employer": "Self-employed", "skills": ["tech", "mentoring", "organizing"]}',
  now() - interval '550 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'james.mcallister@gmail.com');

-- Member 6
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'patricia.hall@gmail.com', 'Patricia Hall', '/assets/avatar-06.jpg',
  'Retired librarian with a passion for literacy outreach. I run our Little Free Library program and read-aloud events for kids.',
  (SELECT id FROM membership_tiers WHERE name = 'Board Member'), 'member', 'active',
  '{"phone": "316-555-0106", "neighborhood": "Crown Heights", "employer": "Retired — Wichita Public Library", "skills": ["mentoring", "organizing"]}',
  now() - interval '700 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'patricia.hall@gmail.com');

-- Member 7
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'roberto.castillo@hotmail.com', 'Roberto Castillo', '/assets/avatar-07.jpg',
  'Chef and restaurant owner. I organize the cooking teams for our community meals and holiday food basket program.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Member'), 'member', 'active',
  '{"phone": "316-555-0107", "neighborhood": "North End", "employer": "Castillo''s Kitchen", "skills": ["cooking", "fundraising", "driving"]}',
  now() - interval '480 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'roberto.castillo@hotmail.com');

-- Member 8
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'amanda.brooks@gmail.com', 'Amanda Brooks', '/assets/avatar-08.jpg',
  'Marketing manager at Spirit AeroSystems. I volunteer my design and communications skills to spread the Eagles message.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Sponsor'), 'member', 'active',
  '{"phone": "316-555-0108", "neighborhood": "Eastborough", "employer": "Spirit AeroSystems", "skills": ["fundraising", "organizing", "tech"]}',
  now() - interval '450 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'amanda.brooks@gmail.com');

-- Member 9
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'devon.jackson@gmail.com', 'Devon Jackson', '/assets/avatar-09.jpg',
  'High school football coach at Heights. Got into volunteering through our youth mentoring program and never looked back.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Member'), 'member', 'active',
  '{"phone": "316-555-0109", "neighborhood": "Indian Hills", "employer": "USD 259 — Heights High", "skills": ["mentoring", "driving", "construction"]}',
  now() - interval '400 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'devon.jackson@gmail.com');

-- Member 10
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'lisa.patel@gmail.com', 'Lisa Patel', '/assets/avatar-10.jpg',
  'Pharmacist and first-generation Indian American. I coordinate our health screenings and medication assistance program.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Member'), 'member', 'active',
  '{"phone": "316-555-0110", "neighborhood": "West Side", "employer": "Dillons Pharmacy", "skills": ["organizing", "mentoring"]}',
  now() - interval '380 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'lisa.patel@gmail.com');

-- Member 11
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'tom.hendricks@outlook.com', 'Tom Hendricks', '/assets/avatar-11.jpg',
  'Retired firefighter. I drive our delivery van for food drives and help with disaster relief coordination.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'active',
  '{"phone": "316-555-0111", "neighborhood": "Midtown", "employer": "Retired — Wichita Fire Dept", "skills": ["driving", "construction", "organizing"]}',
  now() - interval '350 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'tom.hendricks@outlook.com');

-- Member 12
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'keisha.brown@gmail.com', 'Keisha Brown', '/assets/avatar-12.jpg',
  'Social worker and neighborhood advocate. I connect Eagles volunteers with families who need us most.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Member'), 'member', 'active',
  '{"phone": "316-555-0112", "neighborhood": "Fairmount", "employer": "Kansas Dept of Children and Families", "skills": ["mentoring", "organizing", "cooking"]}',
  now() - interval '320 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'keisha.brown@gmail.com');

-- Member 13
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'michael.oconnor@yahoo.com', 'Michael O''Connor', '/assets/avatar-13.jpg',
  'Accountant at Foulston Siefkin. I handle the Eagles books and love seeing every donated dollar make an impact.',
  (SELECT id FROM membership_tiers WHERE name = 'Board Member'), 'member', 'active',
  '{"phone": "316-555-0113", "neighborhood": "College Hill", "employer": "Foulston Siefkin LLP", "skills": ["fundraising", "organizing", "tech"]}',
  now() - interval '690 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'michael.oconnor@yahoo.com');

-- Member 14
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'maria.garcia@gmail.com', 'Maria Garcia', '/assets/avatar-14.jpg',
  'Stay-at-home mom who brings her kids to every volunteer event. Teaching my children that giving back is a way of life.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'active',
  '{"phone": "316-555-0114", "neighborhood": "Oaklawn", "employer": "Homemaker", "skills": ["cooking", "organizing", "driving"]}',
  now() - interval '280 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'maria.garcia@gmail.com');

-- Member 15
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'brian.kim@gmail.com', 'Brian Kim', '/assets/avatar-15.jpg',
  'Software developer at NetApp. Weekend warrior who loves the park cleanup events and trail maintenance.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Member'), 'member', 'active',
  '{"phone": "316-555-0115", "neighborhood": "Bradley Fair", "employer": "NetApp", "skills": ["tech", "construction"]}',
  now() - interval '250 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'brian.kim@gmail.com');

-- Member 16
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'janet.morrison@gmail.com', 'Janet Morrison', '/assets/avatar-16.jpg',
  'Real estate agent and Wichita booster. I recruit new Eagles members at every open house and neighborhood mixer.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Sponsor'), 'member', 'active',
  '{"phone": "316-555-0116", "neighborhood": "Crestview", "employer": "J.P. Weigand & Sons", "skills": ["fundraising", "organizing"]}',
  now() - interval '220 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'janet.morrison@gmail.com');

-- Member 17
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'charles.abimbola@outlook.com', 'Charles Abimbola', '/assets/avatar-17.jpg',
  'Nigerian-born aerospace engineer at Textron Aviation. Proud to give back to the city that welcomed my family.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Member'), 'member', 'active',
  '{"phone": "316-555-0117", "neighborhood": "Sleepy Hollow", "employer": "Textron Aviation", "skills": ["tech", "mentoring", "construction"]}',
  now() - interval '200 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'charles.abimbola@outlook.com');

-- Member 18
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'rachel.stone@gmail.com', 'Rachel Stone', '/assets/avatar-18.jpg',
  'Elementary school teacher. Our back-to-school supply drive is the highlight of my year — seeing kids light up is everything.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'active',
  '{"phone": "316-555-0118", "neighborhood": "Sunnyside", "employer": "USD 259 — Sunnyside Elementary", "skills": ["mentoring", "organizing"]}',
  now() - interval '170 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'rachel.stone@gmail.com');

-- Member 19
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'greg.whitfield@yahoo.com', 'Greg Whitfield', '/assets/avatar-19.jpg',
  'Plumber and handyman. If it''s broken, I''ll fix it. I lead the home repair brigade for elderly neighbors.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Member'), 'member', 'active',
  '{"phone": "316-555-0119", "neighborhood": "South Side", "employer": "Whitfield Plumbing", "skills": ["construction", "driving"]}',
  now() - interval '150 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'greg.whitfield@yahoo.com');

-- Member 20
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'angela.davis@gmail.com', 'Angela Davis-Mitchell', '/assets/avatar-20.jpg',
  'Pastor at New Hope Fellowship. Serving the community through The Eagles aligns perfectly with my calling.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Sponsor'), 'member', 'active',
  '{"phone": "316-555-0120", "neighborhood": "North End", "employer": "New Hope Fellowship", "skills": ["mentoring", "fundraising", "organizing"]}',
  now() - interval '130 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'angela.davis@gmail.com');

-- Member 21
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'kyle.tanaka@gmail.com', 'Kyle Tanaka', '/assets/avatar-21.jpg',
  'WSU grad student studying public health. Volunteering with The Eagles is the best fieldwork I could ask for.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'active',
  '{"phone": "316-555-0121", "neighborhood": "University Park", "employer": "Wichita State University", "skills": ["tech", "organizing"]}',
  now() - interval '100 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'kyle.tanaka@gmail.com');

-- Member 22
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'donna.schultz@outlook.com', 'Donna Schultz', '/assets/avatar-22.jpg',
  'Retired banker and grandmother of six. I bake for every Eagles event and manage our holiday gift-wrapping team.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Member'), 'member', 'active',
  '{"phone": "316-555-0122", "neighborhood": "Bel Aire", "employer": "Retired — Intrust Bank", "skills": ["cooking", "fundraising"]}',
  now() - interval '85 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'donna.schultz@outlook.com');

-- Member 23
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'antonio.reyes@gmail.com', 'Antonio Reyes', '/assets/avatar-23.jpg',
  'Auto mechanic and car donation coordinator. I keep our Eagles delivery van running and organize free oil-change days.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Member'), 'member', 'active',
  '{"phone": "316-555-0123", "neighborhood": "Hilltop", "employer": "Reyes Auto Repair", "skills": ["driving", "construction", "tech"]}',
  now() - interval '65 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'antonio.reyes@gmail.com');

-- Member 24
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'stephanie.wright@gmail.com', 'Stephanie Wright', '/assets/avatar-24.jpg',
  'Graphic designer freelancing from home. I design all the Eagles flyers, banners, and social media graphics.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'active',
  '{"phone": "316-555-0124", "neighborhood": "Old Town", "employer": "Freelance", "skills": ["tech", "organizing"]}',
  now() - interval '45 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'stephanie.wright@gmail.com');

-- Member 25
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'david.leung@yahoo.com', 'David Leung', '/assets/avatar-25.jpg',
  'Dentist who runs free dental screening days through The Eagles. Oral health is community health.',
  (SELECT id FROM membership_tiers WHERE name = 'Eagle Sponsor'), 'member', 'active',
  '{"phone": "316-555-0125", "neighborhood": "Tallgrass", "employer": "Leung Family Dentistry", "skills": ["mentoring", "fundraising"]}',
  now() - interval '35 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'david.leung@yahoo.com');

-- Member 26
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'jasmine.powell@gmail.com', 'Jasmine Powell', '/assets/avatar-26.jpg',
  'Journalism student at WSU and aspiring photojournalist. I document Eagles events and write stories for our newsletter.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'active',
  '{"phone": "316-555-0126", "neighborhood": "Fairmount", "employer": "Wichita State University", "skills": ["tech", "organizing"]}',
  now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'jasmine.powell@gmail.com');

-- Member 27: Pending
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'nathan.cole@gmail.com', 'Nathan Cole', '/assets/avatar-27.jpg',
  'New to Wichita — just moved from Topeka for a job at Koch Industries. Looking to meet people and give back.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'pending',
  '{"phone": "316-555-0127", "neighborhood": "Downtown", "employer": "Koch Industries", "skills": ["tech", "driving"]}',
  now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'nathan.cole@gmail.com');

-- Member 28: Pending
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'priya.sharma@outlook.com', 'Priya Sharma', '/assets/avatar-28.jpg',
  'ER nurse at Via Christi who wants to do more for our underserved neighborhoods. Excited to join The Eagles.',
  (SELECT id FROM membership_tiers WHERE name = 'Volunteer'), 'member', 'pending',
  '{"phone": "316-555-0128", "neighborhood": "Greenwich Heights", "employer": "Ascension Via Christi", "skills": ["cooking", "mentoring"]}',
  now() - interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'priya.sharma@outlook.com');

-- ============================================
-- 5. EVENTS (12 total: 5 upcoming, 7 past)
-- ============================================

-- Upcoming 1: Annual Food Drive
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Annual Spring Food Drive',
  'Our biggest food collection of the year! We are partnering with the Kansas Food Bank to stock shelves across Sedgwick County. Bring non-perishable items or cash donations. Volunteers will sort, pack, and deliver to 12 distribution sites across Wichita.',
  'Exploration Place, 300 N McLean Blvd, Wichita, KS 67203',
  now() + interval '3 days' + interval '9 hours',
  now() + interval '3 days' + interval '15 hours',
  80, '/assets/event-food-drive.jpg', false,
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Annual Spring Food Drive');

-- Upcoming 2: Park Cleanup Day
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Riverside Park Cleanup Day',
  'Grab your gloves and join us for a morning of picking up litter, planting flowers, and repainting park benches along the Arkansas River trail. Coffee and breakfast tacos provided. All ages welcome — bring the family!',
  'Riverside Park, 700 Nims St, Wichita, KS 67203',
  now() + interval '10 days' + interval '8 hours',
  now() + interval '10 days' + interval '12 hours',
  50, '/assets/event-park-cleanup.jpg', false,
  (SELECT id FROM members WHERE email = 'diana.flores@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Riverside Park Cleanup Day');

-- Upcoming 3: Spring Gala
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Eagles Spring Gala 2026',
  'Our annual fundraising gala featuring dinner, a silent auction, live music by the Wichita Jazz Orchestra, and our Volunteer of the Year award. Black-tie optional. All proceeds fund summer youth programs and the Community Garden expansion.',
  'Century II Performing Arts & Convention Center, 225 W Douglas Ave, Wichita, KS 67202',
  now() + interval '21 days' + interval '18 hours',
  now() + interval '21 days' + interval '22 hours',
  200, '/assets/event-fundraiser-gala.jpg', true,
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Eagles Spring Gala 2026');

-- Upcoming 4: Youth Mentoring Saturday
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Youth Mentoring Saturday',
  'Monthly mentoring session for at-risk teens. This month we are focusing on resume writing and mock interviews with local business leaders. Mentors and mentees meet one-on-one, followed by a group lunch.',
  'Wichita Community Center, 2700 E 18th St N, Wichita, KS 67214',
  now() + interval '7 days' + interval '10 hours',
  now() + interval '7 days' + interval '14 hours',
  30, '/assets/event-youth-day.jpg', true,
  (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Youth Mentoring Saturday');

-- Upcoming 5: Volunteer Training Workshop
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'New Volunteer Training Workshop',
  'Orientation for new Eagles volunteers covering safety protocols, communication guidelines, and an overview of all active programs. Meet committee leads and find the right fit for your skills. Light refreshments provided.',
  'Eagles HQ, 1845 N Fairmount St, Wichita, KS 67260',
  now() + interval '14 days' + interval '13 hours',
  now() + interval '14 days' + interval '16 hours',
  25, '/assets/event-training.jpg', false,
  (SELECT id FROM members WHERE email = 'diana.flores@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'New Volunteer Training Workshop');

-- Past 1: Winter Coat Drive
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Winter Coat Drive',
  'We collected over 600 coats, scarves, and gloves for families in need across Wichita. Distribution happened at five community centers. Thank you to everyone who donated and sorted!',
  'Evergreen Recreation Center, 2700 N Woodland St, Wichita, KS 67204',
  now() - interval '45 days' + interval '9 hours',
  now() - interval '45 days' + interval '14 hours',
  60, '/assets/event-coat-drive.jpg', false,
  (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Winter Coat Drive');

-- Past 2: Habitat Build Day
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Habitat for Humanity Build Day',
  'Eagles crews framed walls and hung drywall for a four-bedroom home on the north side. We put in 180 volunteer hours in a single day. The Martinez family moves in next month!',
  '1422 N Poplar St, Wichita, KS 67214',
  now() - interval '30 days' + interval '7 hours',
  now() - interval '30 days' + interval '16 hours',
  40, '/assets/event-habitat-build.jpg', false,
  (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Habitat for Humanity Build Day');

-- Past 3: MLK Day of Service
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'MLK Day of Service',
  'In honor of Dr. King, over 90 Eagles and community members cleaned, painted, and repaired the Boys and Girls Club facility on 21st Street. We also hosted a free community lunch serving 250 meals.',
  'Boys & Girls Club of South Central KS, 2400 E 21st St, Wichita, KS 67214',
  now() - interval '60 days' + interval '8 hours',
  now() - interval '60 days' + interval '15 hours',
  100, '/assets/event-mlk-day.jpg', false,
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'MLK Day of Service');

-- Past 4: Holiday Food Baskets
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Holiday Food Baskets Packing',
  'We packed and delivered 350 holiday food baskets to families across Wichita. Each basket included a turkey, sides, and dessert supplies. Our biggest holiday effort yet — thank you sponsors!',
  'Kansas Food Bank, 1919 E Douglas Ave, Wichita, KS 67211',
  now() - interval '75 days' + interval '8 hours',
  now() - interval '75 days' + interval '13 hours',
  70, '/assets/event-holiday-baskets.jpg', false,
  (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Holiday Food Baskets Packing');

-- Past 5: Fall Festival
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Eagles Fall Festival',
  'Our annual family-friendly fall festival with a chili cook-off, pumpkin painting, hayrides, and a bounce house. Over 400 community members came out. The chili crown went to Roberto Castillo for the third year running!',
  'Sedgwick County Park, 6501 W 21st St N, Wichita, KS 67205',
  now() - interval '90 days' + interval '11 hours',
  now() - interval '90 days' + interval '17 hours',
  100, '/assets/event-fall-festival.jpg', false,
  (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Eagles Fall Festival');

-- Past 6: Back to School Supply Drive
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Back to School Supply Drive',
  'We distributed backpacks filled with school supplies to 500 students across eight Wichita elementary schools. Teachers were thrilled and kids were beaming. Donations came from 40 local businesses.',
  'Century II Expo Hall, 225 W Douglas Ave, Wichita, KS 67202',
  now() - interval '120 days' + interval '9 hours',
  now() - interval '120 days' + interval '14 hours',
  60, '/assets/event-school-supplies.jpg', false,
  (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Back to School Supply Drive');

-- Past 7: Community Garden Planting
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Community Garden Planting Day',
  'We broke ground on the new Eagles Community Garden near Fairmount Park. Volunteers built 24 raised beds, installed an irrigation system, and planted tomatoes, peppers, herbs, and squash. Produce goes to local food pantries.',
  'Fairmount Park, 1648 N Yale Blvd, Wichita, KS 67208',
  now() - interval '150 days' + interval '8 hours',
  now() - interval '150 days' + interval '13 hours',
  45, '/assets/event-garden.jpg', false,
  (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Community Garden Planting Day');

-- ============================================
-- 6. EVENT RSVPS
-- ============================================

-- Helper: past events get 10-25 RSVPs, upcoming get 5-15
-- Using ON CONFLICT on the UNIQUE(event_id, member_id) constraint

-- Annual Spring Food Drive (upcoming) — 12 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Annual Spring Food Drive'), (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Annual Spring Food Drive') AND member_id = (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'));

-- Riverside Park Cleanup Day (upcoming) — 8 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day'), (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day') AND member_id = (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day'), (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day') AND member_id = (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day'), (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day') AND member_id = (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day'), (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day') AND member_id = (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day'), (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day') AND member_id = (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day'), (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day') AND member_id = (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day'), (SELECT id FROM members WHERE email = 'antonio.reyes@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Riverside Park Cleanup Day') AND member_id = (SELECT id FROM members WHERE email = 'antonio.reyes@gmail.com'));

-- Eagles Spring Gala (upcoming) — 15 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026'), (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Spring Gala 2026') AND member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));

-- Youth Mentoring Saturday (upcoming) — 6 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday'), (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday') AND member_id = (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday'), (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday') AND member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday'), (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday') AND member_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday'), (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday') AND member_id = (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday'), (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Youth Mentoring Saturday') AND member_id = (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'));

-- Volunteer Training Workshop (upcoming) — 5 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'New Volunteer Training Workshop'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'New Volunteer Training Workshop') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'New Volunteer Training Workshop'), (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'New Volunteer Training Workshop') AND member_id = (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'New Volunteer Training Workshop'), (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'New Volunteer Training Workshop') AND member_id = (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'New Volunteer Training Workshop'), (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'New Volunteer Training Workshop') AND member_id = (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'New Volunteer Training Workshop'), (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'New Volunteer Training Workshop') AND member_id = (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'));

-- Winter Coat Drive (past) — 18 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Winter Coat Drive'), (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Winter Coat Drive') AND member_id = (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'));

-- Habitat Build Day (past) — 15 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'antonio.reyes@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'antonio.reyes@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day'), (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Habitat for Humanity Build Day') AND member_id = (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'));

-- MLK Day of Service (past) — 22 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'MLK Day of Service'), (SELECT id FROM members WHERE email = 'antonio.reyes@gmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'MLK Day of Service') AND member_id = (SELECT id FROM members WHERE email = 'antonio.reyes@gmail.com'));

-- Holiday Food Baskets (past) — 14 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing'), (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Holiday Food Baskets Packing') AND member_id = (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'));

-- Fall Festival (past) — 20 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Eagles Fall Festival'), (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Eagles Fall Festival') AND member_id = (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'));

-- Back to School Supply Drive (past) — 12 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Back to School Supply Drive'), (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Back to School Supply Drive') AND member_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'));

-- Community Garden Planting Day (past) — 10 RSVPs
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Community Garden Planting Day'), (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Community Garden Planting Day') AND member_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Community Garden Planting Day'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Community Garden Planting Day') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Community Garden Planting Day'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Community Garden Planting Day') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Community Garden Planting Day'), (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Community Garden Planting Day') AND member_id = (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Community Garden Planting Day'), (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Community Garden Planting Day') AND member_id = (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Community Garden Planting Day'), (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Community Garden Planting Day') AND member_id = (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Community Garden Planting Day'), (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Community Garden Planting Day') AND member_id = (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Community Garden Planting Day'), (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'), 'maybe' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Community Garden Planting Day') AND member_id = (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Community Garden Planting Day'), (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Community Garden Planting Day') AND member_id = (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'));
INSERT INTO event_rsvps (event_id, member_id, status) SELECT (SELECT id FROM events WHERE title = 'Community Garden Planting Day'), (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'going' WHERE NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = (SELECT id FROM events WHERE title = 'Community Garden Planting Day') AND member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'));

-- ============================================
-- 7. FORUM CATEGORIES
-- ============================================

INSERT INTO forum_categories (name, description, position, color)
SELECT 'General Discussion', 'Chat about anything Eagles-related — ideas, questions, shout-outs', 1, '#1b365d'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'General Discussion');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Volunteering', 'Coordinate volunteer shifts, share field stories, request help', 2, '#059669'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Volunteering');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Fundraising Ideas', 'Brainstorm new revenue streams and sponsorship opportunities', 3, '#d97706'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Fundraising Ideas');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Community Stories', 'Share inspiring stories of impact from our work in Wichita', 4, '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Community Stories');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Feedback & Suggestions', 'Help us improve — share your ideas for The Eagles', 5, '#ef4444'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Feedback & Suggestions');

-- ============================================
-- 8. FORUM TOPICS (18 topics)
-- ============================================

-- General Discussion
INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'General Discussion'),
  'Welcome to the new Eagles community portal!',
  'Hey everyone! We finally have our own online space. Use this forum to connect between events, share ideas, and stay in the loop. If you have any questions about how to use the site, post them here and we will help you out.',
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), true, 5, now() - interval '2 days',
  now() - interval '55 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Welcome to the new Eagles community portal!');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'General Discussion'),
  'Who is going to the Spring Gala?',
  'The gala is three weeks away and I am so excited! Who else is going? Should we organize a carpool from the north side? I know parking downtown can be rough.',
  (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'), false, 4, now() - interval '1 day',
  now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Who is going to the Spring Gala?');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'General Discussion'),
  'Eagles merchandise — any interest?',
  'I have been thinking about whether we should sell Eagles-branded t-shirts, hats, and water bottles. It could be a small fundraiser and also help with visibility around town. Would anyone buy them?',
  (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), false, 3, now() - interval '5 days',
  now() - interval '18 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Eagles merchandise — any interest?');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'General Discussion'),
  'Best local restaurants for team dinners?',
  'We want to do a casual dinner after the next volunteer event. Any suggestions for a restaurant that can handle 20+ people and is reasonably priced? Somewhere central would be great.',
  (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), false, 4, now() - interval '3 days',
  now() - interval '12 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Best local restaurants for team dinners?');

-- Volunteering
INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Volunteering'),
  'Food drive logistics — need drivers Saturday morning',
  'We still need 4 drivers with trucks or SUVs for the food drive pickup routes on Saturday morning. Each route takes about 2 hours. If you can help, reply here or text me directly. We will have donuts and coffee at the staging area!',
  (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), true, 3, now() - interval '1 day',
  now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Food drive logistics — need drivers Saturday morning');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Volunteering'),
  'Habitat Build recap — what an incredible day!',
  'We framed an entire house in one day! 180 volunteer hours logged. The Martinez family stopped by and the mom was in tears. This is why we do what we do. Photos coming soon to the newsletter.',
  (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'), false, 4, now() - interval '25 days',
  now() - interval '28 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Habitat Build recap — what an incredible day!');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Volunteering'),
  'Volunteer of the Month nominations — March',
  'It is time to nominate your fellow Eagles for March Volunteer of the Month! Reply with a name and a sentence about why they deserve recognition. Voting closes Friday.',
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), false, 3, now() - interval '4 days',
  now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Volunteer of the Month nominations — March');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Volunteering'),
  'Community garden needs weeders this week',
  'The community garden is looking a little wild after the recent rain. If anyone has a free hour this week, swing by and pull some weeds. The tomatoes are coming in strong and need room to breathe!',
  (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), false, 2, now() - interval '6 days',
  now() - interval '9 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Community garden needs weeders this week');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Volunteering'),
  'Free dental screenings — volunteers needed May 10',
  'Dr. Leung is organizing a free dental screening day at the Eagles HQ for uninsured families. We need 6 volunteers to help with registration, crowd management, and handing out hygiene kits. No medical experience required — just a friendly face.',
  (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'), false, 2, now() - interval '3 days',
  now() - interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Free dental screenings — volunteers needed May 10');

-- Fundraising Ideas
INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Fundraising Ideas'),
  'Gala silent auction — item donations needed',
  'The Spring Gala silent auction is our biggest fundraiser of the year. Last year we raised $8,200! We need donated items — restaurant gift cards, sports memorabilia, weekend getaway packages, anything. Reach out if you can contribute.',
  (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), false, 3, now() - interval '7 days',
  now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Gala silent auction — item donations needed');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Fundraising Ideas'),
  'Corporate matching — are we missing free money?',
  'A lot of Wichita employers match charitable donations. Spirit AeroSystems, Koch, Textron — they all have programs. Should we put together a guide for members on how to get their donations matched? Could double our impact.',
  (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), false, 2, now() - interval '15 days',
  now() - interval '30 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Corporate matching — are we missing free money?');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Fundraising Ideas'),
  'Taco Tuesday fundraiser at Castillo''s Kitchen?',
  'Roberto has offered to host a Taco Tuesday fundraiser night at his restaurant! 20% of proceeds would go to The Eagles. He is thinking next month. Who would come? We need at least 50 people to make it worthwhile.',
  (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), false, 5, now() - interval '2 days',
  now() - interval '14 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Taco Tuesday fundraiser at Castillo''s Kitchen?');

-- Community Stories
INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Community Stories'),
  'The thank-you letter that made me cry',
  'I got a handwritten letter today from a grandmother we helped with home repairs last fall. She said she had been afraid her grandkids would fall through the porch. Now they play outside every day. I am keeping this letter forever.',
  (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), false, 4, now() - interval '8 days',
  now() - interval '22 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'The thank-you letter that made me cry');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Community Stories'),
  'Mentee got accepted to WSU!',
  'Remember Jaylen from our youth mentoring program? He just got his acceptance letter from Wichita State — full scholarship! He has been in our program for three years. I could not be more proud. Eagles make a real difference.',
  (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), false, 3, now() - interval '10 days',
  now() - interval '16 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Mentee got accepted to WSU!');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Community Stories'),
  'Photo gallery from the coat drive',
  'I uploaded a photo gallery from the Winter Coat Drive to our resources section. Some really heartwarming shots of kids trying on new coats. Feel free to share on social media — tag us @EaglesWichita!',
  (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), false, 2, now() - interval '38 days',
  now() - interval '42 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Photo gallery from the coat drive');

-- Feedback & Suggestions
INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Feedback & Suggestions'),
  'Can we add a skill-matching feature?',
  'It would be great if the website could match volunteers to events based on their skills. Like if a build day needs construction experience, it could flag members with that skill. Would save a lot of coordination time.',
  (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'), false, 2, now() - interval '12 days',
  now() - interval '25 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Can we add a skill-matching feature?');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Feedback & Suggestions'),
  'Suggestion: monthly impact report email',
  'What if we sent a short monthly email showing our collective impact? Like total volunteer hours, families served, meals delivered. Numbers tell a powerful story and would keep members motivated between events.',
  (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'), false, 3, now() - interval '18 days',
  now() - interval '35 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Suggestion: monthly impact report email');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Feedback & Suggestions'),
  'New member onboarding could be smoother',
  'I joined a month ago and it took a while to figure out where to sign up for events and how committees work. Maybe a welcome packet or a quick orientation video would help new members get up to speed faster.',
  (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'), false, 2, now() - interval '20 days',
  now() - interval '40 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'New member onboarding could be smoother');

-- ============================================
-- 9. FORUM REPLIES (52 replies)
-- ============================================

-- Replies to: Welcome to the new Eagles community portal! (5 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Welcome to the new Eagles community portal!'),
  'This is fantastic, Marcus! Way easier than the email chains we used to do. Love it.',
  (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), now() - interval '54 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Welcome to the new Eagles community portal!') AND author_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Welcome to the new Eagles community portal!'),
  'Great job getting this set up, James and Marcus. Quick question — how do I update my profile photo?',
  (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'), now() - interval '53 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Welcome to the new Eagles community portal!') AND author_id = (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Welcome to the new Eagles community portal!'),
  'Patricia, just click your avatar in the top right and go to your profile. You can upload a new photo there.',
  (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'), now() - interval '52 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Welcome to the new Eagles community portal!') AND author_id = (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Welcome to the new Eagles community portal!'),
  'About time we joined the 21st century! Now if only I could get my husband to use it too...',
  (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'), now() - interval '48 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Welcome to the new Eagles community portal!') AND author_id = (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Welcome to the new Eagles community portal!'),
  'Love being able to see all the events in one place. This will really help with planning.',
  (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), now() - interval '2 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Welcome to the new Eagles community portal!') AND author_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));

-- Replies to: Who is going to the Spring Gala? (4 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Who is going to the Spring Gala?'),
  'Count me in! Carpool from north side sounds great. I can drive — I have a minivan that fits 7.',
  (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), now() - interval '6 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Who is going to the Spring Gala?') AND author_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Who is going to the Spring Gala?'),
  'My wife and I will be there. We are excited to see the silent auction items this year!',
  (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'), now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Who is going to the Spring Gala?') AND author_id = (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Who is going to the Spring Gala?'),
  'Would not miss it! I am donating a weekend stay at my Lake Afton cabin for the auction.',
  (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'), now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Who is going to the Spring Gala?') AND author_id = (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Who is going to the Spring Gala?'),
  'I will be photographing the event! Going to make sure we get some great shots for the newsletter.',
  (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Who is going to the Spring Gala?') AND author_id = (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'));

-- Replies to: Eagles merchandise (3 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Eagles merchandise — any interest?'),
  'I would buy a t-shirt in a heartbeat. Navy blue with the Eagles logo? Yes please.',
  (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), now() - interval '16 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Eagles merchandise — any interest?') AND author_id = (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Eagles merchandise — any interest?'),
  'Love this idea. I can handle the design work if we decide to go forward. Could do mockups this week.',
  (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'), now() - interval '12 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Eagles merchandise — any interest?') AND author_id = (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Eagles merchandise — any interest?'),
  'We could sell them at the gala! Good timing. Let me look into bulk pricing from a local printer.',
  (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Eagles merchandise — any interest?') AND author_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));

-- Replies to: Best local restaurants for team dinners? (4 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Best local restaurants for team dinners?'),
  'Dempsey''s Biscuit Co on Douglas is great for groups. Good food, reasonable prices, and they have a back room.',
  (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Best local restaurants for team dinners?') AND author_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Best local restaurants for team dinners?'),
  'Public at the Brickyard in Old Town has a nice private dining space. A bit pricier but worth it for a celebration.',
  (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'), now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Best local restaurants for team dinners?') AND author_id = (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Best local restaurants for team dinners?'),
  'What about my place? I will host Eagles anytime — half price on enchiladas for volunteers!',
  (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), now() - interval '6 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Best local restaurants for team dinners?') AND body LIKE '%enchiladas%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Best local restaurants for team dinners?'),
  'Roberto, you are too generous! I vote Castillo''s Kitchen. The food is incredible and it supports one of our own.',
  (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Best local restaurants for team dinners?') AND author_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com') AND body LIKE '%Roberto%');

-- Replies to: Food drive logistics (3 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Food drive logistics — need drivers Saturday morning'),
  'I have a pickup truck and Saturday morning is wide open. Sign me up for a route!',
  (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), now() - interval '4 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Food drive logistics — need drivers Saturday morning') AND author_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Food drive logistics — need drivers Saturday morning'),
  'Antonio and I can take the south side route together. His van is ready to go.',
  (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Food drive logistics — need drivers Saturday morning') AND author_id = (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Food drive logistics — need drivers Saturday morning'),
  'That is 3 down, 1 to go! Thank you all. If anyone else can drive, please let me know by Thursday.',
  (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Food drive logistics — need drivers Saturday morning') AND author_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com') AND body LIKE '%3 down%');

-- Replies to: Habitat Build recap (4 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Habitat Build recap — what an incredible day!'),
  'That was one of the best days I have had all year. Sore muscles and a full heart. When is the next one?',
  (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), now() - interval '27 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Habitat Build recap — what an incredible day!') AND author_id = (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Habitat Build recap — what an incredible day!'),
  'The look on that family''s face was everything. This is what it is all about.',
  (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), now() - interval '27 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Habitat Build recap — what an incredible day!') AND author_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Habitat Build recap — what an incredible day!'),
  'Terrence, your crew leadership was incredible. Everyone knew exactly what to do. We should run all our builds like that.',
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), now() - interval '26 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Habitat Build recap — what an incredible day!') AND author_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Habitat Build recap — what an incredible day!'),
  'I have all the photos edited and uploaded. Check the resources section for the full album!',
  (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), now() - interval '25 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Habitat Build recap — what an incredible day!') AND author_id = (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com') AND body LIKE '%photos edited%');

-- Replies to: Volunteer of the Month nominations (3 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Volunteer of the Month nominations — March'),
  'I nominate Diana Flores. She organized the entire coat drive almost single-handedly and still found time to translate every flyer into Spanish.',
  (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Volunteer of the Month nominations — March') AND author_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Volunteer of the Month nominations — March'),
  'Seconding Diana! Also want to shout out Tom Hendricks — he drove routes three weekends in a row.',
  (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), now() - interval '6 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Volunteer of the Month nominations — March') AND author_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Volunteer of the Month nominations — March'),
  'My vote is for Greg Whitfield. That man fixes anything — porches, fences, leaky pipes. He never says no.',
  (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'), now() - interval '4 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Volunteer of the Month nominations — March') AND author_id = (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'));

-- Replies to: Community garden needs weeders (2 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Community garden needs weeders this week'),
  'I will swing by Wednesday after work. Should I bring any tools?',
  (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'), now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Community garden needs weeders this week') AND author_id = (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Community garden needs weeders this week'),
  'We have gloves and tools in the shed. Just bring yourself and some water. See you there!',
  (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), now() - interval '6 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Community garden needs weeders this week') AND author_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com') AND body LIKE '%gloves%');

-- Replies to: Free dental screenings (2 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Free dental screenings — volunteers needed May 10'),
  'I can help with registration! I will bring a folding table and a laptop for sign-ins.',
  (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'), now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Free dental screenings — volunteers needed May 10') AND author_id = (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Free dental screenings — volunteers needed May 10'),
  'This is such a needed service. Count me in — I will handle crowd management and keep things moving smoothly.',
  (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Free dental screenings — volunteers needed May 10') AND author_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'));

-- Replies to: Gala silent auction (3 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Gala silent auction — item donations needed'),
  'I can get a $200 gift card from J.P. Weigand for a home staging consultation. Would that work?',
  (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'), now() - interval '15 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Gala silent auction — item donations needed') AND author_id = (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Gala silent auction — item donations needed'),
  'Free dental cleanings package from my practice — a $500 value. Happy to donate it.',
  (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'), now() - interval '12 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Gala silent auction — item donations needed') AND author_id = (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Gala silent auction — item donations needed'),
  'These are amazing donations! Keep them coming. I will put together the auction catalog next week.',
  (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), now() - interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Gala silent auction — item donations needed') AND author_id = (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com') AND body LIKE '%auction catalog%');

-- Replies to: Corporate matching (2 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Corporate matching — are we missing free money?'),
  'Spirit definitely matches. I have been doing it for two years. I can help write the guide if someone helps distribute it.',
  (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), now() - interval '25 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Corporate matching — are we missing free money?') AND author_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com') AND body LIKE '%Spirit definitely%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Corporate matching — are we missing free money?'),
  'Textron matches too! I will check with HR about the process and report back.',
  (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'), now() - interval '15 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Corporate matching — are we missing free money?') AND author_id = (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'));

-- Replies to: Taco Tuesday fundraiser (5 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Taco Tuesday fundraiser at Castillo''s Kitchen?'),
  'YES! Roberto''s tacos are legendary. I will bring my whole family — that is 6 right there.',
  (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'), now() - interval '12 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Taco Tuesday fundraiser at Castillo''s Kitchen?') AND author_id = (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Taco Tuesday fundraiser at Castillo''s Kitchen?'),
  'Count me in. I will bring coworkers too — they love that place.',
  (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'), now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Taco Tuesday fundraiser at Castillo''s Kitchen?') AND author_id = (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Taco Tuesday fundraiser at Castillo''s Kitchen?'),
  'I can make flyers and social media posts to spread the word. Let me know the date and I will get on it.',
  (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'), now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Taco Tuesday fundraiser at Castillo''s Kitchen?') AND author_id = (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Taco Tuesday fundraiser at Castillo''s Kitchen?'),
  'This is a great idea. Could we do it monthly? Recurring events build momentum.',
  (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Taco Tuesday fundraiser at Castillo''s Kitchen?') AND author_id = (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com') AND body LIKE '%monthly%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Taco Tuesday fundraiser at Castillo''s Kitchen?'),
  'Monthly works for me! Let us lock in the second Tuesday of each month. I will reserve the back room.',
  (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), now() - interval '2 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Taco Tuesday fundraiser at Castillo''s Kitchen?') AND author_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com') AND body LIKE '%Monthly%');

-- Replies to: The thank-you letter (4 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'The thank-you letter that made me cry'),
  'Greg, this is beautiful. Thank you for sharing. These moments remind us why we do this work.',
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'The thank-you letter that made me cry') AND author_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'The thank-you letter that made me cry'),
  'I am not crying, you are crying. Seriously though, this is the kind of impact that does not show up in spreadsheets.',
  (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), now() - interval '18 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'The thank-you letter that made me cry') AND author_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'The thank-you letter that made me cry'),
  'Would you be comfortable sharing the letter (with names redacted) in our newsletter? Stories like this inspire more people to volunteer.',
  (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), now() - interval '12 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'The thank-you letter that made me cry') AND author_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'The thank-you letter that made me cry'),
  'Amanda, absolutely. I will scan it and send it over. Happy to share the story.',
  (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'The thank-you letter that made me cry') AND author_id = (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com') AND body LIKE '%scan%');

-- Replies to: Mentee got accepted to WSU! (3 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Mentee got accepted to WSU!'),
  'This just made my day! Congratulations to Jaylen. The mentoring program changes lives.',
  (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'), now() - interval '14 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Mentee got accepted to WSU!') AND author_id = (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Mentee got accepted to WSU!'),
  'Full scholarship too! Devon, you and the other mentors should be so proud. This is what The Eagles are all about.',
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), now() - interval '13 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Mentee got accepted to WSU!') AND author_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org') AND body LIKE '%Full scholarship%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Mentee got accepted to WSU!'),
  'Can we invite Jaylen to speak at the gala? His story would be incredibly powerful.',
  (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Mentee got accepted to WSU!') AND author_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));

-- Replies to: Photo gallery from coat drive (2 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Photo gallery from the coat drive'),
  'These photos are amazing, Jasmine! The one of the little girl hugging her new coat should be our poster shot.',
  (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), now() - interval '40 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Photo gallery from the coat drive') AND author_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Photo gallery from the coat drive'),
  'Great work documenting everything! I shared a few on our church Facebook page and got a ton of positive responses.',
  (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), now() - interval '38 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Photo gallery from the coat drive') AND author_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));

-- Replies to: Can we add a skill-matching feature? (2 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Can we add a skill-matching feature?'),
  'Great idea, James. We already have skills in member profiles. Should be possible to filter by skill on event pages.',
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Can we add a skill-matching feature?') AND author_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Can we add a skill-matching feature?'),
  'I can look into building this. The data is all there — just need a matching algorithm. Let me prototype something.',
  (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'), now() - interval '12 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Can we add a skill-matching feature?') AND author_id = (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com') AND body LIKE '%prototype%');

-- Replies to: Monthly impact report (3 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Suggestion: monthly impact report email'),
  'Love this idea! Numbers really do motivate people. I can pull the data from our activity logs.',
  (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), now() - interval '30 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Suggestion: monthly impact report email') AND author_id = (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Suggestion: monthly impact report email'),
  'As someone in public health, I can confirm — showing people their impact increases engagement by 40%. Do it!',
  (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'), now() - interval '25 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Suggestion: monthly impact report email') AND author_id = (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Suggestion: monthly impact report email'),
  'I can design the email template. Something clean and visual with big numbers up top. Let me draft one.',
  (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'), now() - interval '18 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Suggestion: monthly impact report email') AND author_id = (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'));

-- Replies to: New member onboarding (2 replies)
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'New member onboarding could be smoother'),
  'Good feedback, Kyle. We are actually planning a new volunteer training workshop that should address a lot of this. Keep the suggestions coming!',
  (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), now() - interval '35 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'New member onboarding could be smoother') AND author_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'New member onboarding could be smoother'),
  'I second this. A short welcome video would go a long way. I can film and edit one if we get a couple people on camera.',
  (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'New member onboarding could be smoother') AND author_id = (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'));

-- ============================================
-- 10. COMMITTEES
-- ============================================

INSERT INTO committees (name, description)
SELECT 'Fundraising Committee', 'Plans and executes fundraising campaigns, manages donor relationships, and oversees the annual gala'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Fundraising Committee');

INSERT INTO committees (name, description)
SELECT 'Community Outreach', 'Connects with underserved neighborhoods, identifies needs, and coordinates direct service delivery'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Community Outreach');

INSERT INTO committees (name, description)
SELECT 'Youth Programs', 'Runs the mentoring program, back-to-school drives, and youth leadership development'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Youth Programs');

INSERT INTO committees (name, description)
SELECT 'Events Planning', 'Organizes all Eagles events from volunteer days to the annual gala and fall festival'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Events Planning');

INSERT INTO committees (name, description)
SELECT 'Communications & Media', 'Manages the website, social media, newsletter, photography, and public relations'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Communications & Media');

INSERT INTO committees (name, description)
SELECT 'Board of Directors', 'Provides strategic direction, financial oversight, and organizational governance for The Eagles'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Board of Directors');

-- ============================================
-- 11. COMMITTEE MEMBERS (38 assignments)
-- ============================================

-- Board of Directors (board members + admin)
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Board of Directors'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'chair' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Board of Directors') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Board of Directors'), (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Board of Directors') AND member_id = (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Board of Directors'), (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), 'treasurer' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Board of Directors') AND member_id = (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Board of Directors'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'secretary' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Board of Directors') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));

-- Fundraising Committee
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Fundraising Committee'), (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), 'chair' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Fundraising Committee') AND member_id = (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Fundraising Committee'), (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Fundraising Committee') AND member_id = (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Fundraising Committee'), (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Fundraising Committee') AND member_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Fundraising Committee'), (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Fundraising Committee') AND member_id = (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Fundraising Committee'), (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Fundraising Committee') AND member_id = (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Fundraising Committee'), (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Fundraising Committee') AND member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'));

-- Community Outreach
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Community Outreach'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'chair' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Community Outreach') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Community Outreach'), (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Community Outreach') AND member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Community Outreach'), (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Community Outreach') AND member_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Community Outreach'), (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Community Outreach') AND member_id = (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Community Outreach'), (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Community Outreach') AND member_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Community Outreach'), (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Community Outreach') AND member_id = (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Community Outreach'), (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Community Outreach') AND member_id = (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'));

-- Youth Programs
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Youth Programs'), (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), 'chair' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Youth Programs') AND member_id = (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Youth Programs'), (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Youth Programs') AND member_id = (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Youth Programs'), (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Youth Programs') AND member_id = (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Youth Programs'), (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Youth Programs') AND member_id = (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Youth Programs'), (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Youth Programs') AND member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'));

-- Events Planning
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Events Planning'), (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), 'chair' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Events Planning') AND member_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Events Planning'), (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Events Planning') AND member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Events Planning'), (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Events Planning') AND member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Events Planning'), (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Events Planning') AND member_id = (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Events Planning'), (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Events Planning') AND member_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'));

-- Communications & Media
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Communications & Media'), (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'), 'chair' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Communications & Media') AND member_id = (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Communications & Media'), (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Communications & Media') AND member_id = (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Communications & Media'), (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Communications & Media') AND member_id = (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Communications & Media'), (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Communications & Media') AND member_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Communications & Media'), (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Communications & Media') AND member_id = (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'));

-- Additional cross-committee assignments
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Fundraising Committee'), (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Fundraising Committee') AND member_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Community Outreach'), (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Community Outreach') AND member_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Events Planning'), (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Events Planning') AND member_id = (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Youth Programs'), (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Youth Programs') AND member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'));
INSERT INTO committee_members (committee_id, member_id, role) SELECT (SELECT id FROM committees WHERE name = 'Events Planning'), (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'), 'member' WHERE NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = (SELECT id FROM committees WHERE name = 'Events Planning') AND member_id = (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'));

-- ============================================
-- 12. ANNOUNCEMENTS (10)
-- ============================================

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'Spring Gala 2026 — Save the Date!',
  '<p>Mark your calendars! The <strong>Eagles Spring Gala 2026</strong> is happening in three weeks at Century II. This year''s theme is "Wings of Change" and we are expecting our biggest turnout yet.</p><p>Tickets are available through the events page. Early-bird pricing ends next week. We need silent auction donations — contact Michael O''Connor if you can contribute.</p>',
  true,
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'),
  now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Spring Gala 2026 — Save the Date!');

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'Annual Food Drive This Saturday!',
  '<p>Our <strong>Annual Spring Food Drive</strong> kicks off this Saturday at Exploration Place. We need volunteers for sorting, packing, and delivery routes.</p><p>Last year we collected over 4,000 pounds of food. Let us beat that record! Sign up on the events page or just show up at 9 AM. Remember to bring reusable bags if you have them.</p>',
  true,
  (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'),
  now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Annual Food Drive This Saturday!');

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'Welcome to Our Newest Eagles!',
  '<p>Please join us in welcoming our newest members who joined in the last month: <strong>Jasmine Powell</strong>, <strong>David Leung</strong>, and <strong>Stephanie Wright</strong>. We are thrilled to have you!</p><p>If you see them at an event, say hello and help them feel at home. Remember, every Eagle started as a new volunteer.</p>',
  false,
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'),
  now() - interval '14 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Welcome to Our Newest Eagles!');

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'Habitat Build Day — Thank You!',
  '<p>What an incredible day! Our Habitat Build crew framed an entire house in a single day — <strong>180 volunteer hours</strong> logged. The Martinez family stopped by and there was not a dry eye on site.</p><p>Special thanks to Terrence Washington for leading the crew and to Jasmine Powell for documenting the day. Photos are in the resources section.</p>',
  false,
  (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'),
  now() - interval '28 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Habitat Build Day — Thank You!');

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'New Committee Chair: Amanda Brooks leads Events Planning',
  '<p>We are excited to announce that <strong>Amanda Brooks</strong> has been appointed chair of the Events Planning Committee. Amanda brings incredible energy, organizational skills, and creative vision from her marketing background at Spirit AeroSystems.</p><p>Amanda takes over from Diana Flores, who will continue to focus on Community Outreach. Thank you, Diana, for two outstanding years!</p>',
  false,
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'),
  now() - interval '35 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'New Committee Chair: Amanda Brooks leads Events Planning');

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'Winter Coat Drive Results: 600+ Coats Distributed!',
  '<p>The numbers are in and they are impressive: <strong>623 coats, 180 scarves, and 240 pairs of gloves</strong> distributed to families across five community centers in Wichita.</p><p>This is a 35% increase from last year. Thank you to everyone who donated, sorted, and delivered. You kept hundreds of neighbors warm this winter.</p>',
  false,
  (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'),
  now() - interval '42 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Winter Coat Drive Results: 600+ Coats Distributed!');

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'Volunteer Milestone: 15,000 Hours!',
  '<p>Eagles, we have reached a historic milestone — <strong>15,000 cumulative volunteer hours</strong> since our founding in 2014! That is the equivalent of more than 7 full-time employees working an entire year.</p><p>Every hour represents a meal served, a house repaired, a child mentored, or a neighbor helped. This is the power of community. Thank you ALL.</p>',
  false,
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'),
  now() - interval '50 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Volunteer Milestone: 15,000 Hours!');

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'MLK Day of Service Recap',
  '<p>Over <strong>90 volunteers</strong> came together for our MLK Day of Service at the Boys and Girls Club on 21st Street. We painted, cleaned, and repaired the facility — plus served 250 free community meals.</p><p>Dr. King said the time is always right to do what is right. On Monday, The Eagles proved Wichita agrees.</p>',
  false,
  (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'),
  now() - interval '58 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'MLK Day of Service Recap');

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'Community Garden Produces 800 Pounds of Fresh Vegetables',
  '<p>Our Eagles Community Garden near Fairmount Park has produced over <strong>800 pounds of fresh vegetables</strong> this season — all donated to local food pantries. Tomatoes, peppers, squash, and herbs are feeding families who need it most.</p><p>We are expanding to 30 raised beds next season. If you would like a plot or want to help maintain the garden, contact Sarah Nguyen.</p>',
  false,
  (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'),
  now() - interval '70 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Community Garden Produces 800 Pounds of Fresh Vegetables');

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'Holiday Food Baskets: 350 Families Served',
  '<p>This holiday season, The Eagles packed and delivered <strong>350 food baskets</strong> to families across Wichita. Each basket included a turkey, side dishes, and dessert supplies — everything for a full holiday meal.</p><p>Thank you to our incredible sponsors and to Roberto Castillo for coordinating the packing operation. You made the holidays brighter for hundreds of families.</p>',
  false,
  (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'),
  now() - interval '73 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Holiday Food Baskets: 350 Families Served');

-- ============================================
-- 13. RESOURCES (15)
-- ============================================

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Eagles Volunteer Handbook', 'Complete guide for new and returning volunteers — safety protocols, communication guidelines, and program overviews.', 'Handbooks', '/assets/volunteer-handbook.pdf', 'pdf', false,
  (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), now() - interval '180 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Eagles Volunteer Handbook');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Tax Donation Receipt Template', 'Fillable PDF receipt for tax-deductible donations. Use for cash and in-kind contributions over $25.', 'Forms', '/assets/donation-receipt-template.pdf', 'pdf', true,
  (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), now() - interval '160 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Tax Donation Receipt Template');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Safety Training Guide', 'Required reading for all volunteers participating in construction, cleanup, and food handling events.', 'Training', '/assets/safety-training.pdf', 'pdf', false,
  (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'), now() - interval '150 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Safety Training Guide');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Eagles Brand Kit', 'Official logos, color palette, fonts, and usage guidelines for all Eagles communications and materials.', 'Media', '/assets/brand-kit.zip', 'zip', true,
  (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'), now() - interval '40 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Eagles Brand Kit');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Annual Report 2025', 'Our year in review — financials, volunteer hours, families served, and strategic goals for 2026.', 'Handbooks', '/assets/annual-report-2025.pdf', 'pdf', false,
  (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), now() - interval '60 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Annual Report 2025');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'New Member Orientation Slides', 'Slide deck covering Eagles history, mission, programs, and how to get involved. Used at training workshops.', 'Training', '/assets/orientation-slides.pdf', 'pdf', false,
  (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), now() - interval '30 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'New Member Orientation Slides');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Volunteer Hour Log Sheet', 'Printable form for tracking volunteer hours at events. Submit completed sheets to your committee chair.', 'Forms', '/assets/hour-log-sheet.pdf', 'pdf', true,
  (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), now() - interval '140 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Volunteer Hour Log Sheet');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Food Handling Certification Guide', 'Study guide for the Kansas food handler certification required for all cooking and food distribution volunteers.', 'Training', '/assets/food-handling-guide.pdf', 'pdf', true,
  (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), now() - interval '120 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Food Handling Certification Guide');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Sponsorship Prospectus 2026', 'Overview of sponsorship tiers and benefits for potential corporate and individual sponsors.', 'Forms', '/assets/sponsorship-prospectus.pdf', 'pdf', true,
  (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), now() - interval '45 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Sponsorship Prospectus 2026');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Habitat Build Day Photos', 'Photo gallery from the February Habitat for Humanity build day — framing, drywall, and the family visit.', 'Media', '/assets/habitat-photos.zip', 'zip', false,
  (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), now() - interval '25 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Habitat Build Day Photos');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Winter Coat Drive Photos', 'Photo gallery from the Winter Coat Drive — sorting, distribution, and happy families.', 'Media', '/assets/coat-drive-photos.zip', 'zip', false,
  (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), now() - interval '40 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Winter Coat Drive Photos');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Event Planning Checklist', 'Step-by-step checklist for organizing Eagles events — from venue booking to post-event reporting.', 'Handbooks', '/assets/event-checklist.pdf', 'pdf', true,
  (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), now() - interval '35 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Event Planning Checklist');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Mentoring Program Guidelines', 'Policies, expectations, and best practices for volunteer mentors in our youth programs.', 'Training', '/assets/mentoring-guidelines.pdf', 'pdf', true,
  (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), now() - interval '100 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Mentoring Program Guidelines');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Corporate Matching Gift Guide', 'How to get your employer to match your Eagles donation — instructions for Spirit, Koch, Textron, and others.', 'Forms', '/assets/matching-gift-guide.pdf', 'pdf', false,
  (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Corporate Matching Gift Guide');

INSERT INTO resources (title, description, category, file_url, file_type, is_members_only, uploaded_by, created_at)
SELECT 'Eagles Social Media Toolkit', 'Pre-written posts, hashtags, and image templates for promoting Eagles events on social media.', 'Media', '/assets/social-media-toolkit.zip', 'zip', true,
  (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'), now() - interval '15 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Eagles Social Media Toolkit');

-- ============================================
-- 14. NEWSLETTER DRAFTS (2)
-- ============================================

INSERT INTO newsletter_drafts (subject, body, status, period_start, period_end, sent_at, created_at)
SELECT 'Eagles Weekly — Habitat Build Recap & Food Drive Countdown',
  '<h1>Eagles Weekly</h1>
<p>Good morning, Eagles! Here is your weekly roundup of everything happening in our community.</p>

<h2>Habitat Build: 180 Hours, One House, One Family</h2>
<p>Last Saturday, 15 Eagles volunteers showed up at dawn and did not stop until sunset. Under Terrence Washington''s leadership, we framed walls, hung drywall, and made incredible progress on a four-bedroom home for the Martinez family. The family visited the site and the emotion was palpable — this is why we do what we do.</p>

<h2>Spring Food Drive — This Saturday!</h2>
<p>Our biggest food collection of the year is this Saturday at Exploration Place, 9 AM to 3 PM. We still need drivers for pickup routes — see the forum if you can help. Last year we collected over 4,000 pounds. Let us top that!</p>

<h2>Gala Update</h2>
<p>The Spring Gala is three weeks away and tickets are selling fast. Early-bird pricing ends Friday. We have some incredible silent auction items lined up, including a Lake Afton cabin weekend and dental care packages.</p>

<h2>By the Numbers</h2>
<ul>
<li><strong>623</strong> coats distributed this winter</li>
<li><strong>180</strong> volunteer hours at the Habitat build</li>
<li><strong>15,000+</strong> cumulative volunteer hours since 2014</li>
</ul>

<p>Keep soaring, Eagles!</p>
<p>— Marcus Reid, President</p>',
  'sent',
  now() - interval '14 days',
  now() - interval '7 days',
  now() - interval '7 days',
  now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM newsletter_drafts WHERE subject = 'Eagles Weekly — Habitat Build Recap & Food Drive Countdown');

INSERT INTO newsletter_drafts (subject, body, status, period_start, period_end, sent_at, created_at)
SELECT 'Eagles Weekly — Food Drive Results & Gala Final Call',
  '<h1>Eagles Weekly</h1>
<p>Happy Monday, Eagles! What a weekend we had.</p>

<h2>Food Drive Smashes Records</h2>
<p>Saturday''s Annual Spring Food Drive at Exploration Place was our most successful yet — we collected over <strong>4,800 pounds of food</strong> and $2,300 in cash donations. That is enough to stock shelves at 12 distribution sites across Sedgwick County. Thank you to every volunteer who sorted, packed, and delivered.</p>

<h2>Spring Gala — Two Weeks Away</h2>
<p>The Eagles Spring Gala is on the horizon and we are putting the finishing touches on what promises to be an unforgettable evening. Dinner, silent auction, live music by the Wichita Jazz Orchestra, and our Volunteer of the Year award. Get your tickets before they are gone!</p>

<h2>Volunteer Spotlight: Diana Flores</h2>
<p>This month''s Volunteer of the Month is Diana Flores, our Community Outreach chair. Diana organized the coat drive, coordinates Spanish-language outreach, and still finds time to train new volunteers. We are so lucky to have her.</p>

<h2>Upcoming Events</h2>
<ul>
<li><strong>Park Cleanup Day</strong> — Riverside Park, 10 days out</li>
<li><strong>Youth Mentoring Saturday</strong> — Community Center, 7 days out</li>
<li><strong>Volunteer Training Workshop</strong> — Eagles HQ, 14 days out</li>
<li><strong>Spring Gala</strong> — Century II, 21 days out</li>
</ul>

<p>See you out there!</p>
<p>— Marcus Reid, President</p>',
  'draft',
  now() - interval '7 days',
  now(),
  NULL,
  now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM newsletter_drafts WHERE subject = 'Eagles Weekly — Food Drive Results & Gala Final Call');

-- ============================================
-- 15. ACTIVITY LOG (40 entries)
-- ============================================

INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'nathan.cole@gmail.com'), 'signup', '{"tier": "Volunteer"}', now() - interval '5 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'nathan.cole@gmail.com') AND action = 'signup');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'priya.sharma@outlook.com'), 'signup', '{"tier": "Volunteer"}', now() - interval '7 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'priya.sharma@outlook.com') AND action = 'signup');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'announcement', '{"title": "Spring Gala 2026 — Save the Date!"}', now() - interval '5 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'announcement' AND metadata::text LIKE '%Spring Gala 2026%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'announcement', '{"title": "Annual Food Drive This Saturday!"}', now() - interval '3 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'announcement' AND metadata::text LIKE '%Annual Food Drive%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com'), 'rsvp', '{"event": "Annual Spring Food Drive", "status": "going"}', now() - interval '4 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'tom.hendricks@outlook.com') AND action = 'rsvp' AND metadata::text LIKE '%Spring Food Drive%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'rsvp', '{"event": "Annual Spring Food Drive", "status": "going"}', now() - interval '4 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com') AND action = 'rsvp' AND metadata::text LIKE '%Spring Food Drive%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'rsvp', '{"event": "Annual Spring Food Drive", "status": "going"}', now() - interval '3 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com') AND action = 'rsvp' AND metadata::text LIKE '%Spring Food Drive%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'brian.kim@gmail.com'), 'rsvp', '{"event": "Riverside Park Cleanup Day", "status": "going"}', now() - interval '3 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'brian.kim@gmail.com') AND action = 'rsvp' AND metadata::text LIKE '%Park Cleanup%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com'), 'post', '{"topic": "Who is going to the Spring Gala?"}', now() - interval '8 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'janet.morrison@gmail.com') AND action = 'post' AND metadata::text LIKE '%Spring Gala%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'post', '{"topic": "Food drive logistics — need drivers Saturday morning"}', now() - interval '5 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com') AND action = 'post' AND metadata::text LIKE '%Food drive logistics%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'post', '{"topic": "Volunteer of the Month nominations — March"}', now() - interval '10 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org') AND action = 'post' AND metadata::text LIKE '%Volunteer of the Month%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), 'resource_upload', '{"title": "Habitat Build Day Photos"}', now() - interval '25 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com') AND action = 'resource_upload' AND metadata::text LIKE '%Habitat%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'), 'resource_upload', '{"title": "Eagles Social Media Toolkit"}', now() - interval '15 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com') AND action = 'resource_upload' AND metadata::text LIKE '%Social Media%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), 'resource_upload', '{"title": "Corporate Matching Gift Guide"}', now() - interval '20 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com') AND action = 'resource_upload' AND metadata::text LIKE '%Matching Gift%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com'), 'rsvp', '{"event": "Eagles Spring Gala 2026", "status": "maybe"}', now() - interval '6 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'charles.abimbola@outlook.com') AND action = 'rsvp' AND metadata::text LIKE '%Gala%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), 'post', '{"topic": "Best local restaurants for team dinners?"}', now() - interval '12 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com') AND action = 'post' AND metadata::text LIKE '%restaurants%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com'), 'post', '{"topic": "The thank-you letter that made me cry"}', now() - interval '22 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'greg.whitfield@yahoo.com') AND action = 'post' AND metadata::text LIKE '%thank-you letter%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com'), 'post', '{"topic": "Mentee got accepted to WSU!"}', now() - interval '16 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'devon.jackson@gmail.com') AND action = 'post' AND metadata::text LIKE '%Mentee%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'david.leung@yahoo.com'), 'rsvp', '{"event": "Eagles Spring Gala 2026", "status": "going"}', now() - interval '5 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'david.leung@yahoo.com') AND action = 'rsvp' AND metadata::text LIKE '%Gala%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com'), 'rsvp', '{"event": "Annual Spring Food Drive", "status": "maybe"}', now() - interval '3 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'donna.schultz@outlook.com') AND action = 'rsvp' AND metadata::text LIKE '%Spring Food Drive%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'angela.davis@gmail.com'), 'rsvp', '{"event": "Youth Mentoring Saturday", "status": "going"}', now() - interval '2 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'angela.davis@gmail.com') AND action = 'rsvp' AND metadata::text LIKE '%Youth Mentoring%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com'), 'rsvp', '{"event": "New Volunteer Training Workshop", "status": "going"}', now() - interval '2 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'kyle.tanaka@gmail.com') AND action = 'rsvp' AND metadata::text LIKE '%Training%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com'), 'post', '{"topic": "Taco Tuesday fundraiser at Castillo''s Kitchen?"}', now() - interval '14 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'roberto.castillo@hotmail.com') AND action = 'post' AND metadata::text LIKE '%Taco Tuesday%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com'), 'post', '{"topic": "Gala silent auction — item donations needed"}', now() - interval '20 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'michael.oconnor@yahoo.com') AND action = 'post' AND metadata::text LIKE '%silent auction%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), 'announcement', '{"title": "Community Garden Produces 800 Pounds of Fresh Vegetables"}', now() - interval '70 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'announcement' AND metadata::text LIKE '%Community Garden%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), 'rsvp', '{"event": "Annual Spring Food Drive", "status": "going"}', now() - interval '2 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com') AND action = 'rsvp' AND metadata::text LIKE '%Spring Food Drive%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com'), 'rsvp', '{"event": "Riverside Park Cleanup Day", "status": "going"}', now() - interval '2 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'maria.garcia@gmail.com') AND action = 'rsvp' AND metadata::text LIKE '%Park Cleanup%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com'), 'post', '{"topic": "Suggestion: monthly impact report email"}', now() - interval '35 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'lisa.patel@gmail.com') AND action = 'post' AND metadata::text LIKE '%impact report%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com'), 'post', '{"topic": "Can we add a skill-matching feature?"}', now() - interval '25 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'james.mcallister@gmail.com') AND action = 'post' AND metadata::text LIKE '%skill-matching%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com'), 'rsvp', '{"event": "Riverside Park Cleanup Day", "status": "maybe"}', now() - interval '1 day' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'stephanie.wright@gmail.com') AND action = 'rsvp' AND metadata::text LIKE '%Park Cleanup%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'terrence.washington@yahoo.com'), 'announcement', '{"title": "Habitat Build Day — Thank You!"}', now() - interval '28 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'announcement' AND metadata::text LIKE '%Habitat Build Day%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com'), 'post', '{"topic": "Eagles merchandise — any interest?"}', now() - interval '18 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'amanda.brooks@gmail.com') AND action = 'post' AND metadata::text LIKE '%merchandise%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com'), 'rsvp', '{"event": "Eagles Spring Gala 2026", "status": "going"}', now() - interval '4 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'patricia.hall@gmail.com') AND action = 'rsvp' AND metadata::text LIKE '%Gala%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'antonio.reyes@gmail.com'), 'rsvp', '{"event": "Riverside Park Cleanup Day", "status": "going"}', now() - interval '1 day' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'antonio.reyes@gmail.com') AND action = 'rsvp' AND metadata::text LIKE '%Park Cleanup%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'diana.flores@gmail.com'), 'resource_upload', '{"title": "New Member Orientation Slides"}', now() - interval '30 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'diana.flores@gmail.com') AND action = 'resource_upload' AND metadata::text LIKE '%Orientation%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'marcus.reid@eagleswichita.org'), 'announcement', '{"title": "Welcome to Our Newest Eagles!"}', now() - interval '14 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'announcement' AND metadata::text LIKE '%Newest Eagles%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com'), 'post', '{"topic": "Community garden needs weeders this week"}', now() - interval '9 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'sarah.nguyen@outlook.com') AND action = 'post' AND metadata::text LIKE '%weeders%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com'), 'rsvp', '{"event": "Youth Mentoring Saturday", "status": "going"}', now() - interval '1 day' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'rachel.stone@gmail.com') AND action = 'rsvp' AND metadata::text LIKE '%Youth Mentoring%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'keisha.brown@gmail.com'), 'announcement', '{"title": "Winter Coat Drive Results: 600+ Coats Distributed!"}', now() - interval '42 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'announcement' AND metadata::text LIKE '%Coat Drive Results%');
INSERT INTO activity_log (member_id, action, metadata, created_at) SELECT (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com'), 'post', '{"topic": "Photo gallery from the coat drive"}', now() - interval '42 days' WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE member_id = (SELECT id FROM members WHERE email = 'jasmine.powell@gmail.com') AND action = 'post' AND metadata::text LIKE '%Photo gallery%');

-- ============================================
-- 16. PAGES (2 custom pages)
-- ============================================

INSERT INTO pages (slug, title, content, requires_auth, show_in_nav, nav_position, published)
SELECT 'about', 'About The Eagles', '
<section class="page-content">
  <h1>About The Eagles — Good Samaritans of Wichita</h1>

  <h2>Our Story</h2>
  <p>The Eagles were founded in 2014 by a small group of Wichita neighbors who believed that everyday people could create extraordinary change. What started as a weekend food drive in a church parking lot has grown into one of Sedgwick County''s most active volunteer organizations, with over 200 members and 15,000 cumulative volunteer hours.</p>

  <h2>Our Mission</h2>
  <p>We exist to lift our community — one neighbor at a time. Through hands-on volunteering, food security programs, youth mentoring, habitat builds, and community outreach, The Eagles connect people who want to help with people who need it most.</p>

  <h2>Our Values</h2>
  <ul>
    <li><strong>Service First</strong> — We show up, roll up our sleeves, and do the work.</li>
    <li><strong>Every Neighbor Matters</strong> — We serve all Wichitans regardless of background, identity, or circumstance.</li>
    <li><strong>Transparency</strong> — Every dollar donated and every hour volunteered is accounted for and reported.</li>
    <li><strong>Joy in Giving</strong> — Volunteering is not a chore. It is a privilege that enriches the giver as much as the receiver.</li>
    <li><strong>Community Over Ego</strong> — We celebrate collective impact, not individual recognition.</li>
  </ul>

  <h2>What We Do</h2>
  <p>The Eagles operate year-round programs including:</p>
  <ul>
    <li><strong>Food Drives & Holiday Baskets</strong> — Collecting and distributing thousands of pounds of food annually</li>
    <li><strong>Habitat Builds</strong> — Partnering with Habitat for Humanity to build homes for Wichita families</li>
    <li><strong>Youth Mentoring</strong> — One-on-one mentoring for at-risk teens, with a focus on education and career readiness</li>
    <li><strong>Community Garden</strong> — Growing fresh produce donated to local food pantries</li>
    <li><strong>Coat & Supply Drives</strong> — Keeping families warm in winter and kids prepared for school</li>
    <li><strong>Home Repairs</strong> — Fixing porches, plumbing, and safety hazards for elderly and low-income homeowners</li>
  </ul>

  <h2>By the Numbers</h2>
  <ul>
    <li><strong>12 years</strong> of service to Wichita</li>
    <li><strong>200+</strong> active members and volunteers</li>
    <li><strong>15,000+</strong> cumulative volunteer hours</li>
    <li><strong>5,000+</strong> neighbors directly helped</li>
    <li><strong>350</strong> holiday food baskets delivered last year</li>
    <li><strong>800 lbs</strong> of produce grown in our community garden</li>
  </ul>

  <h2>Leadership</h2>
  <p>The Eagles are governed by a volunteer Board of Directors and led by six standing committees: Fundraising, Community Outreach, Youth Programs, Events Planning, Communications & Media, and the Board itself. Every member has a voice and a vote.</p>

  <p><strong>President:</strong> Marcus Reid — founding member, retired teacher, and lifelong Wichitan.</p>
</section>
', false, true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM pages WHERE slug = 'about');

INSERT INTO pages (slug, title, content, requires_auth, show_in_nav, nav_position, published)
SELECT 'volunteer', 'Volunteer With Us', '
<section class="page-content">
  <h1>Volunteer With The Eagles</h1>

  <p>Whether you have an hour or a hundred, there is a place for you with The Eagles. We welcome volunteers of all ages, backgrounds, and skill levels. No experience necessary — just a willingness to help.</p>

  <h2>How to Get Started</h2>
  <ol>
    <li><strong>Sign Up</strong> — Create a free account on this site. Select "Volunteer" as your membership tier.</li>
    <li><strong>Attend Orientation</strong> — Join our monthly New Volunteer Training Workshop to learn about safety protocols, programs, and how everything works.</li>
    <li><strong>Pick Your First Event</strong> — Browse upcoming events and RSVP. We recommend starting with a food drive or park cleanup — they are fun, social, and easy to jump into.</li>
    <li><strong>Find Your Niche</strong> — Love building things? Join a Habitat crew. Great with kids? Try youth mentoring. Prefer the kitchen? Help with community meals. There is something for everyone.</li>
  </ol>

  <h2>Volunteer Opportunities</h2>

  <h3>Food Security</h3>
  <p>Sort and pack food donations, drive delivery routes to distribution sites, or help coordinate our holiday food basket program. We partner with the Kansas Food Bank and serve 12 sites across Wichita.</p>

  <h3>Construction & Home Repair</h3>
  <p>Join Habitat for Humanity build crews or our home repair brigade for elderly and low-income homeowners. Skills in carpentry, plumbing, or electrical work are a plus, but we train on site.</p>

  <h3>Youth Mentoring</h3>
  <p>Mentor an at-risk teen one-on-one, help with homework and college prep, or lead group workshops on life skills. Background checks are required. Training is provided.</p>

  <h3>Community Garden</h3>
  <p>Plant, weed, water, and harvest fresh produce at our Fairmount Park garden. All produce is donated to local food pantries. No gardening experience needed.</p>

  <h3>Events & Fundraising</h3>
  <p>Help plan and run our annual gala, fall festival, and other community events. Tasks include setup, registration, food service, photography, and cleanup.</p>

  <h3>Communications</h3>
  <p>Write newsletter articles, manage social media, take event photos, or design promotional materials. If you have media or marketing skills, we need you.</p>

  <h2>Skills We Need</h2>
  <p>Every skill is valuable. Here are some we are especially looking for:</p>
  <ul>
    <li>Construction, carpentry, plumbing</li>
    <li>Cooking and food handling</li>
    <li>Driving (especially with a truck or van)</li>
    <li>Mentoring and tutoring</li>
    <li>Fundraising and proposal writing</li>
    <li>Event organizing and logistics</li>
    <li>Technology, web, and social media</li>
    <li>Spanish or other language skills</li>
  </ul>

  <h2>Time Commitment</h2>
  <p>There is no minimum requirement. Some Eagles volunteer every weekend; others help once a quarter. We track hours so you can document your service for employers, schools, or personal records.</p>

  <h2>Ready?</h2>
  <p>Click "Join Now" at the top of the page to create your account, or email us at <strong>volunteer@eagleswichita.org</strong> with any questions. We look forward to welcoming you to the flock!</p>
</section>
', false, true, 2, true
WHERE NOT EXISTS (SELECT 1 FROM pages WHERE slug = 'volunteer');

-- ============================================
-- 17. HOMEPAGE SECTIONS
-- ============================================

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'hero', '{
  "heading": "Lifting Wichita, One Neighbor at a Time",
  "subheading": "The Eagles are 200+ volunteers dedicated to food drives, habitat builds, youth mentoring, and community outreach across Sedgwick County.",
  "cta_text": "Join The Eagles",
  "cta_href": "/join.html",
  "bg_image": "/assets/hero.jpg"
}', 1, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'hero');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'features', '{
  "columns": 3,
  "items": [
    {"icon": "heart", "title": "Volunteer", "desc": "Join food drives, habitat builds, park cleanups, and community meals. Every pair of hands makes a difference."},
    {"icon": "trending-up", "title": "Community Impact", "desc": "5,000+ neighbors helped, 15,000+ volunteer hours logged, and 350 holiday food baskets delivered last year alone."},
    {"icon": "users", "title": "Join Us", "desc": "Sign up for free, attend an orientation, and start making an impact this weekend. No experience necessary."}
  ]
}', 2, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'features');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'stats', '{
  "items": [
    {"value": "12 Years", "label": "Serving Wichita"},
    {"value": "5,000+", "label": "Neighbors Helped"},
    {"value": "15,000+", "label": "Volunteer Hours"}
  ]
}', 3, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'stats');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'cta', '{
  "heading": "Ready to make a difference?",
  "text": "Join The Eagles today and become part of something bigger. Whether you have an hour or a hundred, there is a place for you.",
  "cta_text": "Get Started",
  "cta_href": "/join.html"
}', 4, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'cta');
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
