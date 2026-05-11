## 1. Route Model And Dependencies

- [x] 1.1 Upgrade Run402 SDK usage to v1.66.0 in package manifests and lockfiles so static route targets are available to TypeScript.
- [x] 1.2 Add a shared clean-route module for safe slug validation, reserved route names, legacy URL canonicalization, and static route target generation.
- [x] 1.3 Add focused tests for clean-route helpers covering legacy page URLs, legacy module `.html` URLs, search query preservation, unsafe slugs, and reserved route collisions.

## 2. Static Build Output

- [x] 2.1 Update the static build/deploy preparation flow to materialize exact HTML files for safe seed-backed custom pages, such as `about.html` and `volunteer.html`.
- [x] 2.2 Ensure generated custom page files are created before Run402 file-set collection so they are included in deployed static assets.
- [x] 2.3 Verify legacy files such as `page.html`, `events.html`, `resources.html`, and `search.html` continue to be emitted unchanged.

## 3. Run402 Deploy Integration

- [x] 3.1 Generate Run402 `routes.replace` entries for standard module aliases including `/events`, `/resources`, `/forum`, `/polls`, `/committees`, and `/search`.
- [x] 3.2 Generate Run402 static route entries for each safe generated custom page alias, with `target.file` using the exact file name and no leading slash.
- [x] 3.3 Restrict generated static routes to `GET` and `HEAD`, and omit route entries for ordinary static files that do not need clean aliases.
- [x] 3.4 Add deploy logging or dry-run output that surfaces clean static route aliases and recommends `run402 deploy diagnose` for public URL checks.

## 4. Runtime URL Resolution

- [x] 4.1 Update custom page resolution so clean paths such as `/about` and `/volunteer` load the same schema-driven page content as `page.html?slug=about`.
- [x] 4.2 Preserve legacy query-based custom page resolution for existing bookmarks and inbound links.
- [x] 4.3 Update active-navigation matching so clean URLs and equivalent legacy URLs highlight the same navigation item.
- [x] 4.4 Prevent module routes such as `/events` and `/resources` from being claimed as generic custom page slugs.

## 5. Public Link Canonicalization

- [x] 5.1 Canonicalize Kychon-owned navigation, footer, CTA, and block hrefs from legacy `.html` and `page.html?slug=...` forms to clean route forms during rendering or seed normalization.
- [x] 5.2 Update seed data for Eagles and other bundled portals so generated navigation prefers clean routes.
- [x] 5.3 Leave external URLs, anchors, unsupported dynamic routes, and non-Kychon URLs unchanged.

## 6. Search Routes And Results

- [x] 6.1 Update site search form destinations so searches submit to `/search` while preserving query parameters.
- [x] 6.2 Update search result URL generation so page results use clean custom page aliases and module results use clean module aliases where available.
- [x] 6.3 Update Wild Apricot search mapping so imported search links target `/search` instead of `/search.html`.

## 7. Verification

- [x] 7.1 Add or update tests for deploy route generation, generated static page files, URL canonicalization, page resolution, navigation active state, and search result URLs.
- [x] 7.2 Run the relevant unit/typecheck/build verification for Kychon.
- [ ] 7.3 When deployed, diagnose representative public URLs with Run402 v1.66.0, including `/about`, `/volunteer`, `/events`, and `/search?q=hello&type=all`.
