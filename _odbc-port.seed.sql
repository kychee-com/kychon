-- ============================================
-- Kychon — Old Dominion Boat Club Port (rerun, idempotent)
-- Source: https://www.olddominionboatclub.com (Wild Apricot)
-- Generated: 2026-05-01 by /copy-website skill (rerun)
-- Project: prj_1777563179844_1095 (reused, blobs preserved)
--
-- Engine features used (post #51-#64):
--   composable-layout (zone/scope on sections)
--   brand-identity-fields (brand_text, brand_icon_url, brand_wordmark_url)
--   nav nested children (#52)
--   hero foreground mode (#53) — switched to background w/ logo overlay
--   promo_cards (#54), events_list (#55), slideshow (#57)
--   tagline_strip (#61), link_list (#60)
--   footer chrome blocks (footer_address/links/copyright/social/attribution)
-- ============================================

-- ============================================
-- 1. SITE CONFIG
-- ============================================

-- Branding (F18 — no banner-as-logo; use text + monogram-style favicon)
INSERT INTO site_config (key, value, category) VALUES
  ('site_name', '"Old Dominion Boat Club"', 'branding'),
  ('site_tagline', '"A Proud Part of Alexandria''s History — Since 1880"', 'branding'),
  ('site_description', '"The Old Dominion Boat Club is a private social and boating club on the Potomac River at the foot of King Street in Alexandria, Virginia. Founded in 1880, ODBC is one of the oldest active boat clubs on the East Coast — home to a working marina, an active social calendar, the Tap Room, and the ODBC Foundation."', 'branding'),
  ('brand_text', '"Old Dominion Boat Club"', 'branding'),
  ('brand_text_short', '"ODBC"', 'branding'),
  ('brand_icon_url', '""', 'branding'),
  ('brand_wordmark_url', '""', 'branding'),
  ('logo_url', 'null', 'branding'),
  ('favicon_url', '"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2210%22 fill=%22%230B2742%22/%3E%3Ctext x=%2232%22 y=%2244%22 font-family=%22Georgia,serif%22 font-size=%2230%22 font-weight=%22700%22 text-anchor=%22middle%22 fill=%22%23B5853A%22%3EO%3C/text%3E%3C/svg%3E"', 'branding')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- Theme: navy + brass + cream — nautical/heritage palette
-- Engine #63 (theme-system-audit) auto-injects Google Fonts when named.
INSERT INTO site_config (key, value, category) VALUES
  ('theme', '{
    "primary": "#0B2742",
    "primary_hover": "#08203A",
    "bg": "#FBF7EE",
    "surface": "#FFFFFF",
    "text": "#1B1B1B",
    "text_muted": "#5A6470",
    "border": "#D7CFC0",
    "accent": "#B5853A",
    "font_heading": "Playfair Display",
    "font_body": "Source Sans 3",
    "radius": "0.5rem",
    "max_width": "72rem"
  }', 'theme')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- Feature flags — port handoff defaults (F8): demo_mode false, port_handoff true, signup approved
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
  ('signup_mode', '"approved"', 'features'),
  ('demo_mode', 'false', 'features'),
  ('port_handoff', 'true', 'features')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- Contact (kept for /contact page rendering and admin UX)
INSERT INTO site_config (key, value, category) VALUES
  ('contact', '{
    "address": "0 Prince Street, Alexandria, Virginia 22314",
    "phone": "(703) 836-1900",
    "general_email": "gm@olddominionboatclub.com",
    "president_email": "president@olddominionboatclub.com",
    "secretary_email": "secretary@olddominionboatclub.com",
    "treasurer_email": "treasurer@olddominionboatclub.com",
    "foundation_email": "foundation@olddominionboatclub.com",
    "business_manager_email": "businessmanager@olddominionboatclub.com",
    "timezone": "America/New_York"
  }', 'contact')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- Provenance
INSERT INTO site_config (key, value, category) VALUES
  ('port_source', '{
    "url": "https://www.olddominionboatclub.com",
    "cms": "wild-apricot",
    "ported_at": "2026-04-30T15:07:01Z",
    "rerun_at": "2026-05-01T18:18:00Z",
    "skill": "copy-website",
    "engine_features_used": ["composable-layout", "brand-identity-fields", "nested-nav", "hero-foreground-mode", "promo_cards", "events_list", "slideshow", "tagline_strip", "link_list", "footer-chrome", "theme-fonts-injection", "favicon-data-uri"]
  }', 'meta')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- Legacy nav config kept for fallback (engines without composable-layout fall back to site_config.nav).
-- Active rendering uses the `nav` block in sections (zone='header', scope='global').
INSERT INTO site_config (key, value, category) VALUES
  ('nav', '[
    {"label": "Home", "href": "/", "icon": "home", "public": true},
    {"label": "About", "href": "/page.html?slug=about", "icon": "info", "public": true},
    {"label": "Membership", "href": "/page.html?slug=membership", "icon": "user-plus", "public": true},
    {"label": "The Club", "href": "/page.html?slug=about", "icon": "anchor", "public": true,
      "children": [
        {"label": "Marina", "href": "/page.html?slug=marina", "public": true},
        {"label": "Tap Room", "href": "/page.html?slug=tap-room", "public": true},
        {"label": "History", "href": "/page.html?slug=history", "public": true},
        {"label": "Reciprocity", "href": "/page.html?slug=reciprocity", "public": true}
      ]
    },
    {"label": "Foundation", "href": "/page.html?slug=foundation", "icon": "heart", "public": true},
    {"label": "Events", "href": "/events.html", "icon": "calendar", "feature": "feature_events"},
    {"label": "Leadership", "href": "/directory.html", "icon": "users", "public": true},
    {"label": "Resources", "href": "/resources.html", "icon": "book-open", "feature": "feature_resources"},
    {"label": "Forum", "href": "/forum.html", "icon": "message-circle", "feature": "feature_forum"},
    {"label": "Committees", "href": "/committees.html", "icon": "briefcase", "feature": "feature_committees"},
    {"label": "Contact", "href": "/page.html?slug=contact", "icon": "mail", "public": true},
    {"label": "Dashboard", "href": "/admin.html", "icon": "bar-chart-2", "admin": true},
    {"label": "Members", "href": "/admin-members.html", "icon": "users", "admin": true},
    {"label": "Settings", "href": "/admin-settings.html", "icon": "settings", "admin": true}
  ]', 'nav')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- ============================================
-- 2. MEMBERSHIP TIERS (unchanged from baseline)
-- ============================================

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Prospective Member',
  'Approved applicants completing the sponsorship and interview process before Active status begins.',
  ARRAY['View events', 'Attend membership interviews', 'Use the Tap Room as a guest of a sponsor', 'Receive the newsletter'],
  'Application: $1,500 (non-refundable)',
  1, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Prospective Member');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Active Member',
  'Full ODBC member in good standing, age 21 or older, sponsored by two members, accepted by the Board of Governors.',
  ARRAY['Full club privileges', 'Marina slip eligibility', 'Tap Room access', 'Member-only events', 'Voting rights at General Membership meetings', 'Reciprocal-club privileges'],
  'Initiation $6,000 (2026) + annual dues',
  2, true
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Active Member');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Honorary / Lifetime',
  'Members recognized by the Board for distinguished service to the Club or the Alexandria community.',
  ARRAY['All Active Member privileges', 'Dues waived', 'Honorary roll listing'],
  'By Board appointment',
  3, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Honorary / Lifetime');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Foundation Director',
  '501(c)(3) board members of the ODBC Foundation, the Club''s charitable arm.',
  ARRAY['ODBC Foundation board access', 'Grants oversight', 'Foundation events'],
  'Volunteer (no dues)',
  4, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Foundation Director');

-- ============================================
-- 3. MEMBER CUSTOM FIELDS (unchanged)
-- ============================================

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'role_title', 'Role / Title', 'text', NULL, false, true, 1
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'role_title');

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'phone', 'Phone Number', 'text', NULL, false, false, 2
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'phone');

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'slip_number', 'Marina Slip', 'text', NULL, false, false, 3
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'slip_number');

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'year_joined', 'Year Joined', 'text', NULL, false, true, 4
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'year_joined');

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'committees', 'Committees', 'multi_select',
  '["Marina & Berth", "Membership", "Events", "Bar", "Foundation", "Reciprocity", "House"]',
  false, true, 5
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'committees');

