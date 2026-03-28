# Wild Lychee — Customization Guide for AI Agents

Read `STRUCTURE.md` first for the full project map. This file has step-by-step recipes.

## Add a Membership Tier

```sql
INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
VALUES ('Student', 'Discounted student membership', ARRAY['Member directory', 'Events'], '$20/year', 3, false);
```

Deploy: `node deploy.js` (or add to `seed.sql` for permanence).

## Add a Custom Member Field

```sql
INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
VALUES ('company', 'Company Name', 'text', NULL, false, true, 1);
```

Field types: `text`, `textarea`, `select`, `multiselect`, `date`, `url`.
For `select`/`multiselect`, set `options` to a JSON array: `'["Option A", "Option B"]'`.

The profile editor and directory automatically pick up new fields.

## Enable a Feature Flag

```sql
UPDATE site_config SET value = 'true' WHERE key = 'feature_events';
```

The nav updates automatically on next page load.

## Change Theme Colors

```sql
UPDATE site_config SET value = '{"primary":"#dc2626","primary_hover":"#b91c1c","bg":"#0f0f0f","surface":"#1a1a1a","text":"#f5f5f5","text_muted":"#a3a3a3","border":"#333","font_heading":"Playfair Display","font_body":"Lato","radius":"0","max_width":"72rem"}' WHERE key = 'theme';
```

Or update individual values — the theme is a single JSONB object.

## Rename the Site

```sql
UPDATE site_config SET value = '"Riverside Community Club"' WHERE key = 'site_name';
UPDATE site_config SET value = '"Connecting neighbors since 1987"' WHERE key = 'site_tagline';
```

Note: string values in site_config are JSON, so wrap in double quotes inside single quotes.

## Create a Custom Page

```sql
INSERT INTO pages (slug, title, content, requires_auth, show_in_nav, nav_position, published)
VALUES ('about', 'About Us', '<p>We are a community of...</p>', false, true, 5, true);
```

Access at `page.html?slug=about`. Add sections for structured content:

```sql
INSERT INTO sections (page_slug, section_type, config, position)
VALUES ('about', 'faq', '{"items":[{"q":"How do I join?","a":"Click Sign Up!"}]}', 1);
```

## Add a New Language

1. Copy `site/custom/strings/en.json` to `site/custom/strings/pt.json`
2. Translate all values (keys stay the same)
3. For RTL languages, add `"_meta": {"direction": "rtl"}` to the JSON root
4. Update `site/custom/brand.json`:
   ```json
   { "languages": ["en", "pt"], "defaultLanguage": "en" }
   ```
5. Deploy: `node deploy.js`

Members select their language in profile settings. The picker only shows when >1 language exists.

## Add a Scheduled Edge Function

1. Create `functions/my-job.js`:
   ```js
   // schedule: "0 9 * * *"
   import { db } from '@run402/functions';
   export default async (req) => {
     // Your logic here
     return new Response(JSON.stringify({ status: 'ok' }));
   };
   ```
2. The `// schedule:` comment is parsed by `deploy.js` to set the cron schedule
3. Deploy: `node deploy.js`

## Restructure the Homepage

Insert/update/delete rows in `sections` where `page_slug = 'index'`:

```sql
-- Change hero text
UPDATE sections SET config = '{"heading":"Welcome to Our Club","subheading":"Join us!","cta_text":"Sign Up","cta_href":"#signup"}'
WHERE page_slug = 'index' AND section_type = 'hero';

-- Add a stats section
INSERT INTO sections (page_slug, section_type, config, position)
VALUES ('index', 'stats', '{"items":[{"value":"400+","label":"Members"},{"value":"50+","label":"Events/Year"}]}', 4);

-- Hide a section
UPDATE sections SET visible = false WHERE page_slug = 'index' AND section_type = 'features';
```

Section types: `hero`, `features`, `cta`, `stats`, `testimonials`, `faq`, `custom`.

## Modify Navigation

```sql
UPDATE site_config SET value = '[
  {"label":"Home","href":"/","icon":"home","public":true},
  {"label":"About","href":"/page.html?slug=about","icon":"info","public":true},
  {"label":"Members","href":"/directory.html","icon":"users","auth":true,"feature":"feature_directory"},
  {"label":"Admin","href":"/admin.html","icon":"bar-chart-2","admin":true}
]' WHERE key = 'nav';
```

Nav item properties: `label`, `href`, `icon`, `public` (show to all), `auth` (show to logged-in), `admin` (show to admins), `feature` (show when flag is true).

## Create an Event

```sql
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, is_members_only, created_by)
VALUES (
  'Spring Networking Mixer',
  'Join us for an evening of networking and refreshments.',
  'Community Hall, 123 Main St',
  '2026-05-15 18:00:00+00',
  '2026-05-15 21:00:00+00',
  50,
  true,
  (SELECT id FROM members WHERE email = 'admin@example.com')
);
```

The event appears on `events.html` automatically when `feature_events` is enabled.
Members RSVP via the event detail page (`event.html?id=UUID`).

## Add a Forum Category

```sql
INSERT INTO forum_categories (name, description, position, is_members_only)
VALUES ('General Discussion', 'Open conversation about anything community-related.', 1, false);
```

Categories appear on `forum.html` when `feature_forum` is enabled. Members can create topics within any category they have access to.

## Configure AI Features

1. Set the required secrets via the Run402 CLI:

```sh
run402 secrets set AI_API_KEY sk-your-api-key-here
run402 secrets set AI_PROVIDER anthropic
```

2. Enable the AI feature flags you want:

```sql
UPDATE site_config SET value = 'true' WHERE key = 'feature_ai_moderation';
UPDATE site_config SET value = 'true' WHERE key = 'feature_ai_translation';
UPDATE site_config SET value = 'true' WHERE key = 'feature_ai_newsletter';
UPDATE site_config SET value = 'true' WHERE key = 'feature_ai_insights';
UPDATE site_config SET value = 'true' WHERE key = 'feature_ai_onboarding';
```

Enable only the flags you need. Each AI feature works independently. The `moderate-content.js` edge function runs on a 15-minute schedule; `translate-content.js` runs on demand when content is created or updated.

## Add a Resource Category

Resources use a `category` text column directly on the `resources` table (no separate categories table). Just use a consistent category string when inserting resources:

```sql
INSERT INTO resources (title, description, file_url, file_type, category, is_members_only, uploaded_by)
VALUES (
  'New Member Handbook',
  'Everything you need to know as a new member.',
  '/uploads/handbook-2026.pdf',
  'pdf',
  'Onboarding',
  false,
  (SELECT id FROM members WHERE email = 'admin@example.com')
);
```

To see all existing categories: `SELECT DISTINCT category FROM resources ORDER BY category;`

## Create a Committee

```sql
INSERT INTO committees (name, description, is_active)
VALUES ('Events Committee', 'Plans and coordinates all community events and social gatherings.', true);
```

Committees appear on `committees.html` when `feature_committees` is enabled. Committee members are managed through the `committee_members` join table:

```sql
INSERT INTO committee_members (committee_id, member_id, role)
VALUES (
  (SELECT id FROM committees WHERE name = 'Events Committee'),
  (SELECT id FROM members WHERE email = 'member@example.com'),
  'chair'
);
```
