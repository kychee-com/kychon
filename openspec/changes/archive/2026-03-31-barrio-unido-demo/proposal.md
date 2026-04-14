## Why

Kychon needs a demo that showcases its bilingual i18n system and content_translations feature end-to-end. The existing demos (Eagles, Church, HOA, Association) are all English-only and share a similar visual identity (blues/navys). Barrio Unido is a fictional Latino immigrant services community center in East LA that demonstrates:

1. **Full ES/EN bilingual portal** — Spanish as the default language, English via content_translations
2. **The content_translations system** — admin-generated content (events, announcements, resources, homepage sections) stored in Spanish with English translation rows, showing the translation infrastructure working without requiring the AI translation feature to be enabled
3. **A visually distinct theme** — warm terracotta + teal + marigold on cream, breaking out of the corporate blue palette every other demo uses
4. **Community services vertical** — legal clinics, ESL classes, citizenship prep, food pantry, cultural events — a completely different use case from charity orgs, churches, or HOAs
5. **The first `es.json` translation file** — a full Spanish translation of all ~60 UI string keys, reusable by any future Spanish-language portal

## What Changes

### New files

- **`demo/barrio-unido/seed.sql`** (~200KB) — Full community seed: site_config (branding, terracotta+teal theme, nav, feature flags), 6 committees/programas, 5 forum categories, 20-25 members with Spanish-first names and bios, 10-12 events (ESL classes, legal clinics, cultural festivals), 8-10 announcements, 12-15 resources (immigration guides, tenant rights, scholarship apps), homepage sections (hero, stats, features, testimonials, activity_feed, CTA), membership tiers (Vecino, Voluntario, Promotor, Consejero), and content_translations rows providing English translations for all admin content

- **`demo/barrio-unido/generate-images.sh`** (~5KB) — OpenAI image generation script for: community mural hero image, 20-25 warm diverse portrait avatars, 6+ event photos (markets, workshops, celebrations, murals, legal clinic, food pantry)

- **`site/custom/strings/es.json`** (~60 keys) — Full Spanish translation of all UI chrome: navigation, auth forms, profile, directory, announcements, admin dashboard, admin members, admin settings, common actions, member counts. This file is reusable by any future Spanish-language Kychon portal.

### Modified files

- **`site/custom/brand.json`** — No change to the default (stays English-only). Each demo's seed.sql sets its own language config via site_config. But we should verify the i18n system handles `defaultLanguage: "es"` correctly when set via DB config.

### No code changes required

The content_translations table, `getTranslatedContent()` function, i18n system with `t()`, and locale switching all exist. This demo exercises the existing infrastructure with data only.

## Capabilities

### New Capabilities

- **`barrio-unido-seed`**: Full community seed SQL with bilingual content — Spanish base content + English content_translations rows for events, announcements, resources, and homepage section config. 20-25 members, 10-12 events, 8-10 announcements, 12-15 resources, 5 forum categories, 6 committees, 4 membership tiers.

- **`barrio-unido-images`**: AI image generation script producing ~35 assets: community mural hero, diverse warm-toned portraits, event photos depicting markets, workshops, celebrations, murals, legal clinics, food pantry operations.

- **`es-translation`**: Complete Spanish translation of all UI string keys (~60 keys) at `site/custom/strings/es.json`. Covers nav, auth, profile, directory, announcements, admin, and common actions.

### Modified Capabilities

_(none — this is seed data and a translation file, not a code change)_

## Impact

- **New files**: `demo/barrio-unido/seed.sql`, `demo/barrio-unido/generate-images.sh`, `site/custom/strings/es.json`
- **Run402**: Deployed to a new project with its own database and subdomain (e.g., `barrio.kychon.com`)
- **Dependencies**: OpenAI API (image generation), Run402 CLI, Run402 storage API
- **No impact on template code**: All changes are seed data, a translation file, and image assets
- **Reusable**: The `es.json` file benefits any future Spanish-language Kychon deployment

## Content Model

```
  BARRIO UNIDO BILINGUAL CONTENT FLOW
  ═══════════════════════════════════════════════════

  seed.sql inserts:

  events table (Spanish)          content_translations table (English)
  ┌───────────────────────┐       ┌──────────────────────────────────────┐
  │ id: 1                 │       │ content_type: "event"                │
  │ title: "Noche de      │──────▶│ content_id: 1                        │
  │   Ciudadanía"         │       │ language: "en"                       │
  │ description: "Taller  │       │ field: "title"                       │
  │   mensual de..."      │       │ translated_text: "Citizenship Night" │
  └───────────────────────┘       └──────────────────────────────────────┘

  Frontend (config.js):
  ┌─────────────────────────────────────────────┐
  │ locale = localStorage.getItem('wl_locale')  │
  │                                             │
  │ if locale === 'es' → show base content      │
  │ if locale === 'en' → getTranslatedContent() │
  │                       query REST API        │
  │                       show English text      │
  └─────────────────────────────────────────────┘
```

## Theme

```
  primary:       #C2553A (terracotta)
  primary_hover: #A8432D (deeper terracotta)
  bg:            #FFF8F0 (warm cream)
  surface:       #F0E6D8 (sandy)
  text:          #2D1810 (deep brown)
  text_muted:    #7A6B5E (warm gray)
  border:        #D4C4B0 (tan)
  font_heading:  Playfair Display
  font_body:     Source Sans 3
  radius:        0.75rem
  max_width:     72rem
```