-- ============================================
-- 4. MEMBERS — 2026 Officers + Board of Governors + Foundation Board
-- ============================================
-- 12 leadership scraped from /Leadership; 6 foundation board from /foundation.
-- Janice Hobart is President AND on the Foundation Board (1 row, dual roles in bio).
-- Bruce Catts is Foundation Chair (1 row).
-- Per F3: full member roster is gated. Public-leadership-only port. The club
-- can supplement with --members-csv on a future re-run.

-- 2026 Club Officers (5)
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'president@olddominionboatclub.com', 'Janice Hobart',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-janice.png',
  'President of the Old Dominion Boat Club for 2026 and a member of the ODBC Foundation Board. Janice leads the General Membership meetings and serves as the Club''s public face.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'admin', 'active',
  '{"role_title": "President", "year_joined": "(see club records)", "committees": ["Foundation"]}',
  now() - interval '730 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'president@olddominionboatclub.com');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'vp@olddominionboatclub.com', 'Michael Catts',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-michael-catts.png',
  '2026 Vice President of the Old Dominion Boat Club.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'admin', 'active',
  '{"role_title": "Vice President", "committees": ["Membership"]}',
  now() - interval '700 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'vp@olddominionboatclub.com');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'secretary@olddominionboatclub.com', 'Bob Waters',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-bob-waters.png',
  '2026 Club Secretary. Bob keeps the minutes of the Board of Governors and General Membership meetings.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'admin', 'active',
  '{"role_title": "Secretary", "committees": ["House"]}',
  now() - interval '670 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'secretary@olddominionboatclub.com');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'treasurer@olddominionboatclub.com', 'Kevin Reilly',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-kevin-reilly.png',
  '2026 Club Treasurer. Kevin oversees Club finances, dues, and the operating budget.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'admin', 'active',
  '{"role_title": "Treasurer", "committees": ["Bar"]}',
  now() - interval '640 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'treasurer@olddominionboatclub.com');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'commodore@olddominionboatclub.com', 'Art Barletta',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-art-barletta.png',
  'Commodore of the Old Dominion Boat Club. Art presides over on-water functions including the Blessing of the Fleet, Flag Raising, and Commodores'' Ball.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'moderator', 'active',
  '{"role_title": "Commodore", "committees": ["Marina & Berth"]}',
  now() - interval '900 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'commodore@olddominionboatclub.com');

-- 2026 Board of Governors (7)
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'chairman@olddominionboatclub.com', 'Steve Forehand',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-steve-forehand.png',
  'Chairman of the Board of Governors. Steve leads the Board''s monthly meetings and the Change of Command ceremony.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'admin', 'active',
  '{"role_title": "Chairman, Board of Governors", "committees": ["Membership"]}',
  now() - interval '1095 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'chairman@olddominionboatclub.com');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'gov.beresford@odbc-club.invalid', 'Dee Beresford',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-dee-beresford.png',
  '2026 Governor on the ODBC Board.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'moderator', 'active',
  '{"role_title": "Governor", "committees": ["Events"]}',
  now() - interval '550 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'gov.beresford@odbc-club.invalid');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'gov.dauray@odbc-club.invalid', 'Ernie Dauray',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-ernie-dauray.png',
  '2026 Governor on the ODBC Board.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'moderator', 'active',
  '{"role_title": "Governor", "committees": ["Marina & Berth"]}',
  now() - interval '600 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'gov.dauray@odbc-club.invalid');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'gov.rogan@odbc-club.invalid', 'Kim Rogan Weitzel',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-kim-rogan.png',
  '2026 Governor on the ODBC Board.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'moderator', 'active',
  '{"role_title": "Governor", "committees": ["Events", "Bar"]}',
  now() - interval '500 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'gov.rogan@odbc-club.invalid');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'gov.whitestone@odbc-club.invalid', 'Paul Whitestone',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-paul-whitestone.png',
  '2026 Governor on the ODBC Board.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'moderator', 'active',
  '{"role_title": "Governor", "committees": ["House"]}',
  now() - interval '480 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'gov.whitestone@odbc-club.invalid');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'gov.welch@odbc-club.invalid', 'Sandy Welch',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-sandy-welch.png',
  '2026 Governor on the ODBC Board.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'moderator', 'active',
  '{"role_title": "Governor", "committees": ["Reciprocity"]}',
  now() - interval '450 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'gov.welch@odbc-club.invalid');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'gov.thomas@odbc-club.invalid', 'Drew Thomas',
  'https://pr-fya9n5.run402.com/_blob/assets/officer-drew-thomas.png',
  '2026 Governor on the ODBC Board.',
  (SELECT id FROM membership_tiers WHERE name = 'Active Member'), 'moderator', 'active',
  '{"role_title": "Governor", "committees": ["Membership"]}',
  now() - interval '420 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'gov.thomas@odbc-club.invalid');

-- ODBC Foundation Board (5 unique — Janice Hobart already inserted above as President)
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'foundation@olddominionboatclub.com', 'Bruce Catts',
  NULL,
  'Chairman of the ODBC Foundation, the Club''s 501(c)(3) charitable arm (EIN 84-3701946). Bruce leads the Foundation''s grants program supporting youth water sports and Alexandria community service.',
  (SELECT id FROM membership_tiers WHERE name = 'Foundation Director'), 'admin', 'active',
  '{"role_title": "Foundation Chairman", "committees": ["Foundation"]}',
  now() - interval '1500 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'foundation@olddominionboatclub.com');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'foundation.connor@odbc-club.invalid', 'John Connor',
  NULL,
  'ODBC Foundation Board member.',
  (SELECT id FROM membership_tiers WHERE name = 'Foundation Director'), 'moderator', 'active',
  '{"role_title": "Foundation Director", "committees": ["Foundation"]}',
  now() - interval '1200 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'foundation.connor@odbc-club.invalid');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'foundation.dantuono@odbc-club.invalid', 'Stephen D''Antuono',
  NULL,
  'ODBC Foundation Board member.',
  (SELECT id FROM membership_tiers WHERE name = 'Foundation Director'), 'moderator', 'active',
  '{"role_title": "Foundation Director", "committees": ["Foundation"]}',
  now() - interval '1100 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'foundation.dantuono@odbc-club.invalid');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'foundation.powers@odbc-club.invalid', 'MaryBeth Powers',
  NULL,
  'ODBC Foundation Board member.',
  (SELECT id FROM membership_tiers WHERE name = 'Foundation Director'), 'moderator', 'active',
  '{"role_title": "Foundation Director", "committees": ["Foundation"]}',
  now() - interval '1000 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'foundation.powers@odbc-club.invalid');

INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'foundation.willett@odbc-club.invalid', 'Suzanne Willett',
  NULL,
  'ODBC Foundation Board member.',
  (SELECT id FROM membership_tiers WHERE name = 'Foundation Director'), 'moderator', 'active',
  '{"role_title": "Foundation Director", "committees": ["Foundation"]}',
  now() - interval '950 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'foundation.willett@odbc-club.invalid');

-- General Manager (visible on Contact page)
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'gm@olddominionboatclub.com', 'Joe Nelson',
  NULL,
  'Club General Manager. Joe runs day-to-day operations: front-of-house, Tap Room, marina, and member services.',
  (SELECT id FROM membership_tiers WHERE name = 'Honorary / Lifetime'), 'admin', 'active',
  '{"role_title": "General Manager", "committees": ["House"]}',
  now() - interval '1825 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'gm@olddominionboatclub.com');

-- Business Manager
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'businessmanager@olddominionboatclub.com', 'Emily Roach',
  NULL,
  'Club Business Manager. Emily handles dues, accounts, and member billing.',
  (SELECT id FROM membership_tiers WHERE name = 'Honorary / Lifetime'), 'moderator', 'active',
  '{"role_title": "Business Manager", "committees": ["Bar"]}',
  now() - interval '1100 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'businessmanager@olddominionboatclub.com');

-- ============================================
-- 5. PAGES
-- ============================================
-- Slugs that the nav points to. Content is migrated from the public source.
-- Pages whose source content is gated (Membership detail, Marina specs) get
-- a stub-style page that points the visitor at the right place to follow up.

