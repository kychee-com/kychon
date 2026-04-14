## 1. Project Setup

- [x] 1.1 Create `demo/eagles/` directory structure
- [x] 1.2 Provision a new Run402 project for the demo (`run402 projects provision`)
- [x] 1.3 Claim subdomain `eagles` for the new project (auto-claimed on deploy)
- [x] 1.4 Document any Run402 friction during provisioning

## 2. AI Image Generation

- [x] 2.1 Generate Eagles logo (eagle motif, "The Eagles" text, navy + gold) and save to `demo/eagles/assets/`
- [x] 2.2 Generate hero image (community volunteering in Wichita setting) and save to assets
- [x] 2.3 Generate 25+ unique member avatar headshots (diverse group) and save to assets
- [x] 2.4 Generate 6+ event photos (food drive, park cleanup, fundraiser, habitat build, youth program, gala) and save to assets
- [x] 2.5 Upload all generated images to Run402 storage for the Eagles project
- [x] 2.6 Record all storage URLs for use in seed SQL
- [x] 2.7 Document any Run402 storage friction (upload limits, API behavior, URL patterns)

## 3. Brand Configuration

- [x] 3.1 Create `demo/eagles/brand.json` with Eagles colors (navy #1b365d, gold #d4a843), fonts (Nunito/Open Sans), name, tagline
- [x] 3.2 Define custom navigation config with all features enabled plus "About" and "Volunteer" pages

## 4. Seed Data — Members

- [x] 4.1 Write member INSERT statements for 25+ members with AI-generated names, bios, avatar URLs, varied tiers, join dates spanning 2 years
- [x] 4.2 Set 1 member as admin (role: 'admin'), 2 as moderators, rest as members
- [x] 4.3 Include a few pending members to show the approval workflow

## 5. Seed Data — Events

- [x] 5.1 Write INSERT statements for 5+ upcoming events (food drive, park cleanup, gala, youth day, volunteer training) with Wichita venues, capacities, images
- [x] 5.2 Write INSERT statements for 5-7 past events with realistic dates using `now() - interval` expressions
- [x] 5.3 Write event_rsvps records for past events (10-20 RSVPs each) and upcoming events (5-15 RSVPs each)

## 6. Seed Data — Forum

- [x] 6.1 Write INSERT statements for 5 forum categories (General, Volunteering, Fundraising Ideas, Community Stories, Feedback)
- [x] 6.2 Write 15-20 forum topics across categories with realistic titles and bodies
- [x] 6.3 Write 40-60 forum replies across topics with varied authors and timestamps
- [x] 6.4 Update reply_count on topics to match actual reply counts

## 7. Seed Data — Committees, Announcements, Resources

- [x] 7.1 Write INSERT statements for 6 committees (Fundraising, Outreach, Youth Programs, Events Planning, Communications, Board of Directors)
- [x] 7.2 Write 30+ committee_members assignments (each member on 1-3 committees)
- [x] 7.3 Write 8-10 announcements with HTML bodies, pinned flags, author IDs, dates spread over 3 months
- [x] 7.4 Write 12-15 resources across 4 categories (Handbooks, Forms, Training, Media) with file URLs and members-only flags

## 8. Seed Data — AI Features & Activity

- [x] 8.1 Write 2 newsletter_drafts (1 draft, 1 sent) with realistic HTML content
- [x] 8.2 Write 30-40 activity_log entries with varied actions and recent timestamps
- [x] 8.3 Write member_insights entries (2-3 pending insights for engagement tracking)
- [x] 8.4 Enable all feature flags in seed (events, forum, directory, resources, committees, all AI features)

## 9. Seed Data — Custom Pages

- [x] 9.1 Write pages rows for "About The Eagles" and "Volunteer With Us" with HTML content
- [x] 9.2 Write homepage sections config: hero (Eagles headline + CTA), features (volunteer capabilities), stats (years active, members helped, volunteer hours), CTA (join)

## 10. Deploy Script

- [x] 10.1 Create `demo/eagles/deploy-eagles.js` that provisions project, uploads images, generates env.js, runs schema + seed, deploys site + functions
- [x] 10.2 Assemble final `seed-eagles.sql` from all seed sections (config, members, events, forum, committees, announcements, resources, AI features, pages)
- [x] 10.3 Run deploy script end-to-end and verify deployment

## 11. Verification & Friction Log

- [x] 11.1 Chrome MCP verification: navigate every page (home, directory, events, resources, forum, committees, admin) and check for errors
- [x] 11.2 Verify content density: 25+ members in directory, 10+ events, active forum, committees with members
- [x] 11.3 Verify branding: logo, colors, fonts, hero image all render correctly
- [x] 11.4 Verify AI features: newsletter drafts visible in admin, activity feed populated
- [x] 11.5 Document all Run402 friction encountered during the entire process in docs/run402-feedback.md
