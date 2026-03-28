-- ============================================
-- Wild Lychee — Database Schema
-- All migrations are idempotent (safe to re-run)
-- ============================================

-- ============================================
-- SECTION: Core / Config
-- ============================================

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
);

CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  requires_auth BOOLEAN DEFAULT false,
  show_in_nav BOOLEAN DEFAULT false,
  nav_position INT,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY,
  page_slug TEXT DEFAULT 'index',
  section_type TEXT NOT NULL,
  config JSONB NOT NULL,
  position INT NOT NULL,
  visible BOOLEAN DEFAULT true
);

-- ============================================
-- SECTION: Members
-- ============================================

CREATE TABLE IF NOT EXISTS membership_tiers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  benefits TEXT[],
  price_label TEXT,
  position INT NOT NULL,
  is_default BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS member_custom_fields (
  id SERIAL PRIMARY KEY,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options JSONB,
  required BOOLEAN DEFAULT false,
  visible_in_directory BOOLEAN DEFAULT true,
  position INT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  tier_id INT REFERENCES membership_tiers(id),
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  custom_fields JSONB DEFAULT '{}',
  joined_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION: Events (feature: events)
-- ============================================

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  capacity INT,
  image_url TEXT,
  is_members_only BOOLEAN DEFAULT false,
  created_by INT REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id SERIAL PRIMARY KEY,
  event_id INT REFERENCES events(id) ON DELETE CASCADE,
  member_id INT REFERENCES members(id),
  status TEXT NOT NULL DEFAULT 'going',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, member_id)
);

-- ============================================
-- SECTION: Resources (feature: resources)
-- ============================================

CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  file_url TEXT,
  file_type TEXT,
  is_members_only BOOLEAN DEFAULT true,
  uploaded_by INT REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION: Forum (feature: forum)
-- ============================================

CREATE TABLE IF NOT EXISTS forum_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  position INT NOT NULL,
  color TEXT DEFAULT '#6366f1'
);

CREATE TABLE IF NOT EXISTS forum_topics (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES forum_categories(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id INT REFERENCES members(id),
  is_pinned BOOLEAN DEFAULT false,
  reply_count INT DEFAULT 0,
  last_reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id SERIAL PRIMARY KEY,
  topic_id INT REFERENCES forum_topics(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id INT REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION: Committees (feature: committees)
-- ============================================

CREATE TABLE IF NOT EXISTS committees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS committee_members (
  id SERIAL PRIMARY KEY,
  committee_id INT REFERENCES committees(id) ON DELETE CASCADE,
  member_id INT REFERENCES members(id),
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(committee_id, member_id)
);

-- ============================================
-- SECTION: Announcements
-- ============================================

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  author_id INT REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION: Activity Log
-- ============================================

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  member_id INT REFERENCES members(id),
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION: AI Features
-- ============================================

CREATE TABLE IF NOT EXISTS content_translations (
  id SERIAL PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id INT NOT NULL,
  language TEXT NOT NULL,
  field TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(content_type, content_id, language, field)
);

CREATE TABLE IF NOT EXISTS moderation_log (
  id SERIAL PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id INT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  confidence REAL,
  reviewed_by INT REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_insights (
  id SERIAL PRIMARY KEY,
  member_id INT REFERENCES members(id),
  insight_type TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS newsletter_drafts (
  id SERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION: Schema Migrations (safe column additions)
-- ============================================

DO $$ BEGIN ALTER TABLE forum_topics ADD COLUMN hidden BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE forum_topics ADD COLUMN locked BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE forum_replies ADD COLUMN hidden BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE forum_topics ADD COLUMN search_vector TSVECTOR; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_forum_topics_search ON forum_topics USING GIN (search_vector);