INSERT INTO pages (slug, title, content, requires_auth, show_in_nav, nav_position, published) VALUES
  ('about', 'About the Club',
    '<div style="max-width:48rem"><h2>A Proud Part of Alexandria''s History</h2><p>Founded in <strong>1880</strong>, the Old Dominion Boat Club is one of the oldest active boat clubs on the East Coast. ODBC sits at the foot of King Street on the Potomac River, where the city of Alexandria meets the water — the same site we''ve called home for nearly 150 years.</p><p>The Club is a private social and boating organization. Members keep their boats in our marina, gather in our Ballroom and Tap Room for events, and steward Alexandria''s water-related history through the ODBC Foundation, our 501(c)(3) charitable arm.</p><h3>What we do</h3><ul><li><strong>Marina:</strong> a working slip facility on the Potomac, governed by our Marina &amp; Berth Committee.</li><li><strong>Tap Room:</strong> a member bar and dining room with a published weekly schedule.</li><li><strong>Events:</strong> a full social calendar — Derby Party, Blessing of the Fleet, Commodores'' Ball, Oktoberfest, Oyster Roast, New Year''s Eve, and the General Membership and Board meetings.</li><li><strong>Foundation:</strong> grants for youth water sports and Alexandria community programs.</li></ul><h3>Membership</h3><p>Membership is by sponsorship and Board approval. Any person of good character age 21 or older is eligible to apply with two current members in good standing as sponsors. See the <a href="/page.html?slug=membership">Membership</a> page for the application process.</p><p style="color:var(--color-text-muted);font-size:0.95rem;margin-top:2rem">Content ported from <a href="https://www.olddominionboatclub.com/About-Us">olddominionboatclub.com/About-Us</a> on 2026-04-30.</p></div>',
    false, true, 2, true),
  ('membership', 'Membership',
    '<div style="max-width:48rem"><h2>Joining the Old Dominion Boat Club</h2><p>Membership in ODBC is by application, sponsorship, and Board approval. The Membership Committee reviews applications monthly, with formal interviews several times each year.</p><h3>Eligibility</h3><ul><li>21 years of age or older</li><li>Of good character</li><li>Sponsored by <strong>two</strong> current Active Members in good standing</li></ul><h3>2026 Fees</h3><ul><li><strong>$1,500</strong> non-refundable application fee, due with the application packet</li><li><strong>$6,000</strong> initiation fee on acceptance (2026 rate; subject to annual change)</li><li>Annual dues, billed by the Business Manager</li></ul><h3>Application packet</h3><ol><li>Completed application form, signed by the applicant and both sponsors</li><li>Two written sponsor recommendation letters</li><li>The $1,500 application fee</li><li>Mailed via USPS to the Membership Committee at our 0 Prince Street address</li></ol><p>Applicants must keep the Membership Committee informed of any updates to the information submitted. Decisions are communicated in writing after the Board of Governors review.</p><p style="background:var(--color-surface);border:1px solid var(--color-border);padding:1.25rem;border-radius:var(--radius);margin-top:2rem"><strong>Want to talk to someone?</strong> Email the Membership Committee chair via the <a href="/page.html?slug=contact">contact</a> page or come to a General Membership meeting (first Monday of most months — see <a href="/events.html">events</a>).</p><p style="color:var(--color-text-muted);font-size:0.95rem;margin-top:2rem">Content ported from <a href="https://www.olddominionboatclub.com/Membership">olddominionboatclub.com/Membership</a> on 2026-04-30.</p></div>',
    false, true, 3, true),
  ('marina', 'Marina',
    '<div style="max-width:48rem"><h2>The ODBC Marina</h2><p>The Old Dominion Boat Club operates a working marina on the Potomac River at the foot of King Street. The Marina &amp; Berth Committee meets monthly (typically the second Tuesday at 6:30 PM in the Ballroom — see <a href="/events.html">events</a>).</p><h3>Slip eligibility</h3><p>Marina berths are available to <strong>Active Members</strong> in good standing. New berthing applications go through the Marina &amp; Berth (M&amp;B) Committee. The full slip dimensions and berthing application packet are available from the M&amp;B Committee — email <a href="mailto:gm@olddominionboatclub.com">gm@olddominionboatclub.com</a> to request the current packet.</p><h3>How-to guide</h3><p>The Club publishes a member how-to guide covering boater check-in, the Blessing of the Fleet, Flag Raising, the season kickoff Boaters'' Mixer, and the Commodores'' Ball. Members can request the current edition from the General Manager.</p><h3>Transient dockage</h3><p>The Club offers transient dockage and reservations for visiting boaters with reciprocal-club credentials. Contact the General Manager to inquire about availability.</p><p style="color:var(--color-text-muted);font-size:0.95rem;margin-top:2rem">Marina layout, slip dimensions, and berthing application were not migrated from the source. The club admin should upload these PDFs and link them as Resources, or paste the relevant text into this page.</p><p style="color:var(--color-text-muted);font-size:0.95rem">Content ported from <a href="https://www.olddominionboatclub.com/Marina">olddominionboatclub.com/Marina</a> on 2026-04-30.</p></div>',
    false, true, 4, true),
  ('tap-room', 'The Tap Room',
    '<div style="max-width:48rem"><h2>The Tap Room</h2><p>The Tap Room is the Club''s bar and dining room — open to members, members'' guests, and reciprocal-club guests with credentials.</p><h3>What we serve</h3><ul><li>Lunch and dinner service per the published Tap Room hours</li><li>Themed Dinners on a rotating monthly schedule</li><li>Weekend Specials</li><li>Tiki Bar nights with rotating live music in the summer (Black Moon Tonic, Moondaddies, The Hathway Brothers, The Rockits, Lesson Zero, Tristan Dougherty &amp; the Heart Pines, Mac N Cheese)</li></ul><h3>Reservations</h3><p>Tap Room reservations are made through the Club. The current week''s service hours and reservation contact are posted at the entrance and on the Tap Room Service Hours page on the source site. Members can also call <a href="tel:7038361900">(703) 836-1900</a>.</p><h3>Ship''s Store</h3><p>The Ship''s Store sells Club-branded apparel and gifts. Inquire at the front desk.</p><p style="color:var(--color-text-muted);font-size:0.95rem;margin-top:2rem">Content ported from <a href="https://www.olddominionboatclub.com/Tap-Room">olddominionboatclub.com/Tap-Room</a> on 2026-04-30.</p></div>',
    false, true, 5, true),
  ('foundation', 'ODBC Foundation',
    '<div style="max-width:48rem"><img src="https://pr-fya9n5.run402.com/_blob/assets/foundation-header.png" alt="ODBC Foundation" style="width:100%;border-radius:var(--radius);margin-bottom:1.5rem"/><h2>The ODBC Foundation</h2><p>The ODBC Foundation is the Old Dominion Boat Club''s charitable arm — a <strong>501(c)(3) nonprofit</strong> (EIN 84-3701946). The Foundation carries out the Club''s philanthropic goals: youth involvement in water-related sports, and charitable activities promoting the history, culture, and environment of Alexandria, Virginia and surrounding areas.</p><h3>Programs</h3><ul><li><strong>Grants</strong> — applications open at announced points each year. Eligible projects include youth rowing/sailing/safe-boating programs and Alexandria community-service initiatives.</li><li><strong>Foundation Events</strong> — annual Golf Tournament (May), Foundation Fundraiser dinner (November), and special events on the published <a href="/events.html">calendar</a>.</li></ul><h3>Make a donation</h3><p>Donations are tax-deductible to the extent allowed by law. Email <a href="mailto:foundation@olddominionboatclub.com">foundation@olddominionboatclub.com</a> for instructions and acknowledgment letters. The 990-PF is filed annually.</p><h3>Board</h3><p>Bruce Catts, Chairman; John Connor; Stephen D''Antuono; Janice Hobart; MaryBeth Powers; Suzanne Willett.</p><p style="color:var(--color-text-muted);font-size:0.95rem;margin-top:2rem">Content ported from <a href="https://www.olddominionboatclub.com/foundation">olddominionboatclub.com/foundation</a> on 2026-04-30.</p></div>',
    false, true, 6, true),
  ('contact', 'Contact',
    '<div style="max-width:48rem"><h2>Contact the Club</h2><p style="font-size:1.15rem;margin-bottom:1.5rem"><strong>Old Dominion Boat Club</strong><br/>0 Prince Street<br/>Alexandria, Virginia 22314<br/><br/>Telephone: <a href="tel:7038361900">(703) 836-1900</a><br/>General: <a href="mailto:gm@olddominionboatclub.com">gm@olddominionboatclub.com</a></p><h3>By role</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:0.5rem;border-bottom:1px solid var(--color-border)">Role</th><th style="text-align:left;padding:0.5rem;border-bottom:1px solid var(--color-border)">Contact</th></tr></thead><tbody><tr><td style="padding:0.5rem">General Manager — Joe Nelson</td><td style="padding:0.5rem"><a href="mailto:gm@olddominionboatclub.com">gm@olddominionboatclub.com</a></td></tr><tr><td style="padding:0.5rem">Business Manager — Emily Roach</td><td style="padding:0.5rem"><a href="mailto:businessmanager@olddominionboatclub.com">businessmanager@olddominionboatclub.com</a></td></tr><tr><td style="padding:0.5rem">President — Janice Hobart</td><td style="padding:0.5rem"><a href="mailto:president@olddominionboatclub.com">president@olddominionboatclub.com</a></td></tr><tr><td style="padding:0.5rem">Secretary — Bob Waters</td><td style="padding:0.5rem"><a href="mailto:secretary@olddominionboatclub.com">secretary@olddominionboatclub.com</a></td></tr><tr><td style="padding:0.5rem">Treasurer — Kevin Reilly</td><td style="padding:0.5rem"><a href="mailto:treasurer@olddominionboatclub.com">treasurer@olddominionboatclub.com</a></td></tr><tr><td style="padding:0.5rem">Foundation Chair — Bruce Catts</td><td style="padding:0.5rem"><a href="mailto:foundation@olddominionboatclub.com">foundation@olddominionboatclub.com</a></td></tr></tbody></table><h3>Find us</h3><div style="border-radius:var(--radius);overflow:hidden;margin-top:1rem"><iframe src="https://maps.google.com/maps?q=0+Prince+Street,+Alexandria,+VA+22314&z=15&ie=UTF8&output=embed" width="100%" height="300" style="border:0;display:block" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div></div>',
    false, true, 7, true),
  ('history', 'Club History',
    '<div style="max-width:48rem"><h2>Club History</h2><p>Founded <strong>1880</strong>. The Old Dominion Boat Club is one of the oldest active boat clubs on the East Coast.</p><p>The Club maintains a published roster of Past Presidents covering 1880 to the present, broken into eras:</p><ul><li>Past Presidents 1880 - 1941</li><li>Past Presidents 1941 - 1967</li><li>Past Presidents 1967 - 1990</li><li>Past Presidents 1990 - present</li></ul><p>The full roster is available on the source site at <a href="https://www.olddominionboatclub.com/Past-Presidents">olddominionboatclub.com/Past-Presidents</a>. The 250th anniversary of Alexandria (and the Club''s contribution to it) is being marked through 2026 with reserved-date events on the calendar.</p><p style="color:var(--color-text-muted);font-size:0.95rem;margin-top:2rem">Past-Presidents detail not migrated; available at the source.</p></div>',
    false, false, 8, true),
  ('reciprocity', 'Reciprocity Policy',
    '<div style="max-width:48rem"><h2>Our Reciprocity Policy</h2><p>The Old Dominion Boat Club maintains reciprocal arrangements with other private clubs. Visiting members of reciprocal clubs are welcome at the Tap Room and may inquire about transient dockage at the marina, subject to the policies on file with the General Manager.</p><p>Members of ODBC visiting reciprocal clubs should request a current letter of introduction from the General Manager before traveling.</p><p style="color:var(--color-text-muted);font-size:0.95rem;margin-top:2rem">Reciprocal-club list not migrated. Members can request the current list from <a href="mailto:gm@olddominionboatclub.com">the General Manager</a>.</p></div>',
    false, false, 9, true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, content = EXCLUDED.content,
  show_in_nav = EXCLUDED.show_in_nav, nav_position = EXCLUDED.nav_position;

-- ============================================

-- ============================================
-- 6. SECTIONS — composable layout with new block types
-- ============================================
-- Wipe existing sections so the new composable layout takes over cleanly.
-- Idempotent: rerun-safe.
DELETE FROM sections WHERE TRUE;

-- ---------- Header chrome (zone='header', scope='global', applies to all pages) ----------
-- F16: read renderer source first. Configs match silver-pines reference + blocks.ts BLOCK_TYPES.
INSERT INTO sections (page_slug, zone, scope, section_type, config, position, visible) VALUES
  ('*', 'header', 'global', 'brand_header', '{"href": "/"}'::jsonb, 1, true),
  ('*', 'header', 'global', 'nav', '{
    "items": [
      {"label": "Home", "href": "/", "icon": "home", "public": true},
      {"label": "About", "href": "/page.html?slug=about", "icon": "info", "public": true},
      {"label": "Membership", "href": "/page.html?slug=membership", "icon": "user-plus", "public": true},
      {"label": "The Club", "href": "/page.html?slug=about", "icon": "anchor", "public": true,
        "children": [
          {"label": "Marina", "href": "/page.html?slug=marina", "public": true},
          {"label": "Tap Room", "href": "/page.html?slug=tap-room", "public": true},
          {"label": "History", "href": "/page.html?slug=history", "public": true},
          {"label": "Reciprocity", "href": "/page.html?slug=reciprocity", "public": true}
        ]
      },
      {"label": "Foundation", "href": "/page.html?slug=foundation", "icon": "heart", "public": true},
      {"label": "Events", "href": "/events.html", "icon": "calendar", "feature": "feature_events"},
      {"label": "Leadership", "href": "/directory.html", "icon": "users", "public": true},
      {"label": "Forum", "href": "/forum.html", "icon": "message-circle", "feature": "feature_forum"},
      {"label": "Committees", "href": "/committees.html", "icon": "briefcase", "feature": "feature_committees"},
      {"label": "Contact", "href": "/page.html?slug=contact", "icon": "mail", "public": true},
      {"label": "Dashboard", "href": "/admin.html", "icon": "bar-chart-2", "admin": true},
      {"label": "Members", "href": "/admin-members.html", "icon": "users", "admin": true},
      {"label": "Settings", "href": "/admin-settings.html", "icon": "settings", "admin": true}
    ]
  }'::jsonb, 2, true),
  ('*', 'header', 'global', 'sign_in_bar', '{"show_lang_toggle": true, "show_theme_toggle": true}'::jsonb, 3, true);

-- ---------- HOMEPAGE (zone='main', scope='page', page_slug='index') ----------

-- 1. Hero — the marquee photo (Clubhouse from the Potomac), background mode.
--    Uses canonical key `bg_image` (F16: don't use the legacy `image_url` alias).
INSERT INTO sections (page_slug, zone, scope, section_type, config, position, visible) VALUES
  ('index', 'main', 'page', 'hero', '{
    "heading": "Old Dominion Boat Club",
    "subheading": "Founded 1880 on the Potomac at the foot of King Street. A private social and boating club, working marina, Tap Room, and Foundation — at home in Alexandria, Virginia.",
    "bg_image": "https://pr-fya9n5.run402.com/_blob/assets/gallery2.png",
    "cta_text": "About the Club",
    "cta_href": "/page.html?slug=about"
  }'::jsonb, 1, true);

-- 2. Tagline strip — heritage line, large, primary scheme.
INSERT INTO sections (page_slug, zone, scope, section_type, config, position, visible) VALUES
  ('index', 'main', 'page', 'tagline_strip', '{
    "text": "A Proud Part of Alexandria''s History — Since 1880",
    "color_scheme": "primary",
    "size": "large",
    "alignment": "center",
    "icon": "anchor"
  }'::jsonb, 2, true);

-- 3. Promo cards — four areas of the Club. Each links to a page.
INSERT INTO sections (page_slug, zone, scope, section_type, config, position, visible) VALUES
  ('index', 'main', 'page', 'promo_cards', '{
    "heading": "What we do",
    "columns": 4,
    "items": [
      {
        "image_url": "https://pr-fya9n5.run402.com/_blob/assets/marina-banner.png",
        "image_alt": "ODBC marina on the Potomac",
        "title": "Marina",
        "title_position": "bottom",
        "cta_text": "Slip eligibility & guide",
        "cta_href": "/page.html?slug=marina",
        "overlay_color": "rgba(11,39,66,0.45)"
      },
      {
        "image_url": "https://pr-fya9n5.run402.com/_blob/assets/gallery1.png",
        "image_alt": "Anchor at Strand Street",
        "title": "Tap Room",
        "title_position": "bottom",
        "cta_text": "Hours, dinners & Tiki",
        "cta_href": "/page.html?slug=tap-room",
        "overlay_color": "rgba(11,39,66,0.45)"
      },
      {
        "image_url": "https://pr-fya9n5.run402.com/_blob/assets/foundation-header.png",
        "image_alt": "ODBC Foundation",
        "title": "Foundation",
        "title_position": "bottom",
        "cta_text": "501(c)(3) charitable arm",
        "cta_href": "/page.html?slug=foundation",
        "overlay_color": "rgba(11,39,66,0.45)"
      },
      {
        "image_url": "https://pr-fya9n5.run402.com/_blob/assets/about-banner.png",
        "image_alt": "ODBC clubhouse exterior",
        "title": "Membership",
        "title_position": "bottom",
        "cta_text": "Apply with two sponsors",
        "cta_href": "/page.html?slug=membership",
        "overlay_color": "rgba(11,39,66,0.45)"
      }
    ]
  }'::jsonb, 3, true);

-- 4. Events list — homepage preview, sidebar layout, 4 upcoming.
INSERT INTO sections (page_slug, zone, scope, section_type, config, position, visible) VALUES
  ('index', 'main', 'page', 'events_list', '{
    "heading": "Upcoming events",
    "count": 4,
    "filter": "upcoming",
    "layout": "sidebar",
    "show_image": true,
    "show_location": true,
    "show_time": true,
    "color_scheme": "primary"
  }'::jsonb, 4, true);

-- 5. Slideshow — 5 photos rotating; the gallery treatment.
INSERT INTO sections (page_slug, zone, scope, section_type, config, position, visible) VALUES
  ('index', 'main', 'page', 'slideshow', '{
    "heading": "On the river",
    "items": [
      {"src": "https://pr-fya9n5.run402.com/_blob/assets/gallery1.png", "alt": "Anchor at Strand Street", "caption": "King Street docks at the foot of Strand", "href": ""},
      {"src": "https://pr-fya9n5.run402.com/_blob/assets/gallery2.png", "alt": "Clubhouse from the Potomac", "caption": "The clubhouse from the river", "href": ""},
      {"src": "https://pr-fya9n5.run402.com/_blob/assets/gallery3.png", "alt": "Home gallery", "caption": "The Ballroom and deck", "href": ""},
      {"src": "https://pr-fya9n5.run402.com/_blob/assets/gallery4.png", "alt": "ODBC outside", "caption": "Marina-side view", "href": ""},
      {"src": "https://pr-fya9n5.run402.com/_blob/assets/gallery5.png", "alt": "ODBC outside", "caption": "Looking west toward King Street", "href": ""}
    ],
    "auto_rotate_seconds": 5,
    "show_arrows": true,
    "show_dots": true,
    "aspect_ratio": "16/9",
    "fit": "cover",
    "transition": "fade"
  }'::jsonb, 5, true);

-- 6. Membership CTA — call to apply.
INSERT INTO sections (page_slug, zone, scope, section_type, config, position, visible) VALUES
  ('index', 'main', 'page', 'cta', '{
    "heading": "Become a member",
    "text": "Application is by sponsorship and Board approval. Read the steps and find a sponsor.",
    "cta_text": "Membership process",
    "cta_href": "/page.html?slug=membership"
  }'::jsonb, 6, true);

-- 7. Tagline strip — closer line, dark scheme for visual contrast.
INSERT INTO sections (page_slug, zone, scope, section_type, config, position, visible) VALUES
  ('index', 'main', 'page', 'tagline_strip', '{
    "text": "Members ❘ Marina ❘ Tap Room ❘ Foundation",
    "color_scheme": "dark",
    "size": "medium",
    "alignment": "center"
  }'::jsonb, 7, true);

-- ---------- Page banners — page-scoped header chrome on key interior pages ----------
INSERT INTO sections (page_slug, zone, scope, section_type, config, position, visible) VALUES
  ('about', 'header', 'page', 'page_banner', '{
    "image_url": "https://pr-fya9n5.run402.com/_blob/assets/about-banner.png",
    "image_alt": "ODBC clubhouse — Alexandria, Virginia",
    "caption_html": "<strong>About the Old Dominion Boat Club</strong>",
    "height": "medium",
    "overlay_color": "rgba(11,39,66,0.30)"
  }'::jsonb, 10, true),
  ('marina', 'header', 'page', 'page_banner', '{
    "image_url": "https://pr-fya9n5.run402.com/_blob/assets/marina-banner.png",
    "image_alt": "ODBC marina on the Potomac",
    "caption_html": "<strong>The ODBC Marina</strong>",
    "height": "medium",
    "overlay_color": "rgba(11,39,66,0.30)"
  }'::jsonb, 10, true),
  ('foundation', 'header', 'page', 'page_banner', '{
    "image_url": "https://pr-fya9n5.run402.com/_blob/assets/foundation-header.png",
    "image_alt": "ODBC Foundation",
    "caption_html": "<strong>The ODBC Foundation</strong> &mdash; <span style=\"font-weight:400\">501(c)(3) charitable arm</span>",
    "height": "medium",
    "overlay_color": "rgba(11,39,66,0.40)"
  }'::jsonb, 10, true),
  ('membership', 'header', 'page', 'page_banner', '{
    "image_url": "https://pr-fya9n5.run402.com/_blob/assets/about-banner.png",
    "image_alt": "ODBC clubhouse exterior",
    "caption_html": "<strong>Membership</strong>",
    "height": "medium",
    "overlay_color": "rgba(11,39,66,0.40)"
  }'::jsonb, 10, true),
  ('tap-room', 'header', 'page', 'page_banner', '{
    "image_url": "https://pr-fya9n5.run402.com/_blob/assets/gallery1.png",
    "image_alt": "King Street docks",
    "caption_html": "<strong>The Tap Room</strong>",
    "height": "medium",
    "overlay_color": "rgba(11,39,66,0.40)"
  }'::jsonb, 10, true),
  ('contact', 'header', 'page', 'page_banner', '{
    "image_url": "https://pr-fya9n5.run402.com/_blob/assets/gallery2.png",
    "image_alt": "ODBC clubhouse from the Potomac",
    "caption_html": "<strong>Contact</strong> &mdash; <span style=\"font-weight:400\">0 Prince Street, Alexandria VA</span>",
    "height": "medium",
    "overlay_color": "rgba(11,39,66,0.40)"
  }'::jsonb, 10, true);

-- ---------- Footer chrome (zone='footer', scope='global') ----------
INSERT INTO sections (page_slug, zone, scope, section_type, config, position, column_span, visible) VALUES
  ('*', 'footer', 'global', 'footer_address', '{
    "name": "Old Dominion Boat Club",
    "address_lines": ["0 Prince Street", "Alexandria, Virginia 22314"],
    "phone": "(703) 836-1900",
    "email": "gm@olddominionboatclub.com",
    "hours": "Tap Room hours posted weekly"
  }'::jsonb, 1, '1/3', true),
  ('*', 'footer', 'global', 'footer_links', '{
    "columns": [
      {"heading": "The Club", "items": [
        {"label": "About", "href": "/page.html?slug=about"},
        {"label": "Membership", "href": "/page.html?slug=membership"},
        {"label": "Marina", "href": "/page.html?slug=marina"},
        {"label": "Tap Room", "href": "/page.html?slug=tap-room"}
      ]},
      {"heading": "Connect", "items": [
        {"label": "Events", "href": "/events.html"},
        {"label": "Leadership", "href": "/directory.html"},
        {"label": "Foundation", "href": "/page.html?slug=foundation"},
        {"label": "Contact", "href": "/page.html?slug=contact"}
      ]}
    ]
  }'::jsonb, 2, '1/3', true),
  ('*', 'footer', 'global', 'footer_copyright', '{
    "year": "auto",
    "org_name": "Old Dominion Boat Club",
    "admin_contact_label": "Contact the GM",
    "admin_contact_href": "mailto:gm@olddominionboatclub.com"
  }'::jsonb, 3, '1/3', true),
  ('*', 'footer', 'global', 'footer_attribution', '{
    "text": "Ported from Wild Apricot to [Kychon](https://kychon.com) on [Run402](https://run402.com) — 2026-04-30"
  }'::jsonb, 99, '1', true);

-- ============================================
-- 7. EVENTS — full 2026-2028 calendar (74 events scraped from /events)
-- ============================================
-- All starts_at values use America/New_York timezone — Postgres timestamptz
-- handles DST transitions automatically when given the IANA zone name.
-- Events table has no UNIQUE constraint; rerun-safe via DELETE first.
DELETE FROM events WHERE TRUE;

-- May 2026
INSERT INTO events (title, description, starts_at, ends_at, location, image_url) VALUES
  ('2026 ODBC Derby Party', 'Annual Kentucky Derby Party featuring Southern cuisine, derby drinks, betting station, and contests for best dressed and creative hats. A TICKETED EVENT.', '2026-05-02 17:00 America/New_York', '2026-05-02 20:00 America/New_York', 'ODBC Ballroom and Deck', 'https://pr-fya9n5.run402.com/_blob/assets/event-derby.png'),
  ('General Membership Meeting', 'Monthly leadership-focused membership meeting.', '2026-05-04 19:30 America/New_York', '2026-05-04 21:00 America/New_York', 'Ballroom', NULL),
  ('2026 ODBC Foundation Golf Tournament', 'Golf fundraiser with registration, breakfast, and awards reception. Sponsorship opportunities available.', '2026-05-08 08:00 America/New_York', '2026-05-08 16:00 America/New_York', 'Laurel Hill Golf Club', 'https://pr-fya9n5.run402.com/_blob/assets/event-golf.png'),
  ('Board Meeting', 'Monthly Board of Governors meeting, led by the Secretary.', '2026-05-11 19:00 America/New_York', '2026-05-11 21:00 America/New_York', 'Ballroom', NULL),
  ('Season Kickoff Boaters'' Meeting & Mixer', 'Meeting and social hour for boaters to hear about the 2026 season and connect with fellow members.', '2026-05-12 19:00 America/New_York', NULL, 'Ballroom', 'https://pr-fya9n5.run402.com/_blob/assets/event-mixer.png'),
  ('Family Event', 'Family-focused event coordinated by the Bar Committee.', '2026-05-15 17:00 America/New_York', '2026-05-15 19:00 America/New_York', 'Ballroom', NULL),
  ('ODBC Blessing of the Fleet', 'Annual blessing ceremony for boats at 2:00pm, followed by potluck at King Street Docks at 3:00pm.', '2026-05-16 14:00 America/New_York', '2026-05-16 17:00 America/New_York', 'King Street Docks', 'https://pr-fya9n5.run402.com/_blob/assets/event-blessing.png'),
  ('Flag Raising', 'Annual Flag Raising ceremony.', '2026-05-17 11:00 America/New_York', NULL, 'ODBC Marina', 'https://pr-fya9n5.run402.com/_blob/assets/event-flag.png'),
  ('Membership Interviews', 'Membership interviews conducted by the Membership Committee (Melanie Hughes).', '2026-05-18 19:00 America/New_York', '2026-05-18 21:00 America/New_York', 'Ballroom', NULL),
  ('Wednesday Cards', 'Daytime card game social event.', '2026-05-27 12:00 America/New_York', '2026-05-27 15:00 America/New_York', 'Ballroom', NULL);

-- June 2026
INSERT INTO events (title, description, starts_at, ends_at, location, image_url) VALUES
  ('General Membership Meeting', 'Monthly leadership-focused membership meeting.', '2026-06-01 19:30 America/New_York', '2026-06-01 21:00 America/New_York', 'Ballroom', NULL),
  ('Tiki Bar with Black Moon Tonic', 'Evening Tiki Bar event featuring Black Moon Tonic.', '2026-06-05 18:00 America/New_York', NULL, 'Tap Room / Deck', NULL),
  ('Board Meeting', 'Monthly Board of Governors meeting.', '2026-06-08 19:00 America/New_York', '2026-06-08 21:00 America/New_York', 'Ballroom', NULL),
  ('M&B Monthly Meeting', 'Marina and Berth Committee monthly meeting.', '2026-06-09 18:30 America/New_York', NULL, 'Ballroom', NULL),
  ('Wine Tasting', 'Wine tasting social event.', '2026-06-13 16:00 America/New_York', '2026-06-13 18:00 America/New_York', 'Ballroom', NULL),
  ('Commodores'' Ball', 'Formal ball event presided over by the Commodore.', '2026-06-20 18:30 America/New_York', NULL, 'Ballroom', NULL),
  ('Wednesday Cards', 'Daytime card game social event.', '2026-06-24 12:00 America/New_York', '2026-06-24 15:00 America/New_York', 'Ballroom', NULL),
  ('Tiki Bar', 'Evening Tiki Bar event.', '2026-06-26 18:00 America/New_York', NULL, 'Tap Room / Deck', NULL);

-- July 2026
INSERT INTO events (title, description, starts_at, ends_at, location, image_url) VALUES
  ('250th Celebration (reserved)', 'Reserved date for 250th anniversary celebration coordinated with the City of Alexandria.', '2026-07-04 12:00 America/New_York', NULL, 'Alexandria', NULL),
  ('General Membership Meeting', 'Monthly leadership-focused membership meeting.', '2026-07-06 19:30 America/New_York', '2026-07-06 21:00 America/New_York', 'Ballroom', NULL),
  ('Tiki Bar with Moondaddies', 'Evening Tiki Bar event featuring the Moondaddies band.', '2026-07-10 18:00 America/New_York', NULL, 'Tap Room / Deck', NULL),
  ('Alexandria 250th + ODBC Events', 'Alexandria 250th anniversary celebration with ODBC events.', '2026-07-11 12:00 America/New_York', NULL, 'Alexandria', NULL),
  ('Board Meeting', 'Monthly Board of Governors meeting.', '2026-07-13 19:00 America/New_York', '2026-07-13 21:00 America/New_York', 'Ballroom', NULL),
  ('M&B Monthly Meeting', 'Marina and Berth Committee monthly meeting.', '2026-07-14 18:30 America/New_York', NULL, 'Ballroom', NULL),
  ('Tiki Bar with The Hathway Brothers', 'Evening Tiki Bar event featuring The Hathway Brothers.', '2026-07-17 18:00 America/New_York', NULL, 'Tap Room / Deck', NULL),
  ('Tiki Bar with The Rockits', 'Evening Tiki Bar event featuring The Rockits.', '2026-07-24 18:00 America/New_York', NULL, 'Tap Room / Deck', NULL),
  ('Wednesday Cards', 'Daytime card game social event.', '2026-07-29 12:00 America/New_York', '2026-07-29 15:00 America/New_York', 'Ballroom', NULL),
  ('Tiki Bar with Lesson Zero', 'Evening Tiki Bar event featuring Lesson Zero.', '2026-07-31 18:00 America/New_York', NULL, 'Tap Room / Deck', NULL);

-- August 2026
INSERT INTO events (title, description, starts_at, ends_at, location, image_url) VALUES
  ('General Membership Meeting', 'Monthly leadership-focused membership meeting.', '2026-08-03 19:30 America/New_York', '2026-08-03 21:00 America/New_York', 'Ballroom', NULL),
  ('Appetizer Challenge — Dock event', 'Dock-based appetizer competition event.', '2026-08-08 17:00 America/New_York', NULL, 'Docks', NULL),
  ('Board Meeting', 'Monthly Board of Governors meeting.', '2026-08-10 19:00 America/New_York', '2026-08-10 21:00 America/New_York', 'Ballroom', NULL),
  ('M&B Monthly Meeting', 'Marina and Berth Committee monthly meeting.', '2026-08-11 18:30 America/New_York', NULL, 'Ballroom', NULL),
  ('Tiki Bar', 'Evening Tiki Bar event.', '2026-08-14 18:00 America/New_York', NULL, 'Tap Room / Deck', NULL),
  ('Foundation Event', 'ODBC Foundation event with details to follow.', '2026-08-22 09:00 America/New_York', '2026-08-22 22:00 America/New_York', 'Ballroom / BR Deck', NULL),
  ('Membership Interviews', 'Membership interviews conducted by the Membership Committee.', '2026-08-24 19:00 America/New_York', '2026-08-24 21:00 America/New_York', 'Ballroom', NULL),
  ('Wednesday Cards', 'Daytime card game social event.', '2026-08-26 12:00 America/New_York', '2026-08-26 15:00 America/New_York', 'Ballroom', NULL),
  ('Tiki Bar', 'Evening Tiki Bar event.', '2026-08-28 18:00 America/New_York', NULL, 'Tap Room / Deck', NULL);

-- September 2026
INSERT INTO events (title, description, starts_at, ends_at, location, image_url) VALUES
  ('M&B Monthly Meeting', 'Marina and Berth Committee monthly meeting.', '2026-09-08 18:30 America/New_York', NULL, 'Ballroom', NULL),
  ('Tiki Bar — Tristan Dougherty & the Heart Pines', 'Evening Tiki Bar event featuring Tristan Dougherty and the Heart Pines.', '2026-09-11 18:00 America/New_York', NULL, 'Tap Room / Deck', NULL),
  ('Dock Party', 'Social gathering at the docks.', '2026-09-12 16:00 America/New_York', NULL, 'Docks', NULL),
  ('General Membership Meeting', 'Monthly leadership-focused membership meeting.', '2026-09-14 19:30 America/New_York', '2026-09-14 21:00 America/New_York', 'Ballroom', NULL),
  ('ODBC Cup Invitational Regatta — Awards Party & BBQ', 'Regatta awards celebration with BBQ. A TICKETED EVENT.', '2026-09-19 09:00 America/New_York', '2026-09-19 18:00 America/New_York', 'ODBC Ballroom', NULL),
  ('Board Meeting', 'Monthly Board of Governors meeting.', '2026-09-21 19:00 America/New_York', '2026-09-21 21:00 America/New_York', 'Ballroom', NULL),
  ('Tiki Bar with Mac N Cheese', 'Evening Tiki Bar event featuring Mac N Cheese.', '2026-09-25 18:00 America/New_York', NULL, 'Tap Room / Deck', NULL),
  ('Oktoberfest', 'Oktoberfest celebration event.', '2026-09-26 17:00 America/New_York', '2026-09-26 21:00 America/New_York', 'Ballroom', 'https://pr-fya9n5.run402.com/_blob/assets/event-themed.png'),
  ('Taco Trivia', 'Trivia competition with taco theme.', '2026-09-29 18:30 America/New_York', NULL, 'Tap Room', NULL),
  ('Wednesday Cards', 'Daytime card game social event.', '2026-09-30 12:00 America/New_York', '2026-09-30 15:00 America/New_York', 'Ballroom', NULL);

-- October 2026
INSERT INTO events (title, description, starts_at, ends_at, location, image_url) VALUES
  ('General Membership Meeting', 'Monthly leadership-focused membership meeting.', '2026-10-05 19:30 America/New_York', '2026-10-05 21:00 America/New_York', 'Ballroom', NULL),
  ('M&B Meeting / Boaters Meeting', 'Semi-annual boaters meeting with M&B committee discussion of season topics.', '2026-10-13 18:30 America/New_York', '2026-10-13 21:00 America/New_York', 'Ballroom', NULL),
  ('Board Meeting', 'Monthly Board of Governors meeting.', '2026-10-19 19:00 America/New_York', '2026-10-19 21:00 America/New_York', 'Ballroom', NULL),
  ('Halloween 2026', 'Halloween costume celebration. A TICKETED EVENT.', '2026-10-24 19:30 America/New_York', '2026-10-24 23:00 America/New_York', 'ODBC Ballroom', NULL),
  ('Membership Interviews', 'Membership interviews conducted by the Membership Committee.', '2026-10-26 19:00 America/New_York', '2026-10-26 21:00 America/New_York', 'Ballroom', NULL),
  ('Taco Trivia', 'Trivia competition with taco theme.', '2026-10-27 18:30 America/New_York', NULL, 'Tap Room', NULL),
  ('Wednesday Cards', 'Daytime card game social event.', '2026-10-28 12:00 America/New_York', '2026-10-28 15:00 America/New_York', 'Ballroom', NULL);

-- November 2026
INSERT INTO events (title, description, starts_at, ends_at, location, image_url) VALUES
  ('General Membership Meeting', 'Monthly leadership-focused membership meeting.', '2026-11-02 19:30 America/New_York', '2026-11-02 21:00 America/New_York', 'Ballroom', NULL),
  ('Foundation Fundraiser Dinner', 'ODBC Foundation fundraising dinner event.', '2026-11-04 18:30 America/New_York', NULL, 'Ballroom', NULL),
  ('Board Meeting', 'Monthly Board of Governors meeting.', '2026-11-09 19:00 America/New_York', '2026-11-09 21:00 America/New_York', 'Ballroom', NULL),
  ('ODBC Marine Corps Birthday Celebration', 'Celebration of Marine Corps birthday with appetizers and traditional ceremony.', '2026-11-10 18:00 America/New_York', NULL, 'Ballroom', NULL),
  ('Wine Tasting', 'Wine tasting social event.', '2026-11-14 16:00 America/New_York', NULL, 'Ballroom', NULL),
  ('M&B Monthly Meeting', 'Marina and Berth Committee monthly meeting.', '2026-11-17 18:30 America/New_York', NULL, 'Ballroom', NULL),
  ('Speakeasy', 'Speakeasy-themed evening social event.', '2026-11-20 19:00 America/New_York', '2026-11-20 22:00 America/New_York', 'Ballroom', NULL),
  ('Taco Trivia', 'Trivia competition with taco theme.', '2026-11-24 18:30 America/New_York', NULL, 'Tap Room', NULL);

-- December 2026
INSERT INTO events (title, description, starts_at, ends_at, location, image_url) VALUES
  ('Wednesday Cards', 'Daytime card game social event.', '2026-12-02 12:00 America/New_York', '2026-12-02 15:00 America/New_York', 'Ballroom', NULL),
  ('Oyster Roast', 'Annual Oyster Roast with reserved Ballroom and deck space.', '2026-12-05 09:00 America/New_York', '2026-12-05 22:00 America/New_York', 'Ballroom', NULL),
  ('General Membership Meeting', 'Monthly leadership-focused membership meeting.', '2026-12-07 19:30 America/New_York', '2026-12-07 21:00 America/New_York', 'Ballroom', NULL),
  ('Board Meeting', 'Monthly Board of Governors meeting.', '2026-12-14 19:00 America/New_York', '2026-12-14 21:00 America/New_York', 'Ballroom', NULL),
  ('Trivia', 'Evening trivia competition.', '2026-12-15 18:30 America/New_York', '2026-12-15 21:00 America/New_York', 'Tap Room', NULL),
  ('Ugly Sweater Contest', 'Holiday-themed ugly sweater competition.', '2026-12-18 19:00 America/New_York', NULL, 'Ballroom', NULL),
  ('Children''s Holiday Party', 'Holiday celebration for children.', '2026-12-19 14:00 America/New_York', NULL, 'Ballroom', NULL),
  ('New Year''s Eve 2026', 'New Year''s Eve celebration. A TICKETED EVENT.', '2026-12-31 20:30 America/New_York', '2027-01-01 01:30 America/New_York', 'ODBC Ballroom and Tap Room', NULL);

-- 2027
INSERT INTO events (title, description, starts_at, ends_at, location, image_url) VALUES
  ('Board of Governors'' Cocktail Party and Change of Command', 'Annual governance ceremony with complimentary cocktail reception and gala.', '2027-01-16 18:30 America/New_York', '2027-01-16 23:00 America/New_York', 'Entire Clubhouse', NULL),
  ('ODBC Derby Party', 'Kentucky Derby celebration event.', '2027-05-01 17:30 America/New_York', '2027-05-01 20:00 America/New_York', 'Ballroom and Deck', 'https://pr-fya9n5.run402.com/_blob/assets/event-derby.png'),
  ('Oyster Roast', 'Annual Oyster Roast with reserved Ballroom and deck space.', '2027-12-04 09:00 America/New_York', '2027-12-04 22:00 America/New_York', 'Ballroom', NULL);

-- 2028
INSERT INTO events (title, description, starts_at, ends_at, location, image_url) VALUES
  ('ODBC Derby Party', 'Kentucky Derby celebration event.', '2028-05-06 17:30 America/New_York', '2028-05-06 20:00 America/New_York', 'Ballroom and Deck', 'https://pr-fya9n5.run402.com/_blob/assets/event-derby.png');

-- ============================================
-- 8. COMMITTEES + COMMITTEE_MEMBERS
-- ============================================
-- Committee names inferred from event references (M&B, Bar, Membership) and
-- Wild Apricot conventions (House, Events, Foundation, Reciprocity).

INSERT INTO committees (name, description)
SELECT 'Marina & Berth (M&B)', 'Oversees the marina facility, slip assignments, transient dockage, and the seasonal Boaters'' Meeting. Meets the second Tuesday of most months at 6:30 PM in the Ballroom.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Marina & Berth (M&B)');

INSERT INTO committees (name, description)
SELECT 'Membership', 'Reviews applications, conducts membership interviews, and recommends candidates to the Board. Interviews held several times each year (see events).'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Membership');

INSERT INTO committees (name, description)
SELECT 'Events', 'Organizes the social calendar — Derby Party, Halloween, Speakeasy, Wine Tastings, Family Events, Holiday Parties.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Events');

