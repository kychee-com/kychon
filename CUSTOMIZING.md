# Kychon — Customization Guide for AI Agents

Read `STRUCTURE.md` first for the full project map. This file has step-by-step recipes.

## Capability API vs Raw Data Access

Use the Capability API or SDK for product workflows:

- `events.create`, `events.update`, `events.delete`
- `members.approve`, `members.changeRole`, `members.suspend`
- `announcements.publish`, `announcements.pin`, `announcements.delete`
- `forum.topics.create`, `forum.replies.create`, moderation actions
- `pollVotes.cast`, `polls.close`, `polls.delete`
- `resources.upload`, exports, AI translation/newsletter jobs

These operations own permissions, validation, confirmation, side effects, idempotency, activity/audit references, and verification queries.

Use SQL/PostgREST for low-level customization:

- `site_config`, `pages`, and `sections` composition
- theme tokens, branding, language files, and seed data
- data migrations, imports, and bulk corrections where the agent understands the consequences

When in doubt, dry-run the domain operation first with `phase: "validate"` or the SDK `.validate()` helper.

## New Deployment UI Contract

Before adding custom HTML/CSS or a new React component, check the Kychon library first. New demo, Fresh Start, copied-site, and ported deployments should use these paths in order:

1. Use existing `sections` rows and block types for public pages. The block registry in `src/lib/blocks.ts` is the source of truth for reusable presentation surfaces such as heroes, stats, feature grids, testimonials, CTAs, promo cards, events, links, slideshows, embeds, social links, page banners, header chrome, and footer chrome.
2. Use `site_config.theme`, block config fields, `--ky-*` CSS variables, and documented public CSS hooks for brand variation. Avoid per-deployment utility classes and dynamic Tailwind class names derived from runtime data.
3. Use Kychon UI exports for interactive admin/editor/auth surfaces. Feature code imports from `@/components/kychon/ui` or another Kychon wrapper. It does not import `@/components/ui/*`, `@radix-ui/*`, or `@base-ui-components/*` directly.
4. Add a new block or component only when the shape will be reusable across deployments. Raw custom HTML/CSS is an escape hatch for source-fidelity ports, not the default authoring model.

### shadcn availability

Yes: Kychon can use any shadcn/ui component. Add the component as product-owned source under `src/components/ui/*`, wire it to Kychon's tokens and accessibility expectations, then export it from `src/components/kychon/ui.ts` or a Kychon wrapper before any deployment or feature code imports it.

## Branding

Kychon represents your brand with three explicit fields and a separate favicon.
The `brand_header` block (in `zone='header'`) picks one of three render modes
based on which fields are set:

| Field | Format | When to use |
|---|---|---|
| `brand_icon_url` | square image (any URL form) | small mark / favicon-style — fits the nav slot |
| `brand_wordmark_url` | wide horizontal image | the org's name *is* the design (no separate text) |
| `brand_text` | string (**required**) | always set — alt text, aria label, text fallback |
| `brand_text_short` | string | optional 1-line abbreviation for narrow viewports |
| `favicon_url` | image URL or `data:image/svg+xml,...` | optional explicit favicon |

### Picker rules (priority order)

1. `brand_icon_url` set → render `<icon> + brand_text` (with `brand_text_short` swapped in via CSS below 600px)
2. else `brand_wordmark_url` set → render the wordmark image alone (no separate text — the wordmark already says the name)
3. else → render `brand_text` alone

```
icon mode:    [icon] Old Dominion Boat Club
wordmark mode:    [───── ODBC FOUNDATION ─────]
text mode:    Old Dominion Boat Club
```

**Rule of thumb**: if the source has a square mark, use the icon slot. If it
only has a wide banner with the name baked in, use the wordmark slot. Never
stuff a wide banner into the icon slot — it gets squeezed into ~32px tall and
distorts. If both image fields are empty, the text-only render (mode 3) is
the safe baseline.

### SQL recipe

```sql
UPDATE site_config SET value = '"https://example.com/wheel.svg"' WHERE key = 'brand_icon_url';
UPDATE site_config SET value = '"Old Dominion Boat Club"'        WHERE key = 'brand_text';
UPDATE site_config SET value = '"ODBC"'                          WHERE key = 'brand_text_short';
-- Leave brand_wordmark_url empty when in icon mode.
```

### Favicon fallback chain

The `<link rel="icon">` in `Portal.astro` is baked at build time using:

```
site_config.favicon_url → site_config.brand_icon_url → /favicon.svg (engine default)
```

Inline `data:image/svg+xml,…` URLs are accepted as-is — useful when a skill
generates an SVG monogram and ships it in the seed without a separate upload.
SVG-typed URLs (file extension or `data:` URL) get `type="image/svg+xml"` on
the `<link>`; other formats omit `type` so the browser infers.

The CSP baseline (from `embed-block`, in `public/_headers`) already includes
`img-src 'self' https: data:`, so inline-SVG favicons load without a CSP
violation.

### Aspect-ratio hint

When an admin uploads an image to `brand_icon_url` and the intrinsic
dimensions show `width > 1.5 × height`, the asset picker offers a one-click
reroute to `brand_wordmark_url`. The same heuristic runs server-side in
`functions/upload-asset.js` and surfaces a `looks_like_wordmark` warning to
any caller that passes `target: 'brand_icon_url'` in the request body.

