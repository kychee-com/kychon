-- Synthetic copy-website port seed for tests (fictional club, example.org contacts).
-- Mirrors the statement shapes real port seeds use: TRUNCATE, multi-line
-- INSERT ... SELECT, quoted text containing ';' and '$$', and setval.
TRUNCATE event_registration_options, events, announcements, members, sections, pages, site_config RESTART IDENTITY CASCADE;

INSERT INTO site_config (key, value, category) VALUES
  ('site_name', '"Harbor Point Boat Club"'::jsonb, 'branding'),
  ('brand_text', '"Harbor Point Boat Club"'::jsonb, 'branding'),
  ('brand_icon_url', '"/assets/Logo.jpg"'::jsonb, 'branding');

INSERT INTO pages (slug, title, content, requires_auth, show_in_nav, nav_position, published) VALUES ('membership', 'Membership', '<p>Dues: $50.00; click the ''Pay $$ (USD)'' button.</p><p>Questions? <a href="mailto:office@example.org">office@example.org</a></p>', false, true, 2, true);

INSERT INTO sections (page_slug, section_type, config, position, visible, zone, scope, column_span) VALUES ('index', 'hero', '{"mode":"background","heading":"","bg_image":"/assets/Home.jpg","overlay":"none"}'::jsonb, 1, true, 'main', 'page', '1');

INSERT INTO events (title, description, starts_at)
SELECT 'Spring Regatta',
  'Members'' race day; bring a picnic.',
  now() + interval '30 days';

SELECT setval(pg_get_serial_sequence('events','id'), GREATEST((SELECT COALESCE(max(id), 1) FROM events), 1));