INSERT INTO committees (name, description)
SELECT 'Bar', 'Runs the Tap Room program: weekly specials, themed dinners, summer Tiki Bar nights with live music, and the Family Event series.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Bar');

INSERT INTO committees (name, description)
SELECT 'House', 'Cares for the Clubhouse, Ballroom, and Deck — facilities maintenance, AV, and event setup.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'House');

INSERT INTO committees (name, description)
SELECT 'Reciprocity', 'Maintains reciprocal arrangements with other private clubs and issues letters of introduction for ODBC members traveling.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Reciprocity');

INSERT INTO committees (name, description)
SELECT 'Foundation', 'The ODBC Foundation Board — a 501(c)(3) nonprofit (EIN 84-3701946) supporting youth water sports and Alexandria community programs.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Foundation');

-- Committee chairs / members (from custom_fields.committees on each member)
INSERT INTO committee_members (committee_id, member_id, role)
SELECT c.id, m.id, 'chair' FROM committees c, members m
WHERE c.name = 'Marina & Berth (M&B)' AND m.email = 'commodore@olddominionboatclub.com'
ON CONFLICT (committee_id, member_id) DO NOTHING;

INSERT INTO committee_members (committee_id, member_id, role)
SELECT c.id, m.id, 'member' FROM committees c, members m
WHERE c.name = 'Marina & Berth (M&B)' AND m.email = 'gov.dauray@odbc-club.invalid'
ON CONFLICT (committee_id, member_id) DO NOTHING;

