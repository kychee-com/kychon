// config-fields.ts — Single source of truth for the apply-mode of every
// `site_config` field the chrome/theme bake consumes (live-config-coherence).
//
// The north-star rule for agents is: "`site_config` is the live truth — write
// it, reload, see it." A field is `runtime` when an edit publishes on the next
// page load with NO rebuild (reconciled by src/lib/config.ts / page-render.ts);
// it is `redeploy` when it can only take effect through a build artifact
// (currently the pre-paint inline script for color_scheme/motion).
//
// This module is dependency-free and isomorphic so it can be imported by the
// browser runtime (config.ts), the build/deploy scripts (emits
// `/config-fields.json`), and the guard test that forbids undeclared
// baked-only fields. Keys use the bare `site_config` key, or a dotted
// `theme.<sub>` path for fields read out of the `theme` JSONB.

export type ApplyMode = 'runtime' | 'redeploy';

export interface ConfigFieldSpec {
  /** `site_config` key, or `theme.<sub>` for a field read from the theme JSONB. */
  readonly key: string;
  readonly applyMode: ApplyMode;
  /** Human-readable reason — surfaced to agents via `/config-fields.json`. */
  readonly reason: string;
}

// Every chrome/theme `site_config` field the bake consumes
// (src/lib/chrome-bake.ts) MUST appear here, or the guard test fails. Adding a
// new baked read without a declaration is exactly the silent-no-op class this
// registry exists to prevent.
export const CONFIG_FIELD_REGISTRY: readonly ConfigFieldSpec[] = [
  // --- Branding (reconciled live by applyBranding + page-render brand_header) ---
  { key: 'site_name', applyMode: 'runtime', reason: 'Applied live via applyBranding (document.title) and the brand_header block re-render.' },
  { key: 'brand_text', applyMode: 'runtime', reason: 'Applied live via applyBranding and the brand_header block re-render.' },
  { key: 'brand_text_short', applyMode: 'runtime', reason: 'Read live by the brand_header block on every page render.' },
  { key: 'brand_icon_url', applyMode: 'runtime', reason: 'Applied live via applyBranding (favicon) and the brand_header block re-render.' },
  { key: 'brand_wordmark_url', applyMode: 'runtime', reason: 'Read live by the brand_header block on every page render.' },
  { key: 'favicon_url', applyMode: 'runtime', reason: 'Applied live via applyBranding on every config load.' },

  // --- Custom CSS (live-config-coherence fix: applyCustomCss) ---
  { key: 'custom_css', applyMode: 'runtime', reason: 'Applied live into <style id="wl-custom-css"> by applyCustomCss on every config load.' },

  // --- Theme (tokens reconciled live by applyTheme) ---
  { key: 'theme', applyMode: 'runtime', reason: 'Theme tokens (colors, radius, max_width, nav/footer/social maps) applied live via applyTheme CSS custom properties.' },
  { key: 'theme.font_heading', applyMode: 'runtime', reason: 'applyTheme sets --font-heading and ensures the web-font <link> at runtime; live font changes load on reload.' },
  { key: 'theme.font_body', applyMode: 'runtime', reason: 'applyTheme sets --font-body and ensures the web-font <link> at runtime; live font changes load on reload.' },
  { key: 'theme.color_scheme', applyMode: 'redeploy', reason: 'Pinned light/dark must be inlined before first paint (flash prevention); the value is not available pre-paint without a build artifact. Requires a redeploy.' },
  { key: 'theme.motion', applyMode: 'redeploy', reason: 'Read by the pre-paint inline script that sets data-motion before first paint; requires a redeploy to change.' },
];

const REGISTRY_BY_KEY: ReadonlyMap<string, ConfigFieldSpec> = new Map(
  CONFIG_FIELD_REGISTRY.map((f) => [f.key, f]),
);

export function getFieldMode(key: string): ApplyMode | null {
  return REGISTRY_BY_KEY.get(key)?.applyMode ?? null;
}

export function isRegisteredField(key: string): boolean {
  return REGISTRY_BY_KEY.has(key);
}

export function runtimeFields(): ConfigFieldSpec[] {
  return CONFIG_FIELD_REGISTRY.filter((f) => f.applyMode === 'runtime');
}

export function redeployFields(): ConfigFieldSpec[] {
  return CONFIG_FIELD_REGISTRY.filter((f) => f.applyMode === 'redeploy');
}

/** All declared keys (top-level and `theme.<sub>` paths). */
export function registeredKeys(): string[] {
  return CONFIG_FIELD_REGISTRY.map((f) => f.key);
}

// Stable, agent-facing projection emitted to `dist/config-fields.json` at
// deploy time and reflected in the agent docs. Generated from the registry —
// never hand-authored — so the queryable surface cannot drift from the source.
export function configFieldsManifest(): {
  version: 1;
  fields: ConfigFieldSpec[];
} {
  return {
    version: 1,
    fields: CONFIG_FIELD_REGISTRY.map((f) => ({ ...f })),
  };
}

export function configFieldsJson(): string {
  return `${JSON.stringify(configFieldsManifest(), null, 2)}\n`;
}
