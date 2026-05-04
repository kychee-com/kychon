# First-Byte Chrome Snapshots

Kychon can bake first-paint chrome from a JSON snapshot instead of a typed
`src/seeds/<project>.ts` module. This is for ports produced by automation,
where the project-specific database seed exists but the engine should not need
a one-off TypeScript seed just to avoid showing demo chrome before hydration.

Set `KYCHON_CHROME_SNAPSHOT` to an absolute path, or pass `chromeSnapshot` to
`runDeploy()`. The snapshot takes precedence over `KYCHON_PROJECT`.

```json
{
  "site_config": {
    "site_name": "Old Dominion Boat Club",
    "brand_text": "Old Dominion Boat Club",
    "brand_text_short": "ODBC",
    "brand_icon_url": "",
    "brand_wordmark_url": "",
    "favicon_url": "/favicon.svg",
    "theme": {
      "primary": "#0B2742",
      "font_heading": "Playfair Display",
      "font_body": "Source Sans 3"
    }
  },
  "sections": [
    {
      "page_slug": "*",
      "zone": "header",
      "scope": "global",
      "section_type": "brand_header",
      "config": { "href": "/" },
      "position": 1,
      "visible": true
    }
  ]
}
```

The shape intentionally mirrors `ProjectSeed`: `site_config` may use either
plain JSON values or `{ "value": ..., "category": ... }` entries, and
`sections` uses the same block configs as the database seed. First-byte chrome
usually needs only global header/footer blocks plus the brand, favicon, theme,
and font config.

Resolution order:

1. `KYCHON_CHROME_SNAPSHOT` JSON.
2. A typed seed selected by `KYCHON_PROJECT`.
3. A neutral fallback shell for unknown project names.

The neutral fallback is deliberately sparse. It prevents a hosted port from
showing another project's brand when no snapshot is available. Runtime
hydration still fetches live `site_config` and `sections` from the database and
revalidates the baked chrome after first paint.
