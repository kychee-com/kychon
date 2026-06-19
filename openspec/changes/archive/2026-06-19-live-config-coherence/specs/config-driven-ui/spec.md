## ADDED Requirements

### Requirement: custom_css applied at runtime from live config

`src/lib/config.ts` SHALL read `custom_css` from `site_config` and inject it into a dedicated, stable `<style id="wl-custom-css">` element in the document head. The value SHALL be applied immediately from cached config on repeat visits, updated when freshly fetched config differs, and re-applied on the `wl-config-changed` revalidate. Live edits to `custom_css` SHALL take effect on the next page load without a rebuild. The build-time chrome `<style>` that carries baked `custom_css` SHALL use the same stable id so the runtime updater owns a single element.

#### Scenario: custom_css applied from cache on repeat visit

- **WHEN** a page loads with cached `site_config` containing a non-empty `custom_css`
- **THEN** `#wl-custom-css` contains that CSS

#### Scenario: Live custom_css edit publishes on reload

- **WHEN** `site_config.custom_css` is updated on a deployed project and the page is reloaded
- **THEN** `#wl-custom-css` contains the new CSS
- **AND** no rebuild or redeploy was required

#### Scenario: Cleared custom_css empties the style element

- **WHEN** freshly fetched `site_config` has an empty or removed `custom_css`
- **THEN** `#wl-custom-css` is emptied
- **AND** previously applied custom CSS no longer affects the page

### Requirement: Font stylesheet ensured at runtime from live config

When `applyTheme` runs, `src/lib/config.ts` SHALL ensure the web-font stylesheet for the live `theme.font_heading` / `theme.font_body` families exists in the document head, in addition to setting the `--font-heading` / `--font-body` CSS variables. When the live font family differs from the baked one, the corresponding font stylesheet `<link>` SHALL be present so the variable resolves to a loaded font rather than a fallback. The operation SHALL be idempotent across repeated applies and SHALL require no rebuild for a live font change to take effect on reload.

#### Scenario: Live font change loads the font on reload

- **WHEN** `site_config.theme.font_body` is changed to a non-system family and the page is reloaded
- **THEN** a font stylesheet `<link>` for that family is present in the head
- **AND** `--font-body` resolves to the loaded family with no rebuild

#### Scenario: Repeated applies do not duplicate the link

- **WHEN** `applyTheme` runs multiple times for the same font family (cache pass, fresh pass, revalidate)
- **THEN** only one font stylesheet `<link>` for that family exists in the head