Hint, not gate — admins can dismiss and keep the asset in the icon slot.

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
UPDATE site_config SET value = '"Riverside Community Club"' WHERE key = 'brand_text';
UPDATE site_config SET value = '"Riverside"' WHERE key = 'brand_text_short';
UPDATE site_config SET value = '"Connecting neighbors since 1987"' WHERE key = 'site_tagline';
```

`site_name` is used in `<title>` and notifications; `brand_text` is the
visible name in the header chrome. They usually match — set both. See the
[Branding](#branding) section for the full picker rules.

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

1. Copy `public/custom/strings/en.json` to `public/custom/strings/pt.json`
2. Translate all values (keys stay the same)
3. For RTL languages, add `"_meta": {"direction": "rtl"}` to the JSON root
4. Update `public/custom/brand.json`:
   ```json
   { "languages": ["en", "pt"], "defaultLanguage": "en" }
   ```
5. Deploy: `node deploy.js`

Members select their language in profile settings. The picker only shows when >1 language exists.

## Add a Scheduled Edge Function

1. Create `functions/my-job.js`:
   ```js
   // schedule: "0 9 * * *"
   import { adminDb } from '@run402/functions';
   export default async (_req) => {
     // Your logic here
     const rows = await adminDb().from('site_config').select('key,value').limit(5);
     return new Response(JSON.stringify({ status: 'ok', rows_checked: rows.length }));
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

### Source-Timezone Event Display

Kychon stores event timestamps as instants, then formats them for visitors. Native
sites use browser-local display by default:

```sql
INSERT INTO site_config (key, value, category)
VALUES ('event_time_display_mode', '"visitor"', 'events')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;
```

Imported association sites can preserve source-local listings with an IANA
timezone. Use `event_source_timezone` as the site default and set
`event_time_display_mode` to `"source"`:

```sql
INSERT INTO site_config (key, value, category)
VALUES
  ('event_source_timezone', '"Australia/Sydney"', 'events'),
  ('event_time_display_mode', '"source"', 'events')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;
```

Individual events can override the site default with `events.source_timezone`,
`events.source_timezone_label`, and `events.time_display_mode`.

### Structured Registration Options

Ported Wild Apricot-style registration classes live in
`event_registration_options`, one row per option:

```sql
INSERT INTO event_registration_options (
  event_id, position, label, raw_price_label, availability_status,
  spaces_left, source_registration_url, review_state
) VALUES (
  1, 1, 'Member registration', '$25.00', 'available',
  12, 'https://example.org/event-registration', 'needs_review'
);
```

Public event pages render these options above the native RSVP panel. External
registration links remain external CTAs; Kychon does not process source checkout
or payment forms.

## Add a Forum Category

```sql
INSERT INTO forum_categories (name, description, position, is_members_only)
VALUES ('General Discussion', 'Open conversation about anything community-related.', 1, false);
```

Categories appear on `forum.html` when `feature_forum` is enabled. Members can create topics within any category they have access to.

## Configure AI Features

AI moderation and translation are platform-native via Run402. No API key required.

Enable the features via admin settings toggles or SQL:

```sql
UPDATE site_config SET value = 'true' WHERE key = 'feature_ai_moderation';
UPDATE site_config SET value = 'true' WHERE key = 'feature_ai_translation';
```

Moderation (`moderate-content.js`) runs on a 15-minute schedule and is free. Translation (`translate-content.js`) runs on demand when content is published and uses Run402's quota-tracked translation service.

Additional generative AI features (insights, onboarding, newsletter, event recaps) are paused pending a Run402 LLM endpoint. Their flags exist in `site_config` but are not exposed in the admin UI.

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

## Add an Embed Block (weather, video, map, booking widget)

The `embed` block renders third-party iframes from a vetted allowlist. As an admin you don't write iframe HTML — you pick a provider and fill in typed params. The block's edit popover (pencil icon on the section) routes by provider:

| Provider | Use | Params |
|---|---|---|
| `youtube` | YouTube video player | `video_id` (or paste a URL — the popover extracts the ID) |
| `vimeo` | Vimeo video player | `video_id` (numeric only; URL extractor available) |
| `calendly` | Booking widget | `username` (and optionally `event_type`) |
| `map` | Google Maps embed | `address` OR `lat` + `lng` |
| `weather` | Windy.com weather chart | `lat` + `lon` (and optionally `units: 'imperial'` and a display `location` label) |
| `tide_chart` | NOAA tide predictions | `station_id` (look up at `tidesandcurrents.noaa.gov`) |
| `iframe` | Generic escape hatch — any HTTPS source | `src` URL (requires explicit "I trust {hostname}" acknowledgment before save is enabled) |

To add an embed via SQL (e.g., a one-time seed):

```sql
INSERT INTO sections (page_slug, zone, scope, section_type, config, position)
VALUES (
  'index', 'main', 'page', 'embed',
  '{"heading":"Local Weather","provider":"weather","params":{"lat":35.5951,"lon":-82.5515,"units":"imperial"},"height":"360px","responsive":false}',
  10
);
```

To add via the admin UI:

1. Click "+ Add to main" at the bottom of the homepage main zone.
2. Choose "Embed" from the block picker.
3. Click the pencil icon on the new block's admin overlay.
4. Select a provider; fill in the params; for video providers paste a URL into the helper to auto-extract the ID.
5. For the generic `iframe` provider: enter the URL, then check the "I trust {hostname}" box (the hostname updates as you type the URL — typing a different URL clears the prior acknowledgment).
6. Click Save.

The renderer ships an iframe with the provider's exact `sandbox` allowlist and `loading="lazy"`. The CSP `frame-src` already lists every registered provider's host, so embeds load without browser-side blocks.

### What the CSP allows

Every Kychon project ships a Content Security Policy that restricts iframes to the registered providers' hosts (plus `https:` for the generic iframe escape hatch — gated by per-block trust acknowledgment). Adjacent headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, etc.) ride along in `public/_headers`.

If you need an embed from a host that isn't in the registry: don't paste raw HTML in a `custom` block (the CSP will block it). Either use the generic `iframe` provider (with the trust gate), or register the provider as code (see STRUCTURE.md → "Adding a provider").
