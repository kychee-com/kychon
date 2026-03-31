---
name: "Deploy"
description: "Deploy Wild Lychee sites to Run402"
category: Deploy
tags: [deploy, run402]
---

Deploy one or more Wild Lychee sites to Run402.

**Usage:**
- `/deploy` — deploy everything (portal + marketing)
- `/deploy portal` — deploy the portal template only
- `/deploy marketing` — deploy the marketing site only
- `/deploy eagles` — deploy the Eagles demo seed data
- `/deploy screenshots` — recapture showcase screenshots and redeploy marketing

## Sites

### Portal (wildlychee portal template)
- **Project:** `prj_1774878751490_0301` (or active project)
- **Subdomain:** `eagles.run402.com` (currently shares project with Eagles)
- **Deploy:** `node deploy.js`
- **Includes:** schema.sql + seed.sql migrations, site files, edge functions, RLS

### Marketing (wildlychee.com landing page)
- **Project:** `prj_1774953646641_0307`
- **Subdomain:** `wildlychee.run402.com`
- **Deploy:** `MARKETING_PROJECT_ID=prj_1774953646641_0307 node marketing/deploy-marketing.js`
- **Includes:** Static files only (HTML, CSS, assets). No database, no functions.

### Eagles Demo Seed
- **Run after portal deploy** to populate Eagles-specific data
- **Reactions & Activity:** `run402 projects sql prj_1774878751490_0301 --file demo/eagles/seed-eagles-reactions-activity.sql`

### Screenshots
- **Capture:** `./marketing/capture-screenshots.sh` (all) or `./marketing/capture-screenshots.sh eagles` (specific)
- **Then redeploy marketing** to include updated screenshots

## Steps

When deploying everything:

1. Run tests: `npx vitest run`
2. Deploy portal: `node deploy.js`
3. Deploy marketing: `MARKETING_PROJECT_ID=prj_1774953646641_0307 node marketing/deploy-marketing.js`
4. Verify both sites load in Chrome

When only a specific target is requested, deploy just that target.

Always run tests before deploying the portal. Always verify deploys via Chrome MCP after deploying.
