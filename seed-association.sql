-- ============================================
-- Wild Lychee — Professional Association Seed Variant (idempotent)
-- For trade groups, chambers, and professional bodies
-- ============================================

-- Branding
INSERT INTO site_config (key, value, category) VALUES
  ('site_name', '"Professional Association"', 'branding'),
  ('site_tagline', '"Advancing excellence in our profession"', 'branding'),
  ('site_description', '"Member portal for our professional association — directory, events, committees, and resources."', 'branding')
ON CONFLICT (key) DO NOTHING;

-- Theme (navy + teal)
INSERT INTO site_config (key, value, category) VALUES
  ('theme', '{
    "primary": "#0f4c75",
    "primary_hover": "#0b3d61",
    "bg": "#ffffff",
    "surface": "#f8fafc",
    "text": "#1a1a2e",
    "text_muted": "#6b7280",
    "border": "#d1d5db",
    "font_heading": "Inter",
    "font_body": "Inter",
    "radius": "0.375rem",
    "max_width": "72rem"
  }', 'theme')
ON CONFLICT (key) DO NOTHING;

-- Feature flags
INSERT INTO site_config (key, value, category) VALUES
  ('feature_events', 'true', 'features'),
  ('feature_forum', 'true', 'features'),
  ('feature_directory', 'true', 'features'),
  ('feature_resources', 'true', 'features'),
  ('feature_blog', 'false', 'features'),
  ('feature_committees', 'true', 'features'),
  ('feature_ai_moderation', 'false', 'features'),
  ('feature_ai_translation', 'false', 'features'),
  ('feature_ai_newsletter', 'false', 'features'),
  ('feature_ai_insights', 'false', 'features'),
  ('feature_ai_onboarding', 'false', 'features'),
  ('feature_ai_event_recaps', 'false', 'features'),
  ('directory_public', 'false', 'features'),
  ('signup_mode', '"approved"', 'features')
ON CONFLICT (key) DO NOTHING;

-- Navigation (directory-focused)
INSERT INTO site_config (key, value, category) VALUES
  ('nav', '[
    {"label": "Home", "href": "/", "icon": "home", "public": true},
    {"label": "Directory", "href": "/directory.html", "icon": "users", "auth": true, "feature": "feature_directory"},
    {"label": "Events", "href": "/events.html", "icon": "calendar", "feature": "feature_events"},
    {"label": "Resources", "href": "/resources.html", "icon": "book-open", "feature": "feature_resources"},
    {"label": "Forum", "href": "/forum.html", "icon": "message-circle", "feature": "feature_forum"},
    {"label": "Committees", "href": "/committees.html", "icon": "briefcase", "feature": "feature_committees"},
    {"label": "Dashboard", "href": "/admin.html", "icon": "bar-chart-2", "admin": true},
    {"label": "Members", "href": "/admin-members.html", "icon": "users", "admin": true},
    {"label": "Settings", "href": "/admin-settings.html", "icon": "settings", "admin": true}
  ]', 'nav')
ON CONFLICT (key) DO NOTHING;

-- Membership tiers (association hierarchy)
INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Student', 'Student member', ARRAY['Directory access', 'Events', 'Resources'], '$25/year', 1, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Student');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Associate', 'Associate member', ARRAY['Full directory', 'Events', 'Resources', 'Forum'], '$75/year', 2, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Associate');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Member', 'Full member', ARRAY['Full directory', 'Events', 'Resources', 'Forum', 'Committees', 'Voting'], '$150/year', 3, true
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Member');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Fellow', 'Distinguished fellow', ARRAY['Full access', 'Committee leadership', 'Voting', 'Fellow designation'], '$200/year', 4, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Fellow');

-- Custom fields (company/organization)
INSERT INTO member_custom_fields (field_name, field_label, field_type, required, visible_in_directory, position)
SELECT 'company', 'Company / Organization', 'text', false, true, 1
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'company');

INSERT INTO member_custom_fields (field_name, field_label, field_type, required, visible_in_directory, position)
SELECT 'job_title', 'Job Title', 'text', false, true, 2
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'job_title');

-- Committees
INSERT INTO committees (name, description)
SELECT 'Executive Board', 'Association governance and strategic direction'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Executive Board');

INSERT INTO committees (name, description)
SELECT 'Events Committee', 'Planning conferences, workshops, and networking events'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Events Committee');

INSERT INTO committees (name, description)
SELECT 'Standards Committee', 'Developing and maintaining professional standards'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Standards Committee');

INSERT INTO committees (name, description)
SELECT 'Membership Committee', 'Reviewing applications and member engagement'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Membership Committee');

-- Forum categories
INSERT INTO forum_categories (name, description, position, color)
SELECT 'Industry News', 'Discuss trends and developments in our field', 1, '#0f4c75'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Industry News');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Best Practices', 'Share and discuss professional best practices', 2, '#059669'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Best Practices');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Career Development', 'Job opportunities, mentoring, and career advice', 3, '#d97706'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Career Development');

-- Homepage sections
INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'hero', '{
  "heading": "Welcome to the Association",
  "subheading": "Connecting professionals. Advancing our industry. Building your career.",
  "cta_text": "Join Today",
  "cta_href": "#signup"
}', 1, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'hero');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'features', '{
  "columns": 3,
  "items": [
    {"icon": "users", "title": "Member Directory", "desc": "Find and connect with professionals in our field."},
    {"icon": "calendar", "title": "Events & Conferences", "desc": "Workshops, networking events, and annual conference."},
    {"icon": "book-open", "title": "Resources", "desc": "Publications, standards, and professional development materials."}
  ]
}', 2, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'features');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'cta', '{
  "heading": "Advance Your Career",
  "text": "Join our network of professionals and gain access to exclusive resources, events, and opportunities.",
  "cta_text": "Become a Member",
  "cta_href": "#signup"
}', 3, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'cta');
