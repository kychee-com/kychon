## ADDED Requirements

### Requirement: Website investigation via Chrome MCP

The Studio skill SHALL open the user's existing website in Chrome, navigate key pages, and extract brand data into a structured `investigation.json` report. Extracted data SHALL include: organization name, logo URL, color palette (primary, secondary, accent), fonts, tagline/mission, team/staff info, contact details, existing page structure, detected features (events, blog, gallery, member area, resources), and language.

#### Scenario: Successful website investigation
- **WHEN** the user provides a website URL and the site is accessible
- **THEN** Studio SHALL open the URL in Chrome, capture visual identity (colors, fonts, logo), extract text content (name, tagline, mission), identify site structure (pages, features), and save results to `investigation.json`

#### Scenario: Website is inaccessible or investigation fails
- **WHEN** the user provides a URL but the site cannot be loaded or content cannot be extracted
- **THEN** Studio SHALL log the failure, skip investigation, and proceed directly to the full interview flow without pre-filled data

#### Scenario: No existing website
- **WHEN** the user indicates they have no existing website
- **THEN** Studio SHALL skip the investigation step entirely and proceed to the interview flow

### Requirement: Context-aware interview flow

The Studio skill SHALL conduct an interactive interview to gather community configuration details. Questions SHALL be conditional based on investigation findings — questions for data already extracted SHALL be skipped. The interview SHALL always ask: community type (church, club, HOA, association, sports, coworking, alumni, nonprofit), approximate member count, signup approval mode (open or admin-approved), and languages.

#### Scenario: Interview after successful investigation
- **WHEN** investigation found the organization name and brand colors
- **THEN** Studio SHALL present the found data for confirmation and skip those interview questions, asking only for data not found

#### Scenario: Interview without investigation
- **WHEN** no investigation was performed
- **THEN** Studio SHALL ask all questions including organization name, brand colors, and other data that would have been extracted

#### Scenario: Niche-specific questions for church
- **WHEN** user selects "church" as community type
- **THEN** Studio SHALL ask about sermon archive format (downloads vs YouTube), prayer requests, worship team resources, and relevant committees (youth, worship, deacons)

#### Scenario: Niche-specific questions for HOA
- **WHEN** user selects "HOA" as community type
- **THEN** Studio SHALL ask about maintenance request tracking, document archive, voting features, and resident vs board roles

#### Scenario: Niche-specific questions for professional association
- **WHEN** user selects "association" as community type
- **THEN** Studio SHALL ask about company profiles in directory, committee structure, and membership tier naming

#### Scenario: AI feature preferences
- **WHEN** the interview reaches the AI features section
- **THEN** Studio SHALL ask which AI features to enable: content moderation, auto-translation, newsletter generation, member insights, smart onboarding

### Requirement: Spec generation from interview

The Studio skill SHALL generate a `studio-spec.json` from the interview answers containing: `brand` (name, tagline, colors, fonts, languages), `features` (boolean flags for each feature), `tiers` (membership tier definitions), `customFields` (community-specific member attributes), `homepage` (section layout and content), `niche` (selected niche identifier for seed variant selection). The spec SHALL be presented to the user for review before building.

#### Scenario: Spec generation and review
- **WHEN** the interview is complete
- **THEN** Studio SHALL generate a spec, display it as a readable summary, and ask the user to confirm or request changes

#### Scenario: User requests spec modifications
- **WHEN** the user requests changes to the generated spec (e.g., "add a prayer request form")
- **THEN** Studio SHALL update the spec accordingly and present the revised version for confirmation

### Requirement: Automated build and deploy

The Studio skill SHALL execute the build pipeline: apply brand.json from spec, select and apply the appropriate niche seed variant, generate translations for configured languages via AI API, configure feature flags, deploy via Run402 CLI (`npx tsx deploy.ts`), and claim the subdomain.

#### Scenario: Successful build and deploy
- **WHEN** the user confirms the spec
- **THEN** Studio SHALL apply all configurations, deploy to Run402, report the live URL, and prompt the user to sign up as the first admin

#### Scenario: Translation generation
- **WHEN** the spec includes multiple languages
- **THEN** Studio SHALL call the AI API to generate translation strings for each additional language and write them to `site/custom/strings/{lang}.json`

#### Scenario: Deploy failure
- **WHEN** the Run402 deploy command fails
- **THEN** Studio SHALL report the error, suggest remediation steps, and offer to retry

### Requirement: Chrome verification

After deployment, Studio SHALL open the deployed site in Chrome, navigate to each major page (home, directory, events, resources, forum, admin), and verify that each page loads without errors. Verification results SHALL be reported to the user.

#### Scenario: All pages pass verification
- **WHEN** Chrome verification completes and all pages load successfully
- **THEN** Studio SHALL report success with a summary of pages verified

#### Scenario: Page fails verification
- **WHEN** a page fails to load or shows errors during Chrome verification
- **THEN** Studio SHALL report which page failed, what error was observed, and attempt to diagnose and fix the issue

### Requirement: Premium build features

The premium build ($29) SHALL include all standard build features plus: website investigation with content migration, AI-generated translations for up to 3 additional languages, custom homepage section design, niche-specific customizations, and a Chrome verification walkthrough with GIF recording.

#### Scenario: Premium build with GIF recording
- **WHEN** a premium build completes Chrome verification
- **THEN** Studio SHALL record a GIF of the verification walkthrough and save it for the user
