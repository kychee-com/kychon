---
name: "Kychon Studio"
description: "AI-powered portal builder — investigate, interview, build, deploy, and verify a Kychon community portal"
category: Build
tags: [studio, build, deploy, portal]
---

Build a complete Kychon community portal through investigation, interview, and automated deployment.

**Input**: Optionally provide a website URL or community name (e.g., `/kychon-studio igrejadaesperanca.pt` or `/kychon-studio "Riverside HOA"`).

## Steps

### 1. Website Investigation (optional)

If the user provides a website URL:

1. Use Chrome MCP tools to open the URL
2. Extract brand data by reading the page:
   - **Visual identity**: Logo URL, color palette (look at CSS custom properties, prominent colors), fonts
   - **Content**: Organization name, tagline/mission, team/staff info, contact details
   - **Structure**: What pages exist, what features are present (events, blog, gallery, member area, resources)
   - **Language**: Primary language of the site
3. Save findings to a structured report:
   ```json
   {
     "name": "...",
     "tagline": "...",
     "colors": { "primary": "#...", "secondary": "#..." },
     "fonts": { "heading": "...", "body": "..." },
     "logo_url": "...",
     "language": "...",
     "features_found": ["events", "blog", ...],
     "pages": ["Home", "About", "Events", ...]
   }
   ```
4. Present findings: "Here's what I found on your website: ..."

If investigation fails or no URL provided, skip to interview.

### 2. Context-Aware Interview

Ask these questions interactively. **Skip any question for which data was already found in investigation.**

**Always ask:**
- Community type: church, club, HOA, association, sports league, coworking, alumni, nonprofit, other
- Approximate member count
- Signup mode: open or admin-approved
- Languages (which languages should the portal support?)

**Ask if not found in investigation:**
- Organization name
- Brand colors (primary + accent)
- Tagline or mission

**Niche-specific questions (based on community type):**

**Church:**
- Sermon archive format? (Downloads, YouTube embeds, or none)
- Prayer requests feature? (via forum category)
- Committees/ministries? (youth, worship, deacons, etc.)

**HOA:**
- Maintenance request tracking? (via forum category)
- Document archive important? (bylaws, minutes, budgets)
- Voting/polls needed?
- Roles: resident vs board member distinction?

**Professional Association:**
- Company profiles in directory? (custom field)
- Committee structure?
- Membership tier naming? (fellow, member, associate, student?)

**Sports League:**
- Teams/divisions needed?
- Standings/schedules?
- League management features?

**AI features:**
- Content moderation? (auto-review posts)
- Auto-translation? (multi-language content)
- Newsletter generation? (weekly AI-drafted newsletter)
- Member insights? (at-risk member detection)
- Smart onboarding? (personalized welcome)

### 3. Spec Generation

From the interview answers, generate a `studio-spec.json`:

```json
{
  "brand": {
    "name": "...",
    "tagline": "...",
    "colors": { "primary": "#...", "primary_hover": "#...", "bg": "#fff", ... },
    "fonts": { "heading": "...", "body": "..." },
    "languages": ["en"],
    "defaultLanguage": "en"
  },
  "features": {
    "feature_events": true,
    "feature_forum": true,
    ...
  },
  "tiers": [
    { "name": "...", "description": "...", "benefits": [...], "price_label": "...", "position": 1, "is_default": true }
  ],
  "customFields": [
    { "field_name": "...", "field_label": "...", "field_type": "text", ... }
  ],
  "homepage": {
    "hero": { "heading": "...", "subheading": "...", "cta_text": "...", "cta_href": "#signup" },
    "features": { "columns": 3, "items": [...] },
    "cta": { "heading": "...", "text": "...", "cta_text": "...", "cta_href": "#signup" }
  },
  "niche": "church|hoa|association|default",
  "committees": [{ "name": "...", "description": "..." }],
  "forumCategories": [{ "name": "...", "description": "...", "color": "#..." }]
}
```

Present the spec to the user as a readable summary:
- "Here's what I'm going to build for you: ..."
- List brand settings, enabled features, membership tiers, committees, etc.
- Ask: "Does this look right? Any changes?"

If the user requests changes, update the spec and re-present.

### 4. Build & Deploy

Once the user confirms:

1. **Apply brand.json**: Write `public/custom/brand.json` with brand settings from spec
2. **Select seed variant**: Based on `niche` field:
   - `church` → use `seed-church.sql`
   - `hoa` → use `seed-hoa.sql`
   - `association` → use `seed-association.sql`
   - `default` → use `seed.sql`
3. **Customize seed**: Update the selected seed SQL with the spec's specific values (name, tagline, colors, tiers, committees, forum categories, homepage sections)
4. **Feature flags**: Update feature flag values in the seed based on spec
5. **Generate translations**: If additional languages are configured:
   - Read `public/custom/strings/en.json` as the base
   - For each additional language, call the AI API to translate all strings
   - Write translations to `public/custom/strings/{lang}.json`
6. **Deploy**: Run `npx tsx deploy.ts` to deploy to Run402
7. **Report**: Show the live URL and prompt user to sign up as first admin

If deploy fails, report the error and offer to retry.

### 5. Chrome Verification

After successful deployment:

1. Open the deployed URL in Chrome
2. Navigate to each major page: Home, Directory, Events, Resources, Forum (if enabled), Admin
3. Verify each page loads without console errors
4. Report results: "All pages verified!" or "Issue found on [page]: [error]"

For premium builds, record a GIF of the walkthrough using Chrome MCP gif_creator.

### 6. Completion

Report to the user:
- Live URL
- Summary of what was built (features, pages, languages)
- "Sign up at [URL] to become the first admin!"
- Mention they can customize further with Kychon Pro (Phase 4)

## Guardrails

- Always confirm the spec with the user before building
- Never deploy without user confirmation
- If investigation fails, gracefully skip and interview fully
- Handle deploy errors with clear messaging and retry option
- If the user asks about pricing: free basic build; $29 premium (investigation + translations + custom homepage + GIF)
