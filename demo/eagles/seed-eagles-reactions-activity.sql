-- ============================================
-- Eagles Demo — Reactions & Activity Feed Seed
-- Additive seed: run AFTER base seed-eagles.sql
-- All dates are relative to now() for freshness
-- ============================================

-- Feature flags (idempotent)
INSERT INTO site_config (key, value, category) VALUES
  ('feature_activity_feed', 'true', 'features'),
  ('feature_reactions', 'true', 'features')
ON CONFLICT (key) DO NOTHING;

-- Activity feed section on homepage
INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'activity_feed', '{"limit": 15}', 5, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'activity_feed');

-- ============================================
-- REACTIONS — ~120 reactions across 10 announcements
-- 25 members, heavy engagement on popular posts
-- Assumes announcements 1-10, members 1-25
-- ============================================

-- Announcement 1 (pinned, big news) — 15 reactions, the blockbuster
INSERT INTO reactions (content_type, content_id, member_id, emoji, created_at) VALUES
  ('announcement', 1, 2, 'like', now() - interval '59 days 3 hours'),
  ('announcement', 1, 3, 'like', now() - interval '59 days 1 hour'),
  ('announcement', 1, 4, 'heart', now() - interval '58 days 22 hours'),
  ('announcement', 1, 5, 'heart', now() - interval '58 days 20 hours'),
  ('announcement', 1, 6, 'celebrate', now() - interval '58 days 18 hours'),
  ('announcement', 1, 7, 'celebrate', now() - interval '58 days 14 hours'),
  ('announcement', 1, 8, 'like', now() - interval '58 days 10 hours'),
  ('announcement', 1, 9, 'heart', now() - interval '58 days 6 hours'),
  ('announcement', 1, 10, 'like', now() - interval '57 days'),
  ('announcement', 1, 11, 'celebrate', now() - interval '57 days'),
  ('announcement', 1, 12, 'like', now() - interval '56 days'),
  ('announcement', 1, 14, 'heart', now() - interval '56 days'),
  ('announcement', 1, 15, 'celebrate', now() - interval '55 days'),
  ('announcement', 1, 18, 'like', now() - interval '54 days'),
  ('announcement', 1, 20, 'laugh', now() - interval '54 days')
ON CONFLICT (content_type, content_id, member_id, emoji) DO NOTHING;

-- Announcement 2 (pinned, Habitat Build recap) — 14 reactions
INSERT INTO reactions (content_type, content_id, member_id, emoji, created_at) VALUES
  ('announcement', 2, 1, 'celebrate', now() - interval '46 days 5 hours'),
  ('announcement', 2, 3, 'heart', now() - interval '46 days 3 hours'),
  ('announcement', 2, 4, 'like', now() - interval '46 days 1 hour'),
  ('announcement', 2, 6, 'heart', now() - interval '45 days 20 hours'),
  ('announcement', 2, 7, 'celebrate', now() - interval '45 days 18 hours'),
  ('announcement', 2, 9, 'celebrate', now() - interval '45 days 12 hours'),
  ('announcement', 2, 10, 'like', now() - interval '45 days 8 hours'),
  ('announcement', 2, 11, 'laugh', now() - interval '45 days 4 hours'),
  ('announcement', 2, 13, 'heart', now() - interval '44 days'),
  ('announcement', 2, 14, 'like', now() - interval '44 days'),
  ('announcement', 2, 16, 'celebrate', now() - interval '43 days'),
  ('announcement', 2, 19, 'like', now() - interval '43 days'),
  ('announcement', 2, 22, 'heart', now() - interval '42 days'),
  ('announcement', 2, 25, 'like', now() - interval '42 days')
ON CONFLICT (content_type, content_id, member_id, emoji) DO NOTHING;

