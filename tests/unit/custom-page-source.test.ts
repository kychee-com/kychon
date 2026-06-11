import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const pageRoute = readFileSync(join(root, 'src/pages/page.astro'), 'utf8');
const customPageRoute = readFileSync(join(root, 'src/pages/[customPage].astro'), 'utf8');
const app = readFileSync(join(root, 'src/components/kychon/CustomPageApp.tsx'), 'utf8');

describe('custom page source', () => {
  it('uses a shared React island instead of inline DOM scripting', () => {
    for (const source of [pageRoute, customPageRoute]) {
      expect(source).toMatch(/<CustomPageApp client:load(?: initialPage=\{buildPage\})? \/>/);
      expect(source).not.toContain('<script>');
      expect(source).not.toContain('ky-container');
      expect(source).not.toContain('id="page-title"');
      expect(source).not.toContain('id="page-content"');
    }
  });

  it('SSR-bakes the page body on clean-route custom pages (kychon#126)', () => {
    expect(customPageRoute).toContain('ensureBuildPagesLoaded');
    expect(customPageRoute).toContain('initialPage={buildPage}');
    expect(app).toContain('initialPage');
    // The island must not flash a skeleton over baked content.
    expect(app).toContain('setLoading(!initialPage)');
  });

  it('never downgrades baked content to not-found or error on refresh misses', () => {
    expect(app).toContain('if (!initialPage) setNotFound(true)');
    expect(app).toContain('keeping baked content');
  });

  it('keeps slug resolution, auth redirect, translations, and editor hooks', () => {
    expect(app).toContain('resolveCustomPageSlugFromLocation');
    expect(app).toContain('translateItems');
    expect(app).toContain('requires_auth');
    expect(app).toContain("window.location.assign('/')");
    expect(app).toContain('data-editable=');
    expect(app).toContain('data-editable-rich=');
  });

  it('sanitizes stored rich HTML and avoids manual DOM mutation helpers', () => {
    expect(app).toContain('sanitizeRichHtml');
    expect(app).toContain('dangerouslySetInnerHTML');
    expect(app).not.toContain('innerHTML =');
    expect(app).not.toContain('document.createElement');
    expect(app).not.toContain('querySelector');
  });
});
