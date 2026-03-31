## Design: Barrio Unido Demo

### Architecture

No code changes. Three new files exercise existing infrastructure:

1. **`demo/barrio-unido/seed.sql`** — Spanish-first seed with English content_translations rows
2. **`demo/barrio-unido/generate-images.sh`** — OpenAI image generation script
3. **`site/custom/strings/es.json`** — Spanish UI string translations

### Bilingual Content Strategy

Base content is in Spanish (the community's primary language). English translations live in the `content_translations` table. The frontend's `getTranslatedContent()` function handles switching:

- User locale `es` (default) -> shows base content directly from tables
- User locale `en` -> queries content_translations for English version

Translated content types: announcements (title, body), events (title, description), resources (title, description), pages (title, body).

Forum posts and member bios are NOT translated - these are user-generated and stay in whatever language the author wrote them.

### Theme

Warm terracotta palette, distinct from every other demo's blue:

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
```

### Seed Data Volume

Matches eagles demo density:

| Content | Count |
|---------|-------|
| Members | 22 |
| Events (upcoming + past) | 10 |
| Announcements | 8 (2 pinned) |
| Resources | 12 |
| Forum categories | 5 |
| Forum topics | 15 |
| Forum replies | ~40 |
| Committees | 6 |
| Membership tiers | 4 |
| Content translations | ~60 rows (EN for all admin content) |
| Activity log entries | 30 |

### Decisions

- **AI features OFF** — clean demo of the translation system without AI dependencies
- **Spanish default** — `defaultLanguage: "es"` in seed config, `languages: ["es", "en"]`
- **Nav labels in Spanish** — "Inicio", "Miembros", "Eventos", "Recursos", "Foro", "Programas"
- **East LA setting** — Boyle Heights venues, local references, realistic community center vibe
- **No images in git** — generate-images.sh creates them, uploaded to Run402 storage separately