-- Announcement 3 (volunteer call) — 12 reactions
INSERT INTO reactions (content_type, content_id, member_id, emoji, created_at) VALUES
  ('announcement', 3, 2, 'like', now() - interval '38 days 6 hours'),
  ('announcement', 3, 5, 'celebrate', now() - interval '38 days 2 hours'),
  ('announcement', 3, 7, 'like', now() - interval '37 days 20 hours'),
  ('announcement', 3, 8, 'heart', now() - interval '37 days 16 hours'),
  ('announcement', 3, 10, 'like', now() - interval '37 days 10 hours'),
  ('announcement', 3, 12, 'celebrate', now() - interval '37 days'),
  ('announcement', 3, 13, 'like', now() - interval '36 days'),
  ('announcement', 3, 15, 'heart', now() - interval '36 days'),
  ('announcement', 3, 16, 'think', now() - interval '35 days'),
  ('announcement', 3, 17, 'like', now() - interval '35 days'),
  ('announcement', 3, 21, 'celebrate', now() - interval '34 days'),
  ('announcement', 3, 24, 'like', now() - interval '34 days')
ON CONFLICT (content_type, content_id, member_id, emoji) DO NOTHING;

-- Announcement 4 (new member orientation) — 10 reactions
INSERT INTO reactions (content_type, content_id, member_id, emoji, created_at) VALUES
  ('announcement', 4, 3, 'like', now() - interval '30 days 4 hours'),
  ('announcement', 4, 6, 'heart', now() - interval '30 days 2 hours'),
  ('announcement', 4, 7, 'celebrate', now() - interval '29 days 20 hours'),
  ('announcement', 4, 10, 'like', now() - interval '29 days 14 hours'),
  ('announcement', 4, 14, 'heart', now() - interval '29 days'),
  ('announcement', 4, 18, 'like', now() - interval '28 days'),
  ('announcement', 4, 21, 'celebrate', now() - interval '28 days'),
  ('announcement', 4, 22, 'like', now() - interval '27 days'),
  ('announcement', 4, 23, 'heart', now() - interval '27 days'),
  ('announcement', 4, 25, 'laugh', now() - interval '26 days')
ON CONFLICT (content_type, content_id, member_id, emoji) DO NOTHING;

-- Announcement 5 (food pantry record!) — 16 reactions, huge engagement
INSERT INTO reactions (content_type, content_id, member_id, emoji, created_at) VALUES
  ('announcement', 5, 1, 'celebrate', now() - interval '20 days 6 hours'),
  ('announcement', 5, 2, 'celebrate', now() - interval '20 days 5 hours'),
  ('announcement', 5, 3, 'heart', now() - interval '20 days 4 hours'),
  ('announcement', 5, 4, 'like', now() - interval '20 days 3 hours'),
  ('announcement', 5, 5, 'celebrate', now() - interval '20 days 2 hours'),
  ('announcement', 5, 6, 'heart', now() - interval '20 days 1 hour'),
  ('announcement', 5, 8, 'celebrate', now() - interval '19 days 20 hours'),
  ('announcement', 5, 9, 'like', now() - interval '19 days 16 hours'),
  ('announcement', 5, 11, 'laugh', now() - interval '19 days 12 hours'),
  ('announcement', 5, 12, 'heart', now() - interval '19 days 8 hours'),
  ('announcement', 5, 13, 'celebrate', now() - interval '19 days'),
  ('announcement', 5, 15, 'like', now() - interval '18 days'),
  ('announcement', 5, 17, 'celebrate', now() - interval '18 days'),
  ('announcement', 5, 20, 'like', now() - interval '17 days'),
  ('announcement', 5, 22, 'heart', now() - interval '17 days'),
  ('announcement', 5, 24, 'celebrate', now() - interval '17 days')
ON CONFLICT (content_type, content_id, member_id, emoji) DO NOTHING;

