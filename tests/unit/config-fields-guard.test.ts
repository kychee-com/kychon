// Root-cause guard for live-config-coherence.
//
// The silent-no-op bug (#147) happened because `custom_css` was consumed by the
// chrome bake but never declared anywhere, so nothing reconciled it at runtime
// and no check noticed. This guard makes that class of mistake impossible: every
// `site_config` field the bake reads MUST be declared in src/lib/config-fields.ts
// as either `runtime` (reconciled live) or `redeploy` (build-only, with a reason).
// Adding a new baked read without declaring it turns this suite red — with a
// guided, next-action message, so the codebase teaches the next contributor.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONFIG_FIELD_REGISTRY,
  configFieldsJson,
  getFieldMode,
  isRegisteredField,
  redeployFields,
} from '../../src/lib/config-fields';

const root = join(import.meta.dirname, '../..');
const BAKE_PATH = 'src/lib/chrome-bake.ts';

// Extract the `site_config` keys the chrome bake consumes by scanning its
// source for literal seed reads. Brittleness here is intentional: it fails
// loudly the moment someone bakes a new field, which is the whole point.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (but not `://` in URLs)
}

function configKeysIn(rawSrc: string): Set<string> {
  const src = stripComments(rawSrc);
  const keys = new Set<string>();
  // Top-level reads: stringFromSeed(seed, 'x') / seedValue(seed, 'x').
  for (const m of src.matchAll(/(?:stringFromSeed|seedValue)\(seed,\s*'([^']+)'\)/g)) {
    keys.add(m[1]);
  }
  // Theme sub-field reads off the `themeFromSeed(seed)` result (named `theme`).
  for (const m of src.matchAll(/\btheme\.([a-z_]+)\b/g)) {
    keys.add(`theme.${m[1]}`);
  }
  return keys;
}

function configKeysConsumedByBake(): Set<string> {
  return configKeysIn(readFileSync(join(root, BAKE_PATH), 'utf-8'));
}

function undeclaredIn(src: string): string[] {
  return [...configKeysIn(src)].filter((k) => !isRegisteredField(k));
}

describe('config-fields registry guard', () => {
  it('declares every site_config field the chrome bake consumes', () => {
    const consumed = configKeysConsumedByBake();
    expect(consumed.size).toBeGreaterThan(0); // scan must actually find reads

    const undeclared = [...consumed].filter((k) => !isRegisteredField(k));
    expect(
      undeclared,
      undeclared.length === 0
        ? ''
        : `Undeclared site_config field(s) consumed by ${BAKE_PATH}: ${undeclared.join(', ')}. ` +
            `Each is baked into first-paint HTML with no declared apply-mode — the silent-no-op class from #147. ` +
            `Fix: add { key, applyMode: 'runtime' | 'redeploy', reason } to src/lib/config-fields.ts ` +
            `(use 'runtime' and wire a reconciler in src/lib/config.ts, or 'redeploy' with a reason if it can only take effect via a build artifact).`,
    ).toEqual([]);
  });

  it('gives every redeploy field a non-empty reason', () => {
    for (const f of redeployFields()) {
      expect(
        f.reason.trim().length,
        `redeploy field '${f.key}' must explain why a rebuild is required`,
      ).toBeGreaterThan(0);
    }
  });

  it('keeps the redeploy set limited to the irreducible pre-paint fields', () => {
    const redeploy = redeployFields()
      .map((f) => f.key)
      .sort();
    expect(redeploy).toEqual(['theme.color_scheme', 'theme.motion']);
  });

  it('declares custom_css and font families as runtime (the live-config-coherence fix)', () => {
    expect(getFieldMode('custom_css')).toBe('runtime');
    expect(getFieldMode('theme.font_heading')).toBe('runtime');
    expect(getFieldMode('theme.font_body')).toBe('runtime');
  });

  it('would catch a NEW baked-only field that nobody declared (regression guard)', () => {
    // Simulate a future commit that bakes a brand-new field without declaring it.
    const synthetic = "customCss: stringFromSeed(seed, 'totally_new_chrome_field'),";
    expect(undeclaredIn(synthetic)).toContain('totally_new_chrome_field');
    // And the real bake stays clean.
    expect(undeclaredIn(readFileSync(join(root, BAKE_PATH), 'utf-8'))).toEqual([]);
  });

  it('emits a queryable manifest that matches the typed registry exactly (no drift)', () => {
    const parsed = JSON.parse(configFieldsJson()) as {
      version: number;
      fields: { key: string; applyMode: string; reason: string }[];
    };
    expect(parsed.version).toBe(1);
    expect(parsed.fields).toEqual(
      CONFIG_FIELD_REGISTRY.map((f) => ({ key: f.key, applyMode: f.applyMode, reason: f.reason })),
    );
  });
});
