-- ============================================
-- Kychon — Database Schema
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
  source_timezone TEXT,
  source_timezone_label TEXT,
  time_display_mode TEXT NOT NULL DEFAULT 'visitor' CHECK (time_display_mode IN ('visitor', 'source')),
  import_review_state TEXT,
  source_metadata JSONB DEFAULT '{}',
  created_by INT REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_registration_options (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  description TEXT,
  price_amount NUMERIC(12, 2),
  currency TEXT,
  raw_price_label TEXT,
  guest_policy TEXT,
  capacity INT,
  spaces_left INT,
  availability_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (availability_status IN ('available', 'waitlist', 'full', 'closed', 'unknown')),
  cancellation_note TEXT,
  source_registration_url TEXT,
  review_state TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (review_state IN ('needs_review', 'reviewed', 'ignored')),
  is_disabled BOOLEAN NOT NULL DEFAULT false,
  raw_source_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_registration_options_event_position
  ON event_registration_options (event_id, position, id);

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
-- SECTION: Native Site Search
-- ============================================

CREATE TABLE IF NOT EXISTS search_documents (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('page', 'resource', 'event')),
  source_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '/',
  is_members_only BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT true,
  title_vector TSVECTOR,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_type, source_key)
);

ALTER TABLE search_documents ENABLE ROW LEVEL SECURITY;

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
  author_name TEXT,
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
  author_name TEXT,
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
-- SECTION: Polls (feature: polls)
-- ============================================

CREATE TABLE IF NOT EXISTS polls (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  description TEXT,
  poll_type TEXT NOT NULL DEFAULT 'single' CHECK(poll_type IN ('single', 'multiple')),
  is_anonymous BOOLEAN DEFAULT false,
  results_visible TEXT NOT NULL DEFAULT 'after_vote' CHECK(results_visible IN ('always', 'after_vote', 'after_close')),
  is_open BOOLEAN DEFAULT true,
  closes_at TIMESTAMPTZ,
  attached_to TEXT,
  attached_id INT,
  created_by INT REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_options (
  id SERIAL PRIMARY KEY,
  poll_id INT REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INT NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INT REFERENCES polls(id) ON DELETE CASCADE,
  option_id INT REFERENCES poll_options(id) ON DELETE CASCADE,
  member_id INT REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, member_id, option_id)
);

-- ============================================
-- SECTION: Reactions
-- ============================================

