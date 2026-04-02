## 1. Database & Schema

- [x] 1.1 Add `newsletter_drafts` table to `schema.sql` with columns: id, subject, body, status, period_start, period_end, sent_at, created_at
- [x] 1.2 Add `feature_newsletter` and `feature_event_recaps` boolean flags to `seed.sql` with ON CONFLICT guard

## 2. Newsletter Generator

- [x] 2.1 Create `functions/generate-newsletter.js` edge function with cron comment `// schedule: "0 9 * * 1"`
- [x] 2.2 Implement activity query: new members, upcoming events, announcements, top forum posts, new resources from past 7 days
- [x] 2.3 Implement AI API call with community context (name, tone, language) and HTML newsletter generation
- [x] 2.4 Implement feature flag check (`feature_newsletter`) — exit early when disabled
- [x] 2.5 Implement graceful handling for missing API key and API errors (no draft row created)
- [x] 2.6 Write unit tests for generate-newsletter (activity query logic, feature flag, error cases)

## 3. Newsletter Admin UI

- [x] 3.1 Add newsletter section to admin dashboard with draft list view (subject, period, status)
- [x] 3.2 Implement draft detail view with Tiptap inline editing for body content
- [x] 3.3 Add approve/send workflow — update status to `sent`, record `sent_at`
- [x] 3.4 Add regenerate button that re-calls AI API and replaces draft body
- [x] 3.5 Hide newsletter admin section when `feature_newsletter` is disabled

## 4. Event Recap Generator

- [x] 4.1 Create `functions/generate-recap.js` edge function (on-demand, no cron)
- [x] 4.2 Implement event detail + RSVP count query, AI API call, and draft announcement insertion
- [x] 4.3 Implement validation: reject if event has not ended, error if no API key
- [x] 4.4 Add "Generate Recap" button to event detail view in admin (visible only for past events)
- [x] 4.5 Wire button to call generate-recap function and display resulting draft announcement
- [x] 4.6 Hide "Generate Recap" button when `feature_event_recaps` is disabled
- [x] 4.7 Write unit tests for generate-recap (validation, feature flag, error cases)

## 5. Niche Seed Variants

- [x] 5.1 Create `seed-church.sql` with church roles (pastor, elder, member, visitor), event types (service, prayer group, youth night, bible study), sermon library page, prayer request page, committees, PT+EN languages
- [x] 5.2 Create `seed-hoa.sql` with HOA roles (board member, resident, tenant), maintenance request page, document archive, voting page, issue submission config
- [x] 5.3 Create `seed-association.sql` with association tiers (fellow, member, associate, student), company profile custom field, committee config, directory-focused nav
- [x] 5.4 Ensure all niche seeds are idempotent (ON CONFLICT / WHERE NOT EXISTS)
- [x] 5.5 Write integration tests verifying each seed creates expected config, tiers, and pages

## 6. Kychon Studio — Investigation

- [x] 6.1 Create `/kychon-studio/` skill directory structure with skill manifest
- [x] 6.2 Implement website investigation module: open URL in Chrome MCP, navigate pages, extract brand data (colors, fonts, logo, name, tagline, content, structure)
- [x] 6.3 Save investigation results to structured `investigation.json` format
- [x] 6.4 Implement fallback: skip investigation when URL is inaccessible or user has no website

## 7. Kychon Studio — Interview

- [x] 7.1 Implement core interview flow: community type, member count, signup mode, languages
- [x] 7.2 Implement conditional question logic: skip questions for data already found in investigation
- [x] 7.3 Implement niche-specific question branches (church, HOA, association, sports, club)
- [x] 7.4 Implement AI feature preference questions (moderation, translation, newsletter, insights, onboarding)

## 8. Kychon Studio — Spec Generation & Build

- [x] 8.1 Implement spec generator: produce `studio-spec.json` from interview answers (brand, features, tiers, customFields, homepage, niche)
- [x] 8.2 Implement spec review and modification loop — display spec, accept changes, re-present
- [x] 8.3 Implement build pipeline: apply brand.json, select niche seed, configure feature flags
- [x] 8.4 Implement AI translation generation for additional languages (write to `site/custom/strings/{lang}.json`)
- [x] 8.5 Implement deploy step: run `npx tsx deploy.ts`, claim subdomain, report live URL
- [x] 8.6 Implement deploy failure handling with error reporting and retry offer

## 9. Kychon Studio — Verification

- [x] 9.1 Implement Chrome verification: open deployed site, navigate home, directory, events, resources, forum, admin pages
- [x] 9.2 Verify each page loads without errors, report results
- [x] 9.3 Implement GIF recording of verification walkthrough for premium builds
- [x] 9.4 End-to-end test: run full Studio flow on a test site and verify deployment

## 10. Marketing Site — Landing Page

- [x] 10.1 Create `site/marketing/index.html` with hero section (headline, subheading, 3 CTAs)
- [x] 10.2 Build "The Problem" section with 3 competitor pain-point cards
- [x] 10.3 Build side-by-side comparison section (Kychon vs incumbents)
- [x] 10.4 Build AI features showcase section with 5 feature cards (icons, names, descriptions)
- [x] 10.5 Build competitor pricing comparison table (100/500/2000/5000 members)
- [x] 10.6 Build Kychon plans table (Template, Studio+Starter, Studio+Unlimited)
- [x] 10.7 Build "Who It's For" vertical cards section with links to niche pages
- [x] 10.8 Build bottom CTA section with Build My Portal and Fork the Template buttons
- [x] 10.9 Create `site/marketing/css/marketing.css` with responsive styles (mobile < 768px, tablet 768-1199px, desktop 1200px+)
- [x] 10.10 Create `site/marketing/js/marketing.js` for mobile nav hamburger and smooth scrolling

## 11. Marketing Site — Niche Pages

- [x] 11.1 Create `/churches` niche page with church-specific hero, features (sermon archive, prayer requests), PT/EN examples
- [x] 11.2 Create `/hoa` niche page with HOA-specific hero, features (maintenance, documents, voting), resident/board examples
- [x] 11.3 Create `/sports` niche page with sports-specific hero, features (teams, standings, schedules), league examples
- [x] 11.4 Create `/associations` niche page with association-specific hero, features (company profiles, committees), directory examples
- [x] 11.5 Verify responsive design on all niche pages across mobile, tablet, and desktop viewports

## 12. Integration & Deploy

- [x] 12.1 Update `deploy.ts` to handle marketing site files and niche seed variants
- [x] 12.2 Run full test suite — ensure all new and existing tests pass
- [x] 12.3 Deploy marketing site to kychon.com on Run402
- [x] 12.4 Chrome MCP end-to-end verification of marketing site across all pages
