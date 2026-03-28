-- ============================================
-- Wild Lychee — Seed Data (idempotent)
-- ============================================

-- Branding
INSERT INTO site_config (key, value, category) VALUES
  ('site_name', '"Wild Lychee Community"', 'branding'),
  ('site_tagline', '"Your AI-powered community platform"', 'branding'),
  ('site_description', '"A modern membership portal — own your data, customize with AI."', 'branding'),
  ('logo_url', '""', 'branding'),
  ('favicon_url', '""', 'branding')
ON CONFLICT (key) DO NOTHING;

-- Theme
INSERT INTO site_config (key, value, category) VALUES
  ('theme', '{
    "primary": "#6366f1",
    "primary_hover": "#4f46e5",
    "bg": "#ffffff",
    "surface": "#f8fafc",
    "text": "#0f172a",
    "text_muted": "#64748b",
    "border": "#e2e8f0",
    "font_heading": "Inter",
    "font_body": "Inter",
    "radius": "0.5rem",
    "max_width": "72rem"
  }', 'theme')
ON CONFLICT (key) DO NOTHING;

-- Feature flags
INSERT INTO site_config (key, value, category) VALUES
  ('feature_events', 'true', 'features'),
  ('feature_forum', 'false', 'features'),
  ('feature_directory', 'true', 'features'),
  ('feature_resources', 'true', 'features'),
  ('feature_blog', 'false', 'features'),
  ('feature_committees', 'false', 'features'),
  ('feature_ai_moderation', 'false', 'features'),
  ('feature_ai_translation', 'false', 'features'),
  ('feature_ai_newsletter', 'false', 'features'),
  ('feature_ai_insights', 'false', 'features'),
  ('feature_ai_onboarding', 'false', 'features'),
  ('directory_public', 'false', 'features'),
  ('signup_mode', '"approved"', 'features')
ON CONFLICT (key) DO NOTHING;

-- Navigation
INSERT INTO site_config (key, value, category) VALUES
  ('nav', '[
    {"label": "Home", "href": "/", "icon": "home", "public": true},
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

-- Default membership tiers
INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Member', 'Standard membership', ARRAY['Member directory', 'Announcements', 'Events'], 'Free', 1, true
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Member');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Premium', 'Premium membership with full access', ARRAY['Member directory', 'Announcements', 'Events', 'Resources', 'Forum'], '$50/year', 2, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Premium');

-- Default homepage sections
INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'hero', '{
  "heading": "Welcome to Our Community",
  "subheading": "Connect, collaborate, and grow together.",
  "cta_text": "Join Now",
  "cta_href": "#signup"
}', 1, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'hero');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'features', '{
  "columns": 3,
  "items": [
    {"icon": "users", "title": "Member Directory", "desc": "Connect with fellow members and grow your network."},
    {"icon": "calendar", "title": "Events", "desc": "Stay updated on upcoming meetups, workshops, and socials."},
    {"icon": "book-open", "title": "Resources", "desc": "Access exclusive guides, templates, and recordings."}
  ]
}', 2, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'features');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'cta', '{
  "heading": "Ready to join?",
  "text": "Sign up today and become part of our community.",
  "cta_text": "Get Started",
  "cta_href": "#signup"
}', 3, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'cta');