-- Announcement 6 (park cleanup call) — 11 reactions
INSERT INTO reactions (content_type, content_id, member_id, emoji, created_at) VALUES
  ('announcement', 6, 2, 'like', now() - interval '14 days 4 hours'),
  ('announcement', 6, 4, 'like', now() - interval '14 days 2 hours'),
  ('announcement', 6, 6, 'celebrate', now() - interval '13 days 20 hours'),
  ('announcement', 6, 8, 'like', now() - interval '13 days 16 hours'),
  ('announcement', 6, 10, 'heart', now() - interval '13 days'),
  ('announcement', 6, 14, 'heart', now() - interval '12 days'),
  ('announcement', 6, 16, 'like', now() - interval '12 days'),
  ('announcement', 6, 19, 'celebrate', now() - interval '11 days'),
  ('announcement', 6, 20, 'like', now() - interval '11 days'),
  ('announcement', 6, 23, 'think', now() - interval '10 days'),
  ('announcement', 6, 25, 'like', now() - interval '10 days')
ON CONFLICT (content_type, content_id, member_id, emoji) DO NOTHING;

-- Announcement 7 (gala save the date) — 13 reactions
INSERT INTO reactions (content_type, content_id, member_id, emoji, created_at) VALUES
  ('announcement', 7, 1, 'celebrate', now() - interval '7 days 6 hours'),
  ('announcement', 7, 3, 'like', now() - interval '7 days 4 hours'),
  ('announcement', 7, 5, 'heart', now() - interval '7 days 2 hours'),
  ('announcement', 7, 7, 'celebrate', now() - interval '6 days 20 hours'),
  ('announcement', 7, 8, 'celebrate', now() - interval '6 days 16 hours'),
  ('announcement', 7, 9, 'like', now() - interval '6 days 10 hours'),
  ('announcement', 7, 11, 'heart', now() - interval '6 days'),
  ('announcement', 7, 13, 'celebrate', now() - interval '5 days 16 hours'),
  ('announcement', 7, 17, 'laugh', now() - interval '5 days'),
  ('announcement', 7, 19, 'like', now() - interval '5 days'),
  ('announcement', 7, 21, 'celebrate', now() - interval '4 days'),
  ('announcement', 7, 22, 'heart', now() - interval '4 days'),
  ('announcement', 7, 24, 'like', now() - interval '3 days')
ON CONFLICT (content_type, content_id, member_id, emoji) DO NOTHING;

-- Announcement 8 (committee signups) — 9 reactions, fresh
INSERT INTO reactions (content_type, content_id, member_id, emoji, created_at) VALUES
  ('announcement', 8, 2, 'like', now() - interval '3 days 4 hours'),
  ('announcement', 8, 4, 'like', now() - interval '3 days 2 hours'),
  ('announcement', 8, 6, 'heart', now() - interval '2 days 20 hours'),
  ('announcement', 8, 10, 'celebrate', now() - interval '2 days 14 hours'),
  ('announcement', 8, 12, 'like', now() - interval '2 days'),
  ('announcement', 8, 15, 'think', now() - interval '1 day 18 hours'),
  ('announcement', 8, 18, 'like', now() - interval '1 day 10 hours'),
  ('announcement', 8, 21, 'celebrate', now() - interval '1 day'),
  ('announcement', 8, 23, 'heart', now() - interval '18 hours')
ON CONFLICT (content_type, content_id, member_id, emoji) DO NOTHING;

-- Announcement 9 (weekend recap) — 10 reactions, very recent
INSERT INTO reactions (content_type, content_id, member_id, emoji, created_at) VALUES
  ('announcement', 9, 1, 'heart', now() - interval '1 day 12 hours'),
  ('announcement', 9, 3, 'celebrate', now() - interval '1 day 8 hours'),
  ('announcement', 9, 5, 'like', now() - interval '1 day 4 hours'),
  ('announcement', 9, 7, 'heart', now() - interval '22 hours'),
  ('announcement', 9, 9, 'celebrate', now() - interval '18 hours'),
  ('announcement', 9, 11, 'like', now() - interval '14 hours'),
  ('announcement', 9, 14, 'laugh', now() - interval '10 hours'),
  ('announcement', 9, 16, 'heart', now() - interval '6 hours'),
  ('announcement', 9, 20, 'like', now() - interval '3 hours'),
  ('announcement', 9, 25, 'celebrate', now() - interval '1 hour')