INSERT INTO committee_members (committee_id, member_id, role)
SELECT c.id, m.id, 'chair' FROM committees c, members m
WHERE c.name = 'Membership' AND m.email = 'chairman@olddominionboatclub.com'
ON CONFLICT (committee_id, member_id) DO NOTHING;

INSERT INTO committee_members (committee_id, member_id, role)
SELECT c.id, m.id, 'member' FROM committees c, members m
WHERE c.name = 'Membership' AND m.email IN ('vp@olddominionboatclub.com', 'gov.thomas@odbc-club.invalid')
ON CONFLICT (committee_id, member_id) DO NOTHING;

INSERT INTO committee_members (committee_id, member_id, role)
SELECT c.id, m.id, 'member' FROM committees c, members m
WHERE c.name = 'Events' AND m.email IN ('gov.beresford@odbc-club.invalid', 'gov.rogan@odbc-club.invalid')
ON CONFLICT (committee_id, member_id) DO NOTHING;

INSERT INTO committee_members (committee_id, member_id, role)
SELECT c.id, m.id, 'member' FROM committees c, members m
WHERE c.name = 'Bar' AND m.email IN ('treasurer@olddominionboatclub.com', 'gov.rogan@odbc-club.invalid', 'businessmanager@olddominionboatclub.com')
ON CONFLICT (committee_id, member_id) DO NOTHING;

