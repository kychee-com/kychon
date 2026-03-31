---
name: "Deploy"
description: "Test, commit, deploy, verify, and report friction for Wild Lychee sites"
category: Deploy
tags: [deploy, run402, test]
---

Full deploy pipeline: test locally, commit, push, deploy to Run402, verify via Chrome, and report any friction as GitHub issues.

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
- **Project:** `prj_1774878751490_0301`
- **Subdomain:** `eagles.run402.com`
- **Command:** `node deploy.js`
- **Includes:** schema.sql + seed.sql, site files, edge functions, RLS

#### Marketing (wildlychee.com)
- **Project:** `prj_1774953646641_0307`
- **Subdomain:** `wildlychee.run402.com`
- **Command:** `MARKETING_PROJECT_ID=prj_1774953646641_0307 node marketing/deploy-marketing.js`
- **Includes:** Static HTML/CSS/assets only

#### Eagles Demo Seed (after portal deploy)
- **Command:** `run402 projects sql prj_1774878751490_0301 --file demo/eagles/seed-eagles-reactions-activity.sql`

#### Screenshots (before marketing deploy)
- **Capture:** `./marketing/capture-screenshots.sh`
- **Then redeploy marketing** to include updated images

### 4. E2E Verification via Chrome MCP

After deploy, open each deployed site in Chrome and verify:

**Portal (eagles.run402.com):**
- Homepage loads with sections (hero, features, stats, activity feed, announcements)
- Activity feed shows entries with member names and timestamps
- Announcements display with reaction bars
- Nav links work (directory, events, resources, forum, committees)
- Check browser console for errors

**Marketing (wildlychee.run402.com):**
- All sections render (hero, problem, features, AI, showcase, pricing, niches, CTA, footer)
- Nav anchor links scroll to correct sections
- Showcase gallery shows Eagles screenshot
- Niche page links work (/churches.html, /hoa.html, /sports.html, /associations.html)
- External links work (GitHub, Eagles demo)

### 5. Report Friction

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
- Report any friction
