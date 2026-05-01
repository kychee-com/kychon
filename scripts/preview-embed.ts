// Preview the new barrio-unido iframe embed block — minimal isolated page
// rendering just the embed-block HTML for visual verification.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderBlock, type BlockRenderContext, type Section } from '../src/lib/blocks';
import { buildCspValue } from '../src/lib/csp';
import { getActiveProjectSeed } from '../src/seeds';

const DIST = join(process.cwd(), 'dist');

const seed = await getActiveProjectSeed();
const sections = seed.sections as unknown as Section[];

const embedSection = sections.find(
  (s) => s.zone === 'main' && s.section_type === 'embed',
);
if (!embedSection) throw new Error('No embed section in active seed');

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'es',
  authenticated: false,
  role: null,
  isFeatureEnabled: () => true,
  currentPath: '/',
  siteName: 'Centro Comunitario Barrio Unido',
  logoUrl: '/assets/logo.png',
};

const visitorHtml = renderBlock(embedSection, { ...ctx, admin: false });
const adminHtml = renderBlock(embedSection, { ...ctx, admin: true, role: 'admin' });

const csp = buildCspValue();

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>Embed preview — barrio-unido iframe</title>
  <link rel="stylesheet" href="/css/theme.css">
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="stylesheet" href="/css/admin-editing.css">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      background: #f3f4f6;
    }
    .preview-banner {
      background: #fef3c7; border-bottom: 2px solid #fbbf24;
      padding: 0.6rem 1rem; font-size: 0.9rem; color: #78350f;
      text-align: center;
    }
    .preview-section-label {
      max-width: 72rem; margin: 1.5rem auto 0.5rem; padding: 0 1rem;
      font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em;
      text-transform: uppercase; color: #6b7280;
    }
    .section { opacity: 1 !important; transform: none !important; }
    .container { max-width: 72rem; margin: 0 auto; padding: 0 1rem; }
    body.admin .admin-section-actions { display: flex !important; opacity: 1 !important; }
  </style>
</head>
<body class="admin">
  <div class="preview-banner">
    Generic iframe block on barrio-unido — provider: <code>${(embedSection.config as any).provider}</code>, src: <code>${(embedSection.config as any).params?.src ?? '(provider-built)'}</code>
  </div>

  <div class="preview-section-label">Admin view (renders the External content pill)</div>
  ${adminHtml}

  <div class="preview-section-label">Visitor view (no External content pill)</div>
  ${visitorHtml}
</body>
</html>`;

writeFileSync(join(DIST, 'embed-preview.html'), html);
console.log('Wrote dist/embed-preview.html');
