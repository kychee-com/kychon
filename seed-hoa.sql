-- ============================================
-- Kychon — HOA / Condo Seed Variant (idempotent)
-- For homeowners associations and condo boards
-- ============================================

-- Branding
INSERT INTO site_config (key, value, category) VALUES
  ('site_name', '"Riverside HOA"', 'branding'),
  ('site_tagline', '"Your neighborhood, connected"', 'branding'),
  ('site_description', '"Resident portal for Riverside Homeowners Association — stay informed and get involved."', 'branding')
ON CONFLICT (key) DO NOTHING;

-- Theme (green + slate)
INSERT INTO site_config (key, value, category) VALUES
  ('theme', '{
    "primary": "#047857",
    "primary_hover": "#065f46",
    "bg": "#ffffff",
    "surface": "#f0fdf4",
    "text": "#1a1a2e",
    "text_muted": "#6b7280",
    "border": "#d1d5db",
    "font_heading": "Inter",
    "font_body": "Inter",
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
    {"label": "Residents", "href": "/directory.html", "icon": "users", "auth": true, "feature": "feature_directory"},
    {"label": "Events", "href": "/events.html", "icon": "calendar", "feature": "feature_events"},
    {"label": "Documents", "href": "/resources.html", "icon": "file-text", "feature": "feature_resources"},
    {"label": "Forum", "href": "/forum.html", "icon": "message-circle", "feature": "feature_forum"},
    {"label": "Board", "href": "/committees.html", "icon": "briefcase", "feature": "feature_committees"},
    {"label": "Dashboard", "href": "/admin.html", "icon": "bar-chart-2", "admin": true},
    {"label": "Residents", "href": "/admin-members.html", "icon": "users", "admin": true},
    {"label": "Settings", "href": "/admin-settings.html", "icon": "settings", "admin": true}
  ]', 'nav')
ON CONFLICT (key) DO NOTHING;

-- Membership tiers (HOA roles)
INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Tenant', 'Renting resident', ARRAY['Announcements', 'Events', 'Forum'], 'Free', 1, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Tenant');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Resident', 'Homeowner', ARRAY['Full directory', 'Documents', 'Forum', 'Events', 'Voting'], 'Free', 2, true
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Resident');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Board Member', 'HOA board member', ARRAY['Full access', 'Admin tools', 'Document management', 'Voting management'], 'Free', 3, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Board Member');

-- Committees (HOA structure)
INSERT INTO committees (name, description)
SELECT 'Board of Directors', 'Elected board managing HOA operations'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Board of Directors');

INSERT INTO committees (name, description)
SELECT 'Architectural Review', 'Reviews and approves exterior modifications'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Architectural Review');

INSERT INTO committees (name, description)
SELECT 'Landscaping', 'Common area maintenance and improvements'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Landscaping');

-- Forum categories
INSERT INTO forum_categories (name, description, position, color)
SELECT 'Maintenance Requests', 'Report issues and track maintenance', 1, '#dc2626'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Maintenance Requests');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Community Discussion', 'General neighborhood discussion', 2, '#6366f1'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Community Discussion');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Board Announcements', 'Official communications from the board', 3, '#047857'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Board Announcements');

-- Homepage sections
INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'hero', '{
  "heading": "Welcome to Riverside HOA",
  "subheading": "Your neighborhood portal — announcements, documents, events, and more.",
  "cta_text": "Resident Login",
  "cta_href": "#signup"
}', 1, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'hero');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'features', '{
  "columns": 3,
  "items": [
    {"icon": "file-text", "title": "Documents", "desc": "Access bylaws, meeting minutes, budgets, and official notices."},
    {"icon": "calendar", "title": "Events", "desc": "HOA meetings, community events, and deadlines."},
    {"icon": "message-circle", "title": "Maintenance", "desc": "Submit and track maintenance requests for common areas."}
  ]
}', 2, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'features');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'cta', '{
  "heading": "Stay Connected",
  "text": "Sign up for your resident account to access documents, forums, and community events.",
  "cta_text": "Get Started",
  "cta_href": "#signup"
}', 3, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'cta');
