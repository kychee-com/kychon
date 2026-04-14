---
name: "Deploy"
description: "Test, commit, deploy, verify, create release, and report friction for Kychon sites"
category: Deploy
tags: [deploy, run402, test, release]
---

Full deploy pipeline: test locally, commit, push, deploy to Run402, verify via Chrome, create a GitHub release, and report any friction as GitHub issues.

**Usage:**
- `/deploy` — full pipeline for everything (portal + marketing)
- `/deploy portal` — portal only
- `/deploy marketing` — marketing site only
- `/deploy eagles` — deploy Eagles demo seed data
- `/deploy screenshots` — recapture showcase screenshots and redeploy marketing

## Full Pipeline

Run these steps in order. Do NOT skip steps.

### 1. Quality Checks
```
npx vitest run && npx biome check . && npx tsc --noEmit --project jsconfig.json
```
Or use `npm run check` which runs all three. If any fail, fix before proceeding.

### 2. Commit & Push
- `git status` + `git diff --stat` to review changes
- Stage relevant files (never `git add .` blindly)
- Commit with a descriptive message
- `git push`

### 3. Deploy

#### Portal (community template)
- **Project:** Set `RUN402_PROJECT_ID` env var (or check `run402 projects list`)
- **Subdomain:** `eagles.kychon.com`
- **Command:** `RUN402_PROJECT_ID=$PORTAL_PROJECT_ID SUBDOMAIN=eagles node deploy.js`
- **Includes:** schema.sql + seed.sql, site files, edge functions, RLS
- **IMPORTANT:** Always pass explicit project ID and subdomain — do NOT rely on the active project, which may have changed

#### Marketing (kychon.com)
- **Project:** Set `MARKETING_PROJECT_ID` env var (or check `run402 projects list`)
- **Subdomain:** `kychon.com`
- **Command:** `MARKETING_PROJECT_ID=$MARKETING_PROJECT_ID node marketing/deploy-marketing.js`
- **Includes:** Static HTML/CSS/assets only

#### Eagles Demo Seed (after portal deploy)
- **Command:** `run402 projects sql $PORTAL_PROJECT_ID --file demo/eagles/seed-eagles-reactions-activity.sql`

#### Screenshots (before marketing deploy)
- **Capture:** `./marketing/capture-screenshots.sh`
- **Then redeploy marketing** to include updated images

### 4. E2E Verification via Chrome MCP

After deploy, open each deployed site in Chrome and verify:

**Portal (eagles.kychon.com):**
- Homepage loads with sections (hero, features, stats, activity feed, announcements)
- Activity feed shows entries with member names and timestamps
- Announcements display with reaction bars
- Nav links work (directory, events, resources, forum, committees)
- Check browser console for errors

**Marketing (kychon.com):**
- All sections render (hero, problem, features, AI, showcase, pricing, niches, CTA, footer)
- Nav anchor links scroll to correct sections
- Showcase gallery shows Eagles screenshot
- Niche page links work (/churches.html, /hoa.html, /sports.html, /associations.html)
- External links work (GitHub, Eagles demo)

### 5. Create GitHub Release

**CRITICAL: Every deploy MUST create a semantic version release.** This is not optional.

#### Version bumping

Determine the version bump from the changes being deployed:
- **patch** (0.0.X): bug fixes, copy changes, CSS tweaks, config updates
- **minor** (0.X.0): new features, new pages, new edge functions, new demo portals
- **major** (X.0.0): breaking changes, architecture changes, schema migrations that break existing data

Get the last release tag:
```bash
gh release list --repo kychee-com/kychon --limit 1 --json tagName -q '.[0].tagName' 2>/dev/null || echo "v0.0.0"
```

Increment appropriately (e.g., `v0.3.0` -> `v0.3.1` for patch, `v0.4.0` for minor).

#### Release notes

Generate detailed release notes from commits since the last release. Use this format:

```bash
gh release create <tag> --repo kychee-com/kychon --title "<tag> — <short title>" --notes "$(cat <<'EOF'
## What's New

<Bullet list of user-facing changes. Group by category if needed.>

## Details

<For each significant change, 1-2 sentences explaining what changed and why.>

## Deployed To

- Portal: https://eagles.kychon.com
- Marketing: https://kychon.com

## Commits

<List commits since last release: `git log <last-tag>..HEAD --oneline`>
EOF
)"
```

**Rules for release notes:**
- Lead with user-facing changes, not implementation details
- Group changes: Features, Fixes, Marketing, Infrastructure
- Include deploy URLs so anyone can verify
- List all commits for traceability
- The title should capture the theme of the release (e.g., "v0.4.0 — Native AI, no more BYOK")

### 6. Report Friction

**CRITICAL: Report ANY issues encountered during the entire pipeline as GitHub issues.** This includes bugs, unexpected behavior, missing features, confusing error messages, documentation gaps, and workarounds you had to use.

File issues on the appropriate repo:
- **Platform/backend** (deploy behavior, SQL, storage, RLS, seed, CDN, subdomains, demo mode) → `gh issue create --repo MajorTal/run402`
- **CLI/tooling** (argument order, error messages, missing flags, docs) → `gh issue create --repo kychee-com/run402`

Include in each issue:
- Steps to reproduce
- Expected vs actual behavior
- Workaround used (if any)

Even small friction counts — if you had to work around something, file it.

## When deploying a specific target

Skip steps that don't apply (e.g., `/deploy marketing` skips portal deploy and portal E2E), but always:
- Run tests if code changed
- Commit & push if there are uncommitted changes
- Verify the deployed target via Chrome
- Create a GitHub release (even for single-target deploys)
- Report any friction
