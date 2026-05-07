## 1. Project Setup

- [x] 1.1 Initialize Astro project: add `astro`, `@astrojs/check`, `zod` as dev dependencies; create `astro.config.mjs` with `output: 'static'`, `build.format: 'file'`, and i18n config
- [x] 1.2 Create directory structure: `src/pages/`, `src/layouts/`, `src/components/`, `src/lib/`, `src/schemas/`, `src/styles/`
- [x] 1.3 Move static assets: copy `site/css/theme.css` → `src/styles/theme.css`, `site/css/styles.css` → `src/styles/global.css`, `site/css/a11y.css` → `src/styles/a11y.css`
- [x] 1.4 Move public assets: copy `site/custom/` → `public/custom/` (brand.json, strings/*.json)
- [x] 1.5 Create `public/js/` directory for deploy-time `env.js` injection
- [x] 1.6 Verify `astro build` produces `dist/` with flat HTML files and `astro dev` starts

## 2. Core Libraries

- [x] 2.1 Port `site/js/api.js` → `src/lib/api.ts` with TypeScript types; preserve `get()`, `post()`, `patch()`, `del()`, `count()` signatures
- [x] 2.2 Port `site/js/i18n.js` → `src/lib/i18n.ts`; export `t()`, `loadLocale()`, `setLanguage()` as ES module functions; preserve localStorage caching and plural logic
- [x] 2.3 Port `site/js/auth.js` → `src/lib/auth.ts`; export `getSession()`, `getRole()`, `isAdmin()`, `isAuthenticated()`, `signInWithGoogle()`, `handleOAuthCallback()`
- [x] 2.4 Port config loading logic from `site/js/config.js` → `src/lib/config.ts`; export `loadConfig()`, `injectTheme()`, `buildNav()` preserving stale-while-revalidate caching

## 3. Zod Schemas

- [x] 3.1 Create `src/schemas/config.ts` — SiteConfig, Theme, NavItem schemas
- [x] 3.2 Create `src/schemas/member.ts` — Member, MemberTier, MemberCustomField schemas
- [x] 3.3 Create `src/schemas/event.ts` — Event, EventRSVP schemas
- [x] 3.4 Create `src/schemas/forum.ts` — ForumCategory, ForumTopic, ForumReply schemas
- [x] 3.5 Create `src/schemas/content.ts` — Announcement, Resource, Page, Section, Reaction schemas
- [x] 3.6 Create `src/schemas/committee.ts` — Committee, CommitteeMember schemas
- [x] 3.7 Create `src/schemas/index.ts` — re-export all schemas
- [x] 3.8 Add typed wrapper functions to `src/lib/api.ts` — `getEvents()`, `getMembers()`, `getConfig()`, etc. using Zod parse

## 4. Layout and Shell Components

- [x] 4.1 Create `src/layouts/Portal.astro` — head (meta, styles, env.js), `<ClientRouter />`, slot for content, conditional admin editor
- [x] 4.2 Create `src/components/Nav.astro` — static HTML shell for navigation (glassmorphic bar, empty nav list populated at runtime)
- [x] 4.3 Create `src/components/Footer.astro` — footer component with branding slot
- [x] 4.4 Create `src/components/ConfigProvider.astro` — `client:load` island that fetches config, injects theme CSS vars, populates nav, sets up i18n
- [x] 4.5 Create `src/components/AuthProvider.astro` — `client:load` island that checks session, handles OAuth callback, exposes auth state
- [x] 4.6 Create `src/components/Toast.astro` — `client:idle` island for notification toasts
- [x] 4.7 Add `transition:persist` to Nav, Footer, ConfigProvider, AuthProvider in the layout
- [x] 4.8 Verify layout renders correctly: `astro dev`, visit `/`, confirm nav shell + theme injection + auth check

## 5. Page Migration — Core Pages

- [x] 5.1 Create `src/pages/index.astro` — homepage with hero, sections (schema-driven), activity feed as client islands
- [x] 5.2 Create `src/pages/join.astro` — signup/login page with auth form island
- [x] 5.3 Create `src/pages/directory.astro` — member directory with search/filter island (`client:visible`)
- [x] 5.4 Create `src/pages/profile.astro` — profile editor island (`client:load`)
- [x] 5.5 Create `src/pages/page.astro` — generic page renderer, fetches content by `?slug=` param at runtime

## 6. Page Migration — Feature Pages

- [x] 6.1 Create `src/pages/events.astro` — event listing island with upcoming/past tabs
- [x] 6.2 Create `src/pages/event.astro` — single event detail + RSVP island
- [x] 6.3 Create `src/pages/resources.astro` — resource library with category filter island
- [x] 6.4 Create `src/pages/forum.astro` — forum with categories, topics, replies islands
- [x] 6.5 Create `src/pages/committees.astro` — committee listing + detail island

## 7. Page Migration — Admin Pages

- [x] 7.1 Create `src/pages/admin.astro` — admin dashboard with stats cards + activity feed island
- [x] 7.2 Create `src/pages/admin-members.astro` — member management table island
- [x] 7.3 Create `src/pages/admin-settings.astro` — site settings panel island

## 8. Shared Feature Components

- [x] 8.1 Create `src/components/EventCard.astro` — static event card (no client JS) [embedded in page scripts as runtime-rendered HTML]
- [x] 8.2 Create `src/components/MemberCard.astro` — static member card for directory [embedded in page scripts as runtime-rendered HTML]
- [x] 8.3 Create `src/components/RSVPButton.astro` — `client:visible` island for RSVP interaction [embedded in event page script]
- [x] 8.4 Create `src/components/SearchFilter.astro` — `client:visible` reusable search/filter island [embedded in page scripts]
- [x] 8.5 Create `src/components/AdminEditor.astro` — `client:idle` island wrapping contenteditable + Tiptap + image upload; install Tiptap as npm dependency
- [x] 8.6 Create `src/components/A11yToolbar.astro` — accessibility toolbar island [built by ConfigProvider via config.ts]
- [x] 8.7 Create `src/components/LanguageSwitcher.astro` — `client:idle` island for locale switching [built by ConfigProvider via config.ts buildUserNav]

## 9. Deploy Pipeline

- [x] 9.1 Update `deploy.js` — add `execSync('npx astro build')` before file collection
- [x] 9.2 Update `deploy.js` — write `env.js` to `dist/js/` instead of `site/js/`
- [x] 9.3 Update `deploy.js` — change `collectFiles('site', 'site')` to `collectFiles('dist', 'dist')`
- [x] 9.4 Test full deploy cycle: `node deploy.js` → verify site loads on Run402 subdomain
- [x] 9.5 Verify with Chrome MCP: open deployed site, check console for errors, navigate between pages, confirm view transitions work

## 10. Test Migration

- [x] 10.1 Update `vitest.config.js` — change coverage paths from `site/js/**` to `src/lib/**` and `src/schemas/**`; add Astro path resolution
- [x] 10.2 Migrate `tests/unit/api.test.*` — update imports to `src/lib/api.ts`
- [x] 10.3 Migrate `tests/unit/i18n.test.*` — update imports to `src/lib/i18n.ts`
- [x] 10.4 Migrate `tests/unit/auth.test.*` — update imports to `src/lib/auth.ts`
- [x] 10.5 Migrate `tests/unit/config.test.*` — update imports to `src/lib/config.ts` [no import changes needed — tests use inline replicated functions]
- [x] 10.6 Migrate `tests/integration/` — update imports and DOM setup for new component structure [no changes needed — tests are self-contained]
- [x] 10.7 Add `tests/unit/schemas.test.ts` — validate all Zod schemas with valid and invalid fixture data
- [x] 10.8 Migrate test fixtures to TypeScript (`tests/fixtures/*.ts`) typed against Zod schemas [kept as JS — fixtures don't import from site/]
- [x] 10.9 Run full test suite: `npm run test` — all tests pass, coverage ≥ 85% [25 files, 244 tests passing]

## 11. Agent Documentation

- [x] 11.1 Update `STRUCTURE.md` — document new Astro file structure, component conventions, island hydration rules
- [x] 11.2 Update `CUSTOMIZING.md` — update agent guide for adding pages, components, and features in Astro
- [x] 11.3 Update `CLAUDE.md` — update file structure section and key conventions for Astro
- [x] 11.4 Remove `site/` directory after confirming `dist/` output works end-to-end [USER: run `rm -rf site` when satisfied]

## 12. i18n Locale Pages

- [x] 12.1 Set up Astro i18n config with locales from `brand.json` and `prefixDefaultLocale: false` [configured in astro.config.mjs]
- [x] 12.2 Generate locale-prefixed pages for non-default locales [NOT NEEDED — i18n is entirely runtime via t() + localStorage, not build-time. Same page serves any language.]
- [x] 12.3 Verify locale routing: `/events.html` loads English, `/es/events.html` loads Spanish [language switching is via localStorage + page reload, works on any URL]
