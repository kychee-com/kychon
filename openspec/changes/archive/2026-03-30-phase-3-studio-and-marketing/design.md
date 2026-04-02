## Context

Phases 1-2 delivered a complete community portal template: auth, members, directory, events, forum, resources, committees, admin dashboard, inline editing, i18n, AI moderation/translation/insights/onboarding, and scheduled functions. The template works but requires developer knowledge to fork, configure, and deploy.

Phase 3 bridges the gap to non-technical users by adding:
1. An AI builder (Kychon Studio) that deploys a customized portal in minutes
2. AI content automation (newsletter + event recaps)
3. A marketing site that positions Kychon against incumbents

Constraints: vanilla JS (no frameworks), no build step, Run402 hosting, BYOK for AI features, 10MB upload limit.

## Goals / Non-Goals

**Goals:**
- Non-technical community managers can deploy a fully customized portal without writing code
- Weekly newsletter drafting is automated — admin only reviews and sends
- kychon.com communicates the value prop and converts visitors to builders
- Niche landing pages speak each audience's language (church, HOA, sports, association)
- Niche seed variants give each vertical a ready-to-use starting point

**Non-Goals:**
- Web-based Studio UI (Phase 4 — this phase uses Claude Code skill only)
- Kychon Pro ongoing customization agent (Phase 4)
- Email sending infrastructure (newsletter generates drafts; sending mechanism is separate)
- Payment processing for the $29 premium build (manual/Stripe integration is Phase 4)
- Mobile app or PWA

## Decisions

### D1: Kychon Studio as a Claude Code skill, not a web app

Studio runs as a `/kychon-studio` Claude Code skill with full access to Chrome MCP, file system, and Run402 CLI. This gives it all the power it needs (browser automation, file editing, shell commands) without building a web UI.

**Alternatives considered:**
- Web-based chat UI: Would need its own auth, file system proxy, browser automation service. Much higher scope for Phase 3.
- CLI wizard (no AI): Loses the investigation and adaptive interview — the core differentiation.

**Rationale:** Claude Code skills are the fastest path to a working AI builder. The web UI can come in Phase 4 once the skill logic is proven.

### D2: Investigation extracts to a structured JSON report

The Chrome MCP investigation step produces a `investigation.json` with extracted brand data (colors, fonts, logo URL, content, structure). This becomes input to the interview step, which skips questions for data already found.

**Alternatives considered:**
- Free-form notes: Harder to programmatically skip interview questions.
- Direct config generation: Skips user validation — risky for accuracy.

**Rationale:** Structured extraction enables conditional interview logic and lets the user review what was found before building.

### D3: Interview output is a complete spec object

The interview produces a `studio-spec.json` containing brand.json content, feature flags, membership tiers, custom fields, homepage section config, and optional schema additions. This is the single source of truth for the build step.

**Rationale:** One structured object makes the build step deterministic — it reads the spec and applies each section mechanically.

### D4: Newsletter as draft-first workflow

`generate-newsletter.js` runs weekly (Monday 9 AM), reads the past week's activity, calls the AI API, and saves a draft to `newsletter_drafts`. Admins review/edit inline before sending. No auto-send.

**Alternatives considered:**
- Auto-send with AI-generated content: Too risky — communities need editorial control.
- Admin writes from scratch with AI suggestions: Doesn't solve the procrastination problem.

**Rationale:** Draft-first balances automation with editorial control. The admin's job shrinks from "write a newsletter" to "review and click send."

### D5: Marketing site built with Kychon's own stack

kychon.com is a static site using the same vanilla JS + CSS custom properties pattern as the template. Deployed on Run402, dogfooding the platform.

**Alternatives considered:**
- Next.js/Astro marketing site: Violates the no-build-step principle, adds complexity.
- Third-party landing page builder (Webflow, Carrd): Loses the dogfooding story.

**Rationale:** Using our own stack proves it works for marketing sites too, and the landing page is simple enough to not need a framework.

### D6: Niche seed variants as separate SQL files

Each vertical (church, HOA, association) gets its own `seed-{niche}.sql` file rather than conditional logic in a single seed.sql. Studio picks the right one based on interview answers.

**Alternatives considered:**
- Single seed.sql with feature flags: Cluttered, hard to maintain per-niche customizations.
- JSON config files that seed.sql reads: Extra indirection, PostgreSQL JSON handling is verbose.

**Rationale:** Separate files are simple, readable, and easy for Studio to select. Each file is self-contained with niche-specific roles, event types, pages, and sample data.

### D7: Event recap is on-demand, not scheduled

Unlike the newsletter (weekly cron), event recaps are triggered manually or by a post-event hook — not every event warrants a recap.

**Rationale:** Automated recaps for every event would generate noise. Admin judgment on which events to recap is valuable.

## Risks / Trade-offs

**[Chrome MCP reliability]** → Studio's investigation step depends on Chrome MCP to extract website data. Pages with heavy JS rendering, CAPTCHAs, or login walls may fail. **Mitigation:** Investigation is best-effort — if extraction fails, Studio falls back to asking all interview questions manually. The interview flow works with or without investigation data.

**[AI content quality]** → Newsletter and recap generators depend on AI API quality. Poor generations waste admin review time. **Mitigation:** Draft-first workflow means bad output is caught before publishing. Prompt engineering with community context (name, tone, language) improves quality. Admins can regenerate.

**[Niche seed data maintenance]** → Multiple seed files multiply maintenance burden when the schema evolves. **Mitigation:** Core schema rarely changes after Phase 1. Niche seeds only customize config, tiers, and sample content — not table structures.

**[Marketing claims vs. reality]** → Landing page promises "5 minutes" and "AI builds your portal." Studio must actually deliver this. **Mitigation:** Build Studio first, validate the flow end-to-end with Chrome verification, then write marketing copy based on real timing.

**[BYOK dependency]** → Newsletter/recap features require users to configure an AI API key. Users without keys get no AI content generation. **Mitigation:** Feature-flagged — features gracefully hide when no API key is set. Marketing site clearly explains BYOK model.
