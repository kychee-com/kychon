-- ============================================
-- Wild Lychee — Church Seed Variant (idempotent)
-- For evangelical churches and religious orgs
-- ============================================

-- Branding
INSERT INTO site_config (key, value, category) VALUES
  ('site_name', '"Igreja da Esperança"', 'branding'),
  ('site_tagline', '"A community of faith, hope, and love"', 'branding'),
  ('site_description', '"Welcome to our church community portal — connect, grow, and serve together."', 'branding')
ON CONFLICT (key) DO NOTHING;

-- Theme (deep blue + gold)
INSERT INTO site_config (key, value, category) VALUES
  ('theme', '{
    "primary": "#1e3a5f",
    "primary_hover": "#152c4a",
    "bg": "#ffffff",
    "surface": "#f5f7fa",
    "text": "#1a1a2e",
    "text_muted": "#6b7280",
    "border": "#d1d5db",
    "font_heading": "Merriweather",
    "font_body": "Open Sans",
    "radius": "0.5rem",
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

-- Navigation
INSERT INTO site_config (key, value, category) VALUES
  ('nav', '[
    {"label": "Home", "href": "/", "icon": "home", "public": true},
    {"label": "Members", "href": "/directory.html", "icon": "users", "auth": true, "feature": "feature_directory"},
    {"label": "Events", "href": "/events.html", "icon": "calendar", "feature": "feature_events"},
    {"label": "Sermons", "href": "/resources.html", "icon": "book-open", "feature": "feature_resources"},
    {"label": "Forum", "href": "/forum.html", "icon": "message-circle", "feature": "feature_forum"},
    {"label": "Ministries", "href": "/committees.html", "icon": "heart", "feature": "feature_committees"},
    {"label": "Dashboard", "href": "/admin.html", "icon": "bar-chart-2", "admin": true},
    {"label": "Members", "href": "/admin-members.html", "icon": "users", "admin": true},
    {"label": "Settings", "href": "/admin-settings.html", "icon": "settings", "admin": true}
  ]', 'nav')
ON CONFLICT (key) DO NOTHING;

-- Membership tiers (church roles)
INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Visitor', 'Welcome visitors', ARRAY['View announcements', 'Events calendar'], 'Free', 1, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Visitor');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Member', 'Baptized church member', ARRAY['Member directory', 'Forum', 'Sermons', 'Events', 'Ministries'], 'Free', 2, true
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Member');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Elder', 'Church elder', ARRAY['Member directory', 'Forum', 'Sermons', 'Events', 'Ministries', 'Pastoral care'], 'Free', 3, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Elder');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Pastor', 'Church pastor', ARRAY['Full access', 'Admin tools', 'Pastoral care', 'Sermons management'], 'Free', 4, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Pastor');

-- Committees (ministries)
INSERT INTO committees (name, description)
SELECT 'Youth Ministry', 'Activities, events, and discipleship for young people'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Youth Ministry');

INSERT INTO committees (name, description)
SELECT 'Worship Team', 'Music and worship coordination for services'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Worship Team');

INSERT INTO committees (name, description)
SELECT 'Deacons', 'Practical service and community care'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Deacons');

-- Forum categories
INSERT INTO forum_categories (name, description, position, color)
SELECT 'Prayer Requests', 'Share your prayer requests with the community', 1, '#6366f1'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Prayer Requests');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Bible Study', 'Discuss scripture and study materials', 2, '#059669'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Bible Study');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'General', 'General church discussions', 3, '#d97706'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'General');

-- Homepage sections
INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'hero', '{
  "heading": "Welcome to Igreja da Esperança",
  "subheading": "A community of faith, hope, and love. Join us for worship and fellowship.",
  "cta_text": "Join Our Community",
  "cta_href": "#signup"
}', 1, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'hero');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'features', '{
  "columns": 3,
  "items": [
    {"icon": "book-open", "title": "Sermons", "desc": "Watch and listen to our sermons online."},
    {"icon": "calendar", "title": "Events", "desc": "Stay updated on services, prayer groups, and youth nights."},
    {"icon": "heart", "title": "Prayer Requests", "desc": "Share your prayer requests and support one another."}
  ]
}', 2, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'features');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'cta', '{
  "heading": "Join Our Family",
  "text": "We would love to welcome you into our church community.",
  "cta_text": "Get Started",
  "cta_href": "#signup"
}', 3, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'cta');