INSERT INTO committee_members (committee_id, member_id, role)
SELECT c.id, m.id, 'member' FROM committees c, members m
WHERE c.name = 'House' AND m.email IN ('secretary@olddominionboatclub.com', 'gov.whitestone@odbc-club.invalid', 'gm@olddominionboatclub.com')
ON CONFLICT (committee_id, member_id) DO NOTHING;

INSERT INTO committee_members (committee_id, member_id, role)
SELECT c.id, m.id, 'member' FROM committees c, members m
WHERE c.name = 'Reciprocity' AND m.email = 'gov.welch@odbc-club.invalid'
ON CONFLICT (committee_id, member_id) DO NOTHING;

INSERT INTO committee_members (committee_id, member_id, role)
SELECT c.id, m.id, 'chair' FROM committees c, members m
WHERE c.name = 'Foundation' AND m.email = 'foundation@olddominionboatclub.com'
ON CONFLICT (committee_id, member_id) DO NOTHING;

INSERT INTO committee_members (committee_id, member_id, role)
SELECT c.id, m.id, 'member' FROM committees c, members m
WHERE c.name = 'Foundation' AND m.email IN (
  'president@olddominionboatclub.com',
  'foundation.connor@odbc-club.invalid',
  'foundation.dantuono@odbc-club.invalid',
  'foundation.powers@odbc-club.invalid',
  'foundation.willett@odbc-club.invalid'
)
ON CONFLICT (committee_id, member_id) DO NOTHING;

