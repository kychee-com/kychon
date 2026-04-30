## Why

ODBC's source homepage embeds two third-party widgets: **ODBC WEATHER** (current Alexandria conditions + 5-day forecast) and **Alexandria Tide Charts** (NOAA tide data). Wild Apricot ships an "Embed Widget" element with a pre-allowlisted set of providers and provider-specific iframe URL builders. Kychon today has only the `default` section branch that renders raw `cfg.html` — works for `<iframe>` strings but with three failures:

1. No documented pattern. Every porter writes their own escape-hatch HTML.
2. No security boundary. Any admin could paste a malicious iframe; nothing stops them.
3. No responsive sizing. Common providers (weather, video) need aspect-ratio handling that raw HTML doesn't enforce.

Boat clubs need weather + tides. Senior centers need bus schedules + city maps. Churches need sermon-archive players. Every member-org site needs *some* embed, and the current "paste raw HTML" pattern is both insecure and visually inconsistent.

This change introduces a new `embed` block type with seven allowlisted providers, each with a known-good iframe URL builder and per-provider sandbox attributes, plus a generic `iframe` escape hatch with an explicit "I trust this source" admin gate. To make iframes safe, this proposal also lands a baseline Content Security Policy — the CSP work originally floated as a separate `csp-baseline` proposal is rolled in here because the embed block is the first feature that requires it.

Closes [#59 sections: new block_type 'embed'](https://github.com/kychee-com/kychon/issues/59).

## What Changes

- **New `embed` block type** in `src/lib/blocks.ts`. `dynamic: false` — the renderer emits the iframe HTML directly at bake/runtime; no fetch needed.
- **Provider registry** at `src/lib/blocks/embed-providers.ts`. Initial seven providers:

  | Provider | Embeds | Required params |
  |---|---|---|
  | `weather` | OpenWeather widget for a location | `location`, optional `units`, `days` |
  | `tide_chart` | NOAA Tides station chart | `station_id` (lookup helper from location) |
  | `map` | Google Maps embed | `address` OR `lat` + `lng` |
  | `youtube` | Video player | `video_id`, optional `start`, `autoplay` |
  | `vimeo` | Video player | `video_id` |
  | `calendly` | Booking widget | `username`, optional `event_type` |
  | `iframe` | Generic escape hatch | `src`, optional `sandbox` overrides |

- **Per-provider iframe builder.** Each provider exports `buildSrc(params)` that returns a fully-formed iframe URL. Renderer never accepts admin-pasted HTML — the URL is constructed server-side (or in the renderer at runtime) from typed params.
- **Per-provider sandbox attributes.** Each provider declares its `sandbox` allowlist. The generic `iframe` provider gets the strictest default (`sandbox="allow-scripts allow-same-origin"`); admins can opt into more if needed (with confirmation).
- **CSP baseline.** New `public/_headers` (Run402 static-asset header config) defines:
  ```
  Content-Security-Policy:
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' https: data:;
    font-src 'self' https://fonts.gstatic.com;
    frame-src https://embed.windy.com https://www.youtube.com https://player.vimeo.com
              https://calendly.com https://www.google.com https://api.tidesandcurrents.noaa.gov;
    connect-src 'self' https://*.run402.com;
  ```
  The frame-src list grows additively as providers are added. `'unsafe-inline'` for scripts is a v1 compromise; tightening to nonce-based or hash-based scripts is tracked separately. The intent here is to land a defense-in-depth baseline so the embed block isn't a free-for-all.
- **"I trust this source" admin gate** for the generic `iframe` provider. The block's edit popover renders a checkbox the admin must check before saving an `iframe`-provider block. The rendered admin UI shows a small "External content" pill on `iframe`-provider blocks; allowlisted providers don't carry this pill.
- **Responsive sizing.** Video providers (youtube, vimeo) use CSS `aspect-ratio: 16/9` with the iframe filling the container. Other providers use a fixed `height` from config (default 320px). `responsive: true` (default) enables fluid width.
- **Admin composer.** The embed block's edit popover surfaces the provider selector first; the params form below changes to match the selected provider's schema. Calendly's `username` is a text field; YouTube's `video_id` is a text field with a "paste a YouTube URL to extract ID" helper button.
- **Demo update.** silver-pines homepage gets a `weather` embed for the property's location. eagles homepage gets a `youtube` embed of a fictional fly-through video.
- **ODBC port re-validation.** After this change, re-running `/copy-website` against ODBC produces a homepage with weather + tide chart embeds rendered via the registered providers, not raw HTML.

## Capabilities

### New Capabilities

- `embed-security`: a baseline Content Security Policy is shipped with every Kychon project, scoped to allow-list-driven iframe embeds and conservative defaults for scripts, styles, fonts, and connect-src endpoints. The CSP grows additively as new providers are registered.

### Modified Capabilities

- `composable-layout`: extends the `BLOCK_TYPES` registry with the new `embed` block type. The block carries provider-routed rendering and a security gate for the generic iframe escape hatch.
- `deploy`: the deploy pipeline SHALL include the CSP `_headers` file in every deploy. The deploy script SHALL fail (with a clear error) if a deploy bundle is missing the headers file or has an invalid CSP directive.

## Impact

- **New files**: `src/lib/blocks/embed-providers.ts` (provider registry, ~250 LOC), `src/lib/blocks/embed.ts` (renderer + sandbox-attr handling), `public/_headers` (CSP + adjacent headers), `tests/embed-providers.test.ts`, `tests/csp-baseline.test.ts`.
- **Modified files**: `src/lib/blocks.ts` (register `embed` type via `embed.ts`), `src/components/AdminEditor.astro` (provider selector + dynamic params form + "trust source" gate), `scripts/deploy.ts` (include `_headers` in bundle; CSP-validity check), demo seeds for silver-pines and eagles.
- **Dependencies**: none new. CSP enforcement is browser-native; no helmet-style middleware needed (Run402 serves static + functions; CSP applies to static via `_headers`).
- **Bundle impact**: ~5-7kB JS for provider registry + renderer. CSP adds zero bytes to client (it's a header). `_headers` file is ~500 bytes.
- **CSP impact on existing pages**: any inline-script in current code paths must either move to external scripts OR be blanket-allowed via `'unsafe-inline'`. v1 ships with `'unsafe-inline'` for scripts to avoid breaking existing inline event handlers; tightening to nonce/hash is a follow-up.
- **Hard dep**: ships only after [composable-layout](../composable-layout/proposal.md) lands.
- **Soft dep**: independent of [block-types-catalog](../block-types-catalog/proposal.md) — embed-block can ship before, alongside, or after.
