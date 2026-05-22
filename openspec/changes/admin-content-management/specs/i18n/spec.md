## ADDED Requirements

### Requirement: Render path resolves locale from `ctx.locale` / `ctx.defaultLocale` (Run402 v2.5+ routed-locale-context)

The Kychon render path SHALL read the active locale and default locale from `ctx.locale` and `ctx.defaultLocale` populated by the Run402 gateway (v2.5+ routed-locale-context, surfaced via `x-run402-locale` / `x-run402-default-locale` request headers and the `@run402/functions` getter helpers). The render path SHALL NOT sniff `Accept-Language` headers, parse cookies directly, or compute locale from any other source.

The deploy SHALL declare a 50-entry `LOCALE_POOL` constant as `spec.i18n.locales` so the gateway accepts any of the pre-allocated locale tags (kitchen-sink pattern — see design.md Decision 9). `defaultLocale` SHALL be one of the pool entries. The deploy SHALL also set `spec.i18n.unknownLocalePolicy: 'pass-through'` so cookie/Accept-Language values outside the pool are returned as `ctx.locale` verbatim instead of falling back to `defaultLocale` (closes `run402-private#413`).

#### Scenario: Render path reads ctx.locale instead of sniffing headers
- **WHEN** `page-render.ts` (or any routed function) needs to know the active locale
- **THEN** it reads from `ctx.locale` and `ctx.defaultLocale` (or the equivalent `getRole`-style helper in `@run402/functions`)
- **AND** it does not parse `Accept-Language` or `Cookie` headers directly

#### Scenario: Gateway accepts any LOCALE_POOL entry via cookie
- **WHEN** a visitor sends `Cookie: wl_locale=fr` and `'fr'` is in the deployed `LOCALE_POOL`
- **THEN** the gateway resolves `ctx.locale = 'fr'`
- **AND** the render path receives `'fr'` regardless of whether `'fr'` is enabled in `site_config.languages_enabled`

#### Scenario: Out-of-pool cookie passes through via unknownLocalePolicy
- **WHEN** a visitor sends `Cookie: wl_locale=haw` (Hawaiian, not in the 50-entry `LOCALE_POOL`)
- **THEN** the gateway returns `ctx.locale = 'haw'` verbatim (because `spec.i18n.unknownLocalePolicy: 'pass-through'` is set)
- **AND** the render path's dual-condition check (locale enabled in `languages_enabled`) still applies — so a portal that hasn't enabled Hawaiian still renders default-locale content for that visitor
- **AND** a portal that DOES enable Hawaiian renders Hawaiian translations from `section_translations` without a redeploy of `spec.i18n.locales`

### Requirement: Translation JOIN fires only when locale differs from default AND is enabled in site_config

When `page-render.ts` fetches sections for a page, the LEFT JOIN on `section_translations` SHALL be applied when BOTH conditions hold:

1. `ctx.locale !== ctx.defaultLocale` (there's a non-default locale to translate to), AND
2. `ctx.locale ∈ site_config.languages_enabled` (the admin has enabled this locale for the portal)

If either condition fails, the renderer SHALL NOT JOIN `section_translations` and SHALL use the base `sections.config` directly. The merged config (when JOIN runs) SHALL be `deepMerge(section.config, translation.config)`.

This dual check exists because the kitchen-sink pool (see Decision 9) means the gateway accepts 50 locales but the admin has only enabled a subset for the portal — a French-cookie visitor on a portal where French is not enabled MUST see default-locale content.

#### Scenario: Enabled non-default locale triggers the JOIN
- **WHEN** a page is rendered with `ctx.locale = 'es'`, `ctx.defaultLocale = 'en'`, and `site_config.languages_enabled = ['en', 'es']`
- **THEN** the sections query includes a LEFT JOIN on `section_translations` filtered to `language = 'es'`

#### Scenario: Default locale skips the JOIN
- **WHEN** a page is rendered with `ctx.locale === ctx.defaultLocale`
- **THEN** the sections query does not join `section_translations`
- **AND** base `sections.config` values are passed directly to `renderBlock()`

#### Scenario: Un-enabled locale skips the JOIN (admin disabled the locale)
- **WHEN** a page is rendered with `ctx.locale = 'fr'`, `ctx.defaultLocale = 'en'`, and `site_config.languages_enabled = ['en', 'es']` (French is in the gateway's LOCALE_POOL but NOT enabled in this portal)
- **THEN** the sections query does not join `section_translations`
- **AND** the renderer uses base `sections.config` (visitor sees default-locale content even though their cookie said `fr`)

#### Scenario: Deep-merge preserves untranslated fields from base config
- **WHEN** a translation config has `{ "heading": "Bienvenidos" }` and the base config has `{ "heading": "Welcome", "bg_image": "/hero.jpg", "cta_href": "/join" }`
- **THEN** the merged config passed to `renderBlock()` is `{ "heading": "Bienvenidos", "bg_image": "/hero.jpg", "cta_href": "/join" }`

#### Scenario: Re-enabling a previously-disabled locale resumes the JOIN with existing rows
- **WHEN** an admin re-adds a locale to `site_config.languages_enabled` that was previously enabled and had `section_translations` rows
- **THEN** the next page render with `ctx.locale = <that locale>` JOINs and renders those rows (translations were retained, not deleted, when the locale was disabled)
