// Local-only static render of the silver-pines showcase page. Pulls the seed
// directly via getActiveProjectSeed() and calls renderBlock() exactly the way
// page-render.ts would after hydrate. Writes a single HTML file we can open
// in the browser without depending on the live demo's deploy state.
//
// Usage:
//   KYCHON_PROJECT=silver-pines npx tsx scripts/_render-showcase.ts > /tmp/showcase.html
//
// The output is a self-contained HTML page that links to the local CSS/JS
// from `dist/` and loads the new block-types styles. No API calls, so it
// shows the static markup faithfully but `events_list` (dynamic) and
// `link_list` resources mode render as their hydration skeletons.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import { getActiveProjectSeed } from '../src/seeds/index.js';
import { renderBlock, type BlockRenderContext, type Section } from '../src/lib/blocks.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
  isFeatureEnabled: () => true,
  currentPath: '/page.html?slug=showcase',
  siteName: 'Silver Pines Senior Center',
  logoUrl: '/assets/logo.png',
};

async function main(): Promise<void> {
  const seed = await getActiveProjectSeed();
  const all = seed.sections as unknown as Section[];

  const headerBlocks = all
    .filter((s) => s.zone === 'header' && (s.scope === 'global' || s.page_slug === 'showcase') && s.visible !== false)
    .sort((a, b) => a.position - b.position);
  const footerBlocks = all
    .filter((s) => s.zone === 'footer' && s.scope === 'global' && s.visible !== false)
    .sort((a, b) => a.position - b.position);
  const showcaseMain = all
    .filter((s) => s.zone === 'main' && s.page_slug === 'showcase' && s.visible !== false)
    .sort((a, b) => a.position - b.position);

  const headerHtml = headerBlocks.map((s) => renderBlock(s, ctx)).join('');
  const footerHtml = footerBlocks.map((s) => renderBlock(s, ctx)).join('');
  const mainHtml = showcaseMain.map((s) => renderBlock(s, ctx)).join('');

  const themeCss = readFileSync(join(ROOT, 'public/css/theme.css'), 'utf-8');
  const stylesCss = readFileSync(join(ROOT, 'public/css/styles.css'), 'utf-8');
  const a11yCss = readFileSync(join(ROOT, 'public/css/a11y.css'), 'utf-8');
  const slideshowJs = readFileSync(join(ROOT, 'src/lib/blocks/slideshow.ts'), 'utf-8');

  // Inject silver-pines theme overrides (matches what ConfigProvider does at runtime).
  const sp = (seed.site_config as Record<string, any>).theme?.value || {};
  const themeOverride = `:root { --color-primary: ${sp.primary || '#5B7F5E'}; --color-primary-hover: ${sp.primary_hover || '#4A6B4D'}; --color-bg: ${sp.bg || '#FFFDF7'}; --color-surface: ${sp.surface || '#F5F0E8'}; --color-text: ${sp.text || '#2C2C2C'}; --color-text-muted: ${sp.text_muted || '#5A5A5A'}; --color-border: ${sp.border || '#D5CFC4'}; --radius: ${sp.radius || '0.75rem'}; --max-width: ${sp.max_width || '68rem'}; }`;

  // Compile slideshow.ts on the fly using esbuild — it ships with vite, but
  // simpler: convert top-level types ourselves, ship as plain JS.
  // Easiest path: import from dist (already built).
  const slideshowJsPath = join(ROOT, 'dist/_astro');
  // Find the slideshow.*.js file
  const { readdirSync } = await import('node:fs');
  const slideshowFile = readdirSync(slideshowJsPath).find((f) => f.startsWith('slideshow.'));
  const slideshowBundled = slideshowFile
    ? readFileSync(join(slideshowJsPath, slideshowFile), 'utf-8')
    : '';

  // Render the page banner OUTSIDE the nav so its full-bleed CSS is not
  // constrained by .nav .container. The brand_header / nav / sign_in_bar
  // blocks (the genuine header chrome) stay inside the nav.
  const chromeHeaderBlocks = headerBlocks.filter((s) => s.section_type !== 'page_banner');
  const pageBannerBlocks = headerBlocks.filter((s) => s.section_type === 'page_banner');
  const chromeHtml = chromeHeaderBlocks.map((s) => renderBlock(s, ctx)).join('');
  const bannerHtml = pageBannerBlocks.map((s) => renderBlock(s, ctx)).join('');

  process.stdout.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Block Showcase — Silver Pines (local preview)</title>
  <style>${themeCss}\n${themeOverride}\n${stylesCss}\n${a11yCss}</style>
  <style>
    /* Local-preview shims */
    body { margin: 0; }
    .preview-label {
      max-width: var(--max-width);
      margin: 1.5rem auto 0.5rem;
      padding: 0 1rem;
      color: var(--color-text-muted);
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .preview-label code { font-family: ui-monospace, monospace; color: var(--color-primary); font-weight: 600; }
  </style>
</head>
<body>
  <nav class="nav" data-zone="header" aria-label="Primary navigation">
    <div class="container">${chromeHtml}</div>
  </nav>
  ${bannerHtml}
  <main class="page-content" id="main-content">
    <div class="container">
      <h1 id="page-title">Block Showcase — local preview</h1>
      <p style="color: var(--color-text-muted); margin-top: 0.5rem">
        Every block on this page is a <code>sections</code> row in the silver-pines seed.
        See <code>src/seeds/silver-pines.ts</code> (page_slug='showcase').
      </p>
    </div>
    <div id="sections" data-zone="main">${mainHtml}</div>
  </main>
  <footer class="footer" data-zone="footer" aria-label="Site footer">
    <div class="container">${footerHtml}</div>
  </footer>
  <script type="module">
    // Sections are opacity:0 by default in production CSS; the layout adds
    // .section-visible via IntersectionObserver. In this static preview we
    // surface every section immediately.
    document.querySelectorAll('.section').forEach(el => el.classList.add('section-visible'));
    ${slideshowBundled.replace(/export\s*\{[^}]*\}\s*;?/g, '')}
    document.querySelectorAll('[data-block-hydrate="slideshow"]').forEach((el) => initSlideshow(el));
  </script>
</body>
</html>
`);
}

main().catch((err) => {
  console.error('render-showcase failed:', err);
  process.exit(1);
});
