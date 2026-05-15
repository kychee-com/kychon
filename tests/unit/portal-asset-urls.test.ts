import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const portalSource = readFileSync(join(import.meta.dirname, '../../src/layouts/Portal.astro'), 'utf-8');
const globalsSource = readFileSync(join(import.meta.dirname, '../../src/styles/globals.css'), 'utf-8');

describe('Portal asset URLs', () => {
  it('keeps chrome-critical styles in the Astro/Vite import graph', () => {
    const stylesheets = ['theme.css', 'zone-grid.css', 'a11y.css'];

    expect(portalSource).toContain("import '../styles/globals.css'");
    for (const file of stylesheets) {
      expect(globalsSource).toContain(`@import "./${file}"`);
      expect(portalSource).not.toContain(`/css/${file}`);
    }
    expect(globalsSource).not.toContain('@import "./nav-dropdown.css"');
  });

  it('bundles owned public styles through the Astro/Tailwind entrypoint', () => {
    expect(portalSource).toContain("import '../styles/globals.css'");
    expect(portalSource).not.toContain('/css/styles.css?b=');
  });

  it('loads env.js from its stable runtime config URL', () => {
    expect(portalSource).toContain('src="/js/env.js"');
    expect(portalSource).not.toContain('/js/env.js?b=');
  });

  it('does not expose a generated build id in shared portal HTML', () => {
    expect(portalSource).not.toContain('BUILD_ID');
    expect(portalSource).not.toContain('build-id');
    expect(portalSource).not.toContain('__KYCHON_BUILD_ID');
    expect(portalSource).not.toContain('?b=');
  });

  it('keeps chrome hydration owned by the layout including config changes', () => {
    expect(portalSource).toContain("import { hydratePage, currentPageSlug } from '../lib/page-render'");
    expect(portalSource).toContain('hydratePage(currentPageSlug())');
    expect(portalSource).toContain("document.addEventListener('wl-config-changed', hydrateChrome)");
  });
});
