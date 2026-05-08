import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const portalSource = readFileSync(join(import.meta.dirname, '../../src/layouts/Portal.astro'), 'utf-8');
const buildIdTemplate = '$' + '{BUILD_ID}';

describe('Portal asset URLs', () => {
  it('versions every chrome-critical stylesheet with BUILD_ID', () => {
    const stylesheets = ['theme.css', 'nav-dropdown.css', 'zone-grid.css', 'a11y.css'];

    for (const file of stylesheets) {
      expect(portalSource).toContain(`/css/${file}?b=`);
      expect(portalSource).toContain(buildIdTemplate);
    }
  });

  it('bundles owned public styles through the Astro/Tailwind entrypoint', () => {
    expect(portalSource).toContain("import '../styles/globals.css'");
    expect(portalSource).not.toContain('/css/styles.css?b=');
  });

  it('versions env.js with BUILD_ID', () => {
    expect(portalSource).toContain('/js/env.js?b=');
    expect(portalSource).toContain(buildIdTemplate);
  });

  it('exposes BUILD_ID to client cache logic', () => {
    expect(portalSource).toContain("import { KYCHON_BUILD_ID } from '../lib/build-id'");
    expect(portalSource).toContain('const BUILD_ID = KYCHON_BUILD_ID');
    expect(portalSource).toContain('define:vars={{ BUILD_ID }}');
    expect(portalSource).toContain('__KYCHON_BUILD_ID');
  });

  it('keeps chrome hydration owned by the layout including config changes', () => {
    expect(portalSource).toContain("import { hydratePage, currentPageSlug } from '../lib/page-render'");
    expect(portalSource).toContain('hydratePage(currentPageSlug())');
    expect(portalSource).toContain("document.addEventListener('wl-config-changed', hydrateChrome)");
  });
});