-- ============================================
-- 9. ANNOUNCEMENTS
-- ============================================

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'Welcome to the new ODBC member portal',
  '<p>This is the Club''s new member portal — running the <strong>Kychon</strong> engine on Run402, ported from the existing Wild Apricot site on 2026-04-30. Public content (events, leadership, foundation, contact) is migrated. Member-only data (full roster, marina maps, application packet PDFs, Past Presidents archive) still lives on the original site at olddominionboatclub.com — work with the General Manager to migrate that next.</p><p>If you spot anything off — wrong dates, broken images, missing pages — email <a href="mailto:gm@olddominionboatclub.com">gm@olddominionboatclub.com</a>.</p>',
  true,
  (SELECT id FROM members WHERE email = 'president@olddominionboatclub.com'),
  now() - interval '1 hour'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Welcome to the new ODBC member portal');

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT 'Boating season is here — May calendar is loaded',
  '<p>The full May–December 2026 calendar is on the <a href="/events.html">events</a> page: Derby Party (May 2), Golf Tournament (May 8), Boaters'' Mixer (May 12), Blessing of the Fleet (May 16), Flag Raising (May 17), and Tiki Bar nights all summer with live music. Members can RSVP from each event page.</p>',
  false,
  (SELECT id FROM members WHERE email = 'commodore@olddominionboatclub.com'),
  now() - interval '2 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Boating season is here — May calendar is loaded');