ON CONFLICT (content_type, content_id, member_id, emoji) DO NOTHING;

-- Announcement 10 (latest, just posted) — 6 reactions, still accumulating
INSERT INTO reactions (content_type, content_id, member_id, emoji, created_at) VALUES
  ('announcement', 10, 2, 'like', now() - interval '4 hours'),
  ('announcement', 10, 4, 'heart', now() - interval '3 hours'),
  ('announcement', 10, 8, 'celebrate', now() - interval '2 hours'),
  ('announcement', 10, 12, 'like', now() - interval '90 minutes'),
  ('announcement', 10, 19, 'like', now() - interval '45 minutes'),
  ('announcement', 10, 23, 'heart', now() - interval '15 minutes')
ON CONFLICT (content_type, content_id, member_id, emoji) DO NOTHING;


-- ============================================
-- ACTIVITY LOG — ~75 entries over past 60 days
-- Dense recent activity, natural taper into the past
-- Every member type appears, realistic Wichita community flavor
-- ============================================

INSERT INTO activity_log (member_id, action, metadata, created_at) VALUES

  -- ── 60-50 days ago: founding burst ──────────────────────────────
  (1, 'announcement', '{"title": "Welcome to The Eagles Online Portal!"}', now() - interval '60 days'),
  (2, 'member_join', '{}', now() - interval '59 days 18 hours'),
  (3, 'member_join', '{}', now() - interval '59 days 12 hours'),
  (4, 'member_join', '{}', now() - interval '59 days 6 hours'),
  (5, 'member_join', '{}', now() - interval '58 days'),
  (6, 'member_join', '{}', now() - interval '57 days'),
  (7, 'member_join', '{}', now() - interval '56 days'),
  (2, 'resource_upload', '{"title": "Eagles Bylaws & Charter"}', now() - interval '55 days 10 hours'),
  (1, 'resource_upload', '{"title": "Volunteer Orientation Packet"}', now() - interval '55 days'),
  (1, 'announcement', '{"title": "Spring Volunteer Drive Kickoff!"}', now() - interval '54 days'),
  (3, 'rsvp', '{"event_title": "Spring Food Drive", "event_id": 1}', now() - interval '53 days'),
  (5, 'rsvp', '{"event_title": "Spring Food Drive", "event_id": 1}', now() - interval '52 days 18 hours'),
  (6, 'rsvp', '{"event_title": "Spring Food Drive", "event_id": 1}', now() - interval '52 days 12 hours'),
  (4, 'forum_post', '{"title": "Best practices for food drive logistics?"}', now() - interval '51 days'),

  -- ── 50-40 days ago: growing ─────────────────────────────────────
  (8, 'member_join', '{}', now() - interval '49 days'),
  (9, 'member_join', '{}', now() - interval '48 days'),
  (10, 'member_join', '{}', now() - interval '47 days'),
  (7, 'rsvp', '{"event_title": "Habitat Build Day", "event_id": 2}', now() - interval '46 days'),
  (10, 'rsvp', '{"event_title": "Habitat Build Day", "event_id": 2}', now() - interval '45 days 16 hours'),
  (3, 'rsvp', '{"event_title": "Habitat Build Day", "event_id": 2}', now() - interval '45 days 8 hours'),
  (1, 'announcement', '{"title": "Habitat Build Day Recap — 14 Volunteers!"}', now() - interval '44 days'),
  (2, 'resource_upload', '{"title": "Safety Training Video"}', now() - interval '43 days'),
  (1, 'resource_upload', '{"title": "Tax Receipt Template"}', now() - interval '42 days'),
  (11, 'member_join', '{}', now() - interval '41 days'),
  (6, 'forum_post', '{"title": "Ideas for youth summer program"}', now() - interval '40 days'),

  -- ── 40-30 days ago: hitting stride ──────────────────────────────
  (12, 'member_join', '{}', now() - interval '39 days'),
  (13, 'member_join', '{}', now() - interval '38 days'),
  (14, 'member_join', '{}', now() - interval '37 days'),
  (2, 'announcement', '{"title": "New Member Orientation This Saturday"}', now() - interval '36 days'),
  (15, 'member_join', '{}', now() - interval '35 days'),
  (16, 'member_join', '{}', now() - interval '34 days'),
  (11, 'forum_post', '{"title": "Thank you for the warm welcome!"}', now() - interval '33 days'),
  (9, 'rsvp', '{"event_title": "New Member Orientation", "event_id": 3}', now() - interval '32 days'),
  (14, 'rsvp', '{"event_title": "New Member Orientation", "event_id": 3}', now() - interval '31 days 12 hours'),
  (15, 'rsvp', '{"event_title": "New Member Orientation", "event_id": 3}', now() - interval '31 days'),
  (17, 'member_join', '{}', now() - interval '30 days'),

  -- ── 30-20 days ago: peak activity ───────────────────────────────
  (18, 'member_join', '{}', now() - interval '28 days'),
  (4, 'rsvp', '{"event_title": "Park Cleanup at Riverside", "event_id": 4}', now() - interval '27 days'),
  (8, 'rsvp', '{"event_title": "Park Cleanup at Riverside", "event_id": 4}', now() - interval '26 days 18 hours'),
  (11, 'rsvp', '{"event_title": "Park Cleanup at Riverside", "event_id": 4}', now() - interval '26 days 12 hours'),
  (16, 'rsvp', '{"event_title": "Park Cleanup at Riverside", "event_id": 4}', now() - interval '26 days'),
  (13, 'resource_upload', '{"title": "Fundraising Best Practices Guide"}', now() - interval '25 days'),
  (19, 'member_join', '{}', now() - interval '24 days'),
  (20, 'member_join', '{}', now() - interval '23 days'),
  (1, 'announcement', '{"title": "Food Pantry Donation Record Broken!"}', now() - interval '22 days'),
  (5, 'reaction', '{"content_type": "announcement", "content_id": 5, "emoji": "celebrate"}', now() - interval '22 days'),
  (8, 'reaction', '{"content_type": "announcement", "content_id": 5, "emoji": "celebrate"}', now() - interval '21 days 18 hours'),
  (12, 'reaction', '{"content_type": "announcement", "content_id": 5, "emoji": "heart"}', now() - interval '21 days 12 hours'),
  (21, 'member_join', '{}', now() - interval '21 days'),

  -- ── 20-10 days ago: steady rhythm ───────────────────────────────
  (12, 'rsvp', '{"event_title": "Youth Mentorship Kickoff", "event_id": 5}', now() - interval '19 days'),
  (17, 'rsvp', '{"event_title": "Youth Mentorship Kickoff", "event_id": 5}', now() - interval '18 days 16 hours'),
  (22, 'member_join', '{}', now() - interval '18 days'),
  (8, 'forum_post', '{"title": "Fundraiser venue suggestions?"}', now() - interval '17 days'),
  (2, 'resource_upload', '{"title": "Event Planning Checklist"}', now() - interval '16 days'),
  (23, 'member_join', '{}', now() - interval '15 days'),
  (2, 'announcement', '{"title": "Park Cleanup Volunteers Needed — May 15th"}', now() - interval '14 days'),
  (13, 'forum_post', '{"title": "Donation drop-off locations thread"}', now() - interval '13 days'),
  (1, 'resource_upload', '{"title": "2025 Annual Report"}', now() - interval '12 days'),
  (24, 'member_join', '{}', now() - interval '11 days'),
  (3, 'forum_post', '{"title": "Carpooling to Riverside cleanup"}', now() - interval '10 days'),

  -- ── Last 10 days: buzzing ───────────────────────────────────────
  (25, 'member_join', '{}', now() - interval '9 days'),
  (1, 'announcement', '{"title": "Annual Gala — Save the Date!"}', now() - interval '8 days'),
  (6, 'rsvp', '{"event_title": "Annual Gala 2026", "event_id": 6}', now() - interval '7 days 18 hours'),
  (9, 'rsvp', '{"event_title": "Annual Gala 2026", "event_id": 6}', now() - interval '7 days 12 hours'),
  (15, 'rsvp', '{"event_title": "Annual Gala 2026", "event_id": 6}', now() - interval '7 days'),
  (3, 'rsvp', '{"event_title": "Annual Gala 2026", "event_id": 6}', now() - interval '6 days 18 hours'),
  (11, 'rsvp', '{"event_title": "Annual Gala 2026", "event_id": 6}', now() - interval '6 days 12 hours'),
  (20, 'rsvp', '{"event_title": "Annual Gala 2026", "event_id": 6}', now() - interval '6 days'),
  (14, 'forum_post', '{"title": "Photography volunteers for gala?"}', now() - interval '5 days 8 hours'),
  (7, 'reaction', '{"content_type": "announcement", "content_id": 7, "emoji": "celebrate"}', now() - interval '5 days'),

  -- ── Last 3 days: very fresh ─────────────────────────────────────
  (1, 'announcement', '{"title": "Committee Signups Open for 2026"}', now() - interval '3 days 6 hours'),
  (10, 'reaction', '{"content_type": "announcement", "content_id": 8, "emoji": "celebrate"}', now() - interval '3 days'),
  (18, 'rsvp', '{"event_title": "Summer BBQ Fundraiser", "event_id": 7}', now() - interval '2 days 18 hours'),
  (22, 'rsvp', '{"event_title": "Summer BBQ Fundraiser", "event_id": 7}', now() - interval '2 days 12 hours'),
  (5, 'rsvp', '{"event_title": "Summer BBQ Fundraiser", "event_id": 7}', now() - interval '2 days'),
  (16, 'resource_upload', '{"title": "Gala Volunteer Sign-Up Sheet"}', now() - interval '1 day 16 hours'),
  (1, 'announcement', '{"title": "This Week: Gala Prep Meeting Wednesday"}', now() - interval '1 day 8 hours'),
  (19, 'forum_post', '{"title": "What should we serve at the BBQ?"}', now() - interval '1 day 2 hours'),

  -- ── Today: site feels live right now ────────────────────────────
  (24, 'rsvp', '{"event_title": "Gala Prep Meeting", "event_id": 8}', now() - interval '14 hours'),
  (7, 'rsvp', '{"event_title": "Gala Prep Meeting", "event_id": 8}', now() - interval '10 hours'),
  (13, 'reaction', '{"content_type": "announcement", "content_id": 10, "emoji": "like"}', now() - interval '6 hours'),
  (4, 'rsvp', '{"event_title": "Summer BBQ Fundraiser", "event_id": 7}', now() - interval '4 hours'),
  (21, 'reaction', '{"content_type": "announcement", "content_id": 10, "emoji": "heart"}', now() - interval '3 hours'),
  (25, 'reaction', '{"content_type": "announcement", "content_id": 9, "emoji": "celebrate"}', now() - interval '2 hours'),
  (17, 'rsvp', '{"event_title": "Gala Prep Meeting", "event_id": 8}', now() - interval '45 minutes'),
  (8, 'reaction', '{"content_type": "announcement", "content_id": 10, "emoji": "celebrate"}', now() - interval '20 minutes');