CREATE TABLE IF NOT EXISTS reactions (
  id SERIAL PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id INT NOT NULL,
  member_id INT REFERENCES members(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(content_type, content_id, member_id, emoji)
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
-- SECTION: Capability API Execution Ledger
-- ============================================

CREATE TABLE IF NOT EXISTS capability_executions (
  id BIGSERIAL PRIMARY KEY,
  api_version TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  actor_ref JSONB NOT NULL,
  actor_state TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'succeeded', 'failed')),
  result_digest TEXT,
  result_payload JSONB,
  error_payload JSONB,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(api_version, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_capability_executions_operation_created
  ON capability_executions (operation, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_capability_executions_actor_created
  ON capability_executions ((actor_ref->>'type'), (actor_ref->>'id'), created_at DESC);

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

DO $$ BEGIN ALTER TABLE forum_topics ADD COLUMN author_name TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE forum_replies ADD COLUMN author_name TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE forum_topics ADD COLUMN hidden BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE forum_topics ADD COLUMN locked BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE forum_replies ADD COLUMN hidden BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE forum_topics ADD COLUMN search_vector TSVECTOR; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_forum_topics_search ON forum_topics USING GIN (search_vector);

-- composable-layout: zone + scope on sections so chrome blocks live in the same table as main content
DO $$ BEGIN
  ALTER TABLE sections ADD COLUMN zone TEXT NOT NULL DEFAULT 'main'
    CHECK (zone IN ('header', 'main', 'footer'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE sections ADD COLUMN scope TEXT NOT NULL DEFAULT 'page'
    CHECK (scope IN ('page', 'global'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_sections_zone_scope_slug ON sections (zone, scope, page_slug, position);

-- column-span-rows: per-block column span fraction (1, 1/2, 1/3, 2/3) inside a 6-col zone grid
DO $$ BEGIN
  ALTER TABLE sections ADD COLUMN column_span TEXT NOT NULL DEFAULT '1'
    CHECK (column_span IN ('1', '1/2', '1/3', '2/3'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ported-event-registration + source-timezone-event-display: preserve richer
-- imported event data without changing canonical timestamp storage.
DO $$ BEGIN ALTER TABLE events ADD COLUMN source_timezone TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE events ADD COLUMN source_timezone_label TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE events ADD COLUMN time_display_mode TEXT NOT NULL DEFAULT 'visitor'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE events ADD COLUMN import_review_state TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE events ADD COLUMN source_metadata JSONB DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_time_display_mode_check
    CHECK (time_display_mode IN ('visitor', 'source'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- SECTION: Native Site Search Migrations
-- ============================================

CREATE OR REPLACE FUNCTION kychon_search_strip_html(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(regexp_replace(coalesce(input, ''), '<[^>]+>', ' ', 'g'), '&amp;nbsp;', ' '),
              '&nbsp;', ' '
            ),
            '&#160;', ' '
          ),
          '&#xA0;', ' '
        ),
        '&#xa0;', ' '
      ),
      chr(160), ' '
    ),
    '[[:space:]]+', ' ', 'g'
  ));
$$;

CREATE OR REPLACE FUNCTION kychon_search_jsonb_text(value JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result TEXT := '';
  elem JSONB;
  item RECORD;
BEGIN
  IF value IS NULL THEN
    RETURN '';
  END IF;

  CASE jsonb_typeof(value)
    WHEN 'string' THEN
      RETURN kychon_search_strip_html(value #>> '{}');
    WHEN 'array' THEN
      FOR elem IN SELECT jsonb_array_elements(value) LOOP
        result := concat_ws(' ', result, kychon_search_jsonb_text(elem));
      END LOOP;
      RETURN trim(result);
    WHEN 'object' THEN
      FOR item IN SELECT key, val FROM jsonb_each(value) AS t(key, val) LOOP
        IF item.key !~* '(href|url|src|image|icon|color|class|style|target|rel|provider|acknowledged|id)$' THEN
          result := concat_ws(' ', result, kychon_search_jsonb_text(item.val));
        END IF;
      END LOOP;
      RETURN trim(result);
    ELSE
      RETURN '';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION kychon_search_resource_file_label(file_url TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(replace(replace(regexp_replace(regexp_replace(coalesce(file_url, ''), '[?#].*$', ''), '^.*/', ''), '%20', ' '), '_', ' '), '[-]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION kychon_set_search_vectors()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.title_vector := to_tsvector('simple', coalesce(NEW.title, ''));
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.body, '')), 'B');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_search_documents_vectors ON search_documents;
CREATE TRIGGER trg_search_documents_vectors
BEFORE INSERT OR UPDATE ON search_documents
FOR EACH ROW EXECUTE FUNCTION kychon_set_search_vectors();

CREATE INDEX IF NOT EXISTS idx_search_documents_title_vector ON search_documents USING GIN (title_vector);
CREATE INDEX IF NOT EXISTS idx_search_documents_search_vector ON search_documents USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_search_documents_visibility ON search_documents (published, is_members_only, source_type);
CREATE INDEX IF NOT EXISTS idx_search_documents_updated ON search_documents (updated_at DESC, source_type, source_key);

CREATE OR REPLACE FUNCTION kychon_upsert_search_page(slug_arg TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  p RECORD;
  section_text TEXT;
  page_url TEXT;
BEGIN
  SELECT * INTO p FROM pages WHERE slug = slug_arg LIMIT 1;
  IF NOT FOUND THEN
    DELETE FROM search_documents WHERE source_type = 'page' AND source_key = slug_arg;
    RETURN;
  END IF;

  SELECT string_agg(kychon_search_jsonb_text(config), ' ' ORDER BY position)
    INTO section_text
  FROM sections
  WHERE page_slug = slug_arg
    AND scope = 'page'
    AND visible IS NOT false
    AND section_type NOT IN (
      'nav',
      'brand_header',
      'sign_in_bar',
      'site_search',
      'footer_address',
      'footer_links',
      'footer_copyright',
      'footer_social',
      'footer_attribution'
    );

  page_url := CASE WHEN slug_arg = 'index' THEN '/' ELSE '/page.html?slug=' || slug_arg END;

  INSERT INTO search_documents (
    source_type,
    source_key,
    title,
    body,
    url,
    is_members_only,
    published
  )
  VALUES (
    'page',
    p.slug,
    coalesce(p.title, ''),
    concat_ws(' ', kychon_search_strip_html(p.content), section_text),
    page_url,
    coalesce(p.requires_auth, false),
    coalesce(p.published, true)
  )
  ON CONFLICT (source_type, source_key) DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    url = EXCLUDED.url,
    is_members_only = EXCLUDED.is_members_only,
    published = EXCLUDED.published;
END;
$$;

CREATE OR REPLACE FUNCTION kychon_upsert_search_resource(resource_id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  file_label TEXT;
BEGIN
  SELECT * INTO r FROM resources WHERE id = resource_id LIMIT 1;
  IF NOT FOUND THEN
    DELETE FROM search_documents WHERE source_type = 'resource' AND source_key = resource_id::TEXT;
    RETURN;
  END IF;

  file_label := kychon_search_resource_file_label(r.file_url);

  INSERT INTO search_documents (
    source_type,
    source_key,
    title,
    body,
    url,
    is_members_only,
    published
  )
  VALUES (
    'resource',
    r.id::TEXT,
    coalesce(r.title, file_label, ''),
    concat_ws(' ', r.description, r.category, r.file_type, file_label),
    '/resources.html#resource-' || r.id::TEXT,
    coalesce(r.is_members_only, false),
    true
  )
  ON CONFLICT (source_type, source_key) DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    url = EXCLUDED.url,
    is_members_only = EXCLUDED.is_members_only,
    published = EXCLUDED.published;
END;
$$;

CREATE OR REPLACE FUNCTION kychon_upsert_search_event(event_id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  e RECORD;
BEGIN
  SELECT * INTO e FROM events WHERE id = event_id LIMIT 1;
  IF NOT FOUND THEN
    DELETE FROM search_documents WHERE source_type = 'event' AND source_key = event_id::TEXT;
    RETURN;
  END IF;

  INSERT INTO search_documents (
    source_type,
    source_key,
    title,
    body,
    url,
    is_members_only,
    published
  )
  VALUES (
    'event',
    e.id::TEXT,
    coalesce(e.title, ''),
    concat_ws(' ', kychon_search_strip_html(e.description), e.location, to_char(e.starts_at, 'FMMonth FMDD, YYYY HH24:MI')),
    '/event.html?id=' || e.id::TEXT,
    coalesce(e.is_members_only, false),
    true
  )
  ON CONFLICT (source_type, source_key) DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    url = EXCLUDED.url,
    is_members_only = EXCLUDED.is_members_only,
    published = EXCLUDED.published;
END;
$$;

CREATE OR REPLACE FUNCTION kychon_reindex_search()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  row RECORD;
BEGIN
  DELETE FROM search_documents
  WHERE source_type NOT IN ('page', 'resource', 'event');

  FOR row IN SELECT slug FROM pages LOOP
    PERFORM kychon_upsert_search_page(row.slug);
  END LOOP;

  FOR row IN SELECT id FROM resources LOOP
    PERFORM kychon_upsert_search_resource(row.id);
  END LOOP;

  FOR row IN SELECT id FROM events LOOP
    PERFORM kychon_upsert_search_event(row.id);
  END LOOP;

  DELETE FROM search_documents sd
  WHERE (sd.source_type = 'page' AND NOT EXISTS (SELECT 1 FROM pages p WHERE p.slug = sd.source_key))
     OR (sd.source_type = 'resource' AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.id::TEXT = sd.source_key))
     OR (sd.source_type = 'event' AND NOT EXISTS (SELECT 1 FROM events e WHERE e.id::TEXT = sd.source_key));
END;
$$;

CREATE OR REPLACE FUNCTION kychon_search_page_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM kychon_upsert_search_page(OLD.slug);
    RETURN OLD;
  END IF;
  PERFORM kychon_upsert_search_page(NEW.slug);
  IF TG_OP = 'UPDATE' AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    PERFORM kychon_upsert_search_page(OLD.slug);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION kychon_search_section_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.scope = 'page' THEN
      PERFORM kychon_upsert_search_page(OLD.page_slug);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.scope = 'page' AND OLD.page_slug IS DISTINCT FROM NEW.page_slug THEN
    PERFORM kychon_upsert_search_page(OLD.page_slug);
  END IF;

  IF NEW.scope = 'page' THEN
    PERFORM kychon_upsert_search_page(NEW.page_slug);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION kychon_search_resource_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM kychon_upsert_search_resource(OLD.id);
    RETURN OLD;
  END IF;
  PERFORM kychon_upsert_search_resource(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION kychon_search_event_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM kychon_upsert_search_event(OLD.id);
    RETURN OLD;
  END IF;
  PERFORM kychon_upsert_search_event(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_search_pages_sync ON pages;
CREATE TRIGGER trg_search_pages_sync
AFTER INSERT OR UPDATE OR DELETE ON pages
FOR EACH ROW EXECUTE FUNCTION kychon_search_page_row_trigger();

DROP TRIGGER IF EXISTS trg_search_sections_sync ON sections;
CREATE TRIGGER trg_search_sections_sync
AFTER INSERT OR UPDATE OR DELETE ON sections
FOR EACH ROW EXECUTE FUNCTION kychon_search_section_row_trigger();

DROP TRIGGER IF EXISTS trg_search_resources_sync ON resources;
CREATE TRIGGER trg_search_resources_sync
AFTER INSERT OR UPDATE OR DELETE ON resources
FOR EACH ROW EXECUTE FUNCTION kychon_search_resource_row_trigger();

DROP TRIGGER IF EXISTS trg_search_events_sync ON events;
CREATE TRIGGER trg_search_events_sync
AFTER INSERT OR UPDATE OR DELETE ON events
FOR EACH ROW EXECUTE FUNCTION kychon_search_event_row_trigger();

SELECT kychon_reindex_search();