INSERT INTO announcements (title, body, is_pinned, author_id, created_at)
SELECT '2026 dues and initiation fees',
  '<p>Reminder: 2026 initiation is <strong>$6,000</strong> for new Active Members, plus the non-refundable <strong>$1,500</strong> application fee at packet submission. Annual dues invoices are billed by the Business Manager. Questions: <a href="mailto:businessmanager@olddominionboatclub.com">Emily Roach</a>.</p>',
  false,
  (SELECT id FROM members WHERE email = 'treasurer@olddominionboatclub.com'),
  now() - interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = '2026 dues and initiation fees');

-- ============================================
-- 10. FORUM CATEGORIES (empty topics — for future use)
-- ============================================

INSERT INTO forum_categories (name, description, position, color)
SELECT 'On the Water', 'Trip reports, marina questions, weather, gear talk', 1, '#0B2742'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'On the Water');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Tap Room & Events', 'What''s on this week, ride-sharing to events, recap photos', 2, '#B5853A'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Tap Room & Events');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Members Helping Members', 'Recommendations, marketplace, lost & found', 3, '#5A6470'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Members Helping Members');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Foundation', 'ODBC Foundation grants, fundraisers, and youth-program updates', 4, '#A33D2C'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Foundation');

-- End of seed.sql
