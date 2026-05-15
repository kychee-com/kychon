// @vitest-environment happy-dom
//
// Regression coverage for #23: stored XSS via the local esc() helpers.
//
// Two distinct sinks:
//   1. The legacy forum page and src/lib/block-hydrators.ts used a local `esc()`
//      helper based on
//      `textContent → innerHTML`, which escapes <, >, & but NOT " or '. When
//      the result is interpolated into a double-quoted attribute, an attacker
//      can break out of the attribute and inject event handlers (onmouseover,
//      onerror, ...).
//   2. `announcement.body` is interpolated raw into innerHTML, so any HTML
//      payload an admin (or AI feature) writes runs in every reader's browser.
//
// The fix is to (a) use the shared escAttr/escHtml from src/lib/blocks.ts in
// every attribute/text context (they escape quotes correctly), and (b)
// sanitize announcement bodies before assigning them to innerHTML.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { escAttr, escHtml } from '../../src/lib/blocks.ts';
import { sanitizeRichHtml } from '../../src/lib/sanitize-html.ts';

// happy-dom rebinds import.meta.url to a non-file scheme; resolve test paths
// against the repo root via process.cwd() instead.
const repoRoot = process.cwd();
const FORUM_PAGE = resolve(repoRoot, 'src/pages/forum.astro');
const FORUM_APP = resolve(repoRoot, 'src/components/kychon/ForumPageApp.tsx');
const BLOCK_HYDRATORS = resolve(repoRoot, 'src/lib/block-hydrators.ts');

// Reproduce the local `esc()` helper as defined in the affected files so the
// test pins the legacy (broken) behavior we are removing.
function legacyEsc(s: unknown): string {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

const QUOTE_BREAKOUT = '" onmouseover="alert(1)" x="';
const IMG_PAYLOAD = '<img src=x onerror="alert(1)">';

function attributesOf(html: string, selector: string): string[] {
  const host = document.createElement('div');
  host.innerHTML = html;
  const node = host.querySelector(selector);
  if (!node) throw new Error(`No node matched ${selector} in ${html}`);
  return Array.from(node.attributes).map((a) => a.name);
}

describe('bug #23 — esc() quote-escape XSS in attribute contexts', () => {
  it('escAttr/escHtml escape both " and \' so attribute interpolation is safe', () => {
    const escaped = escAttr(QUOTE_BREAKOUT);
    expect(escaped).not.toContain('"');
    expect(escaped).not.toContain("'");
    expect(escaped).toContain('&quot;');

    // The actual sink shape — data-translate-text="${escAttr(body)}".
    const html = `<div data-translate-text="${escaped}" data-ct="forum_topic">body</div>`;
    const attrs = attributesOf(html, 'div');
    expect(attrs).toEqual(['data-translate-text', 'data-ct']);
    expect(attrs).not.toContain('onmouseover');
  });

  it('forum route must not return to attribute-interpolated HTML rendering', async () => {
    const page = await readFile(FORUM_PAGE, 'utf8');
    const app = await readFile(FORUM_APP, 'utf8');
    // The former inline forum renderer interpolated escaped strings into HTML
    // attributes. The React island keeps text and attributes as values instead.
    expect(page).not.toMatch(/function esc\s*\(/);
    expect(page).not.toContain('innerHTML');
    expect(app).not.toMatch(/function esc\s*\(/);
    expect(app).not.toContain('innerHTML');
    expect(app).not.toContain('data-translate-text');
  });

  it('block-hydrators.ts must NOT redefine its own esc() helper', async () => {
    const source = await readFile(BLOCK_HYDRATORS, 'utf8');
    expect(source).not.toMatch(/function esc\s*\(/);
    expect(source).toMatch(/escAttr|escHtml/);
  });

  it('reproduces the unsafe behavior of the legacy esc() to lock in the regression', () => {
    // Sanity check that the original bug truly existed: legacyEsc leaves
    // quotes alone and so attribute breakout works.
    const escaped = legacyEsc(QUOTE_BREAKOUT);
    expect(escaped).toContain('"');
    const html = `<div data-translate-text="${escaped}" data-ct="forum_topic">body</div>`;
    const attrs = attributesOf(html, 'div');
    // The legacy helper would have caused onmouseover to land as a real
    // attribute. We don't want this to ever be re-introduced.
    expect(attrs).toContain('onmouseover');
  });
});

describe('bug #23 — announcement body raw innerHTML sink', () => {
  it('sanitizeRichHtml strips <script> and on*= event handlers from rich text', () => {
    const cleaned = sanitizeRichHtml(IMG_PAYLOAD);
    expect(cleaned.toLowerCase()).not.toContain('onerror');
    expect(cleaned.toLowerCase()).not.toContain('<script');

    const host = document.createElement('div');
    host.innerHTML = cleaned;
    const img = host.querySelector('img');
    if (img) {
      // <img> is allowed (Tiptap-style rich content), but never with on* attrs.
      const attrs = Array.from(img.attributes).map((a) => a.name.toLowerCase());
      for (const attr of attrs) expect(attr).not.toMatch(/^on/);
    }
  });

  it('sanitizeRichHtml drops script contents instead of rendering them as text', () => {
    const cleaned = sanitizeRichHtml('<p>Safe</p><script>window.__bad = true</script><style>.x{color:red}</style>');
    expect(cleaned).toContain('<p>Safe</p>');
    expect(cleaned).not.toContain('window.__bad');
    expect(cleaned).not.toContain('.x{color:red}');
  });

  it('sanitizeRichHtml allows safe Tiptap output (<p>, <strong>, links with safe href)', () => {
    const cleaned = sanitizeRichHtml('<p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>');
    expect(cleaned).toContain('<p>');
    expect(cleaned).toContain('<strong>');
    expect(cleaned).toContain('href="https://example.com"');
  });

  it('sanitizeRichHtml strips javascript: hrefs', () => {
    const cleaned = sanitizeRichHtml('<a href="javascript:alert(1)">click</a>');
    expect(cleaned.toLowerCase()).not.toContain('javascript:');
  });

  it('block-hydrators.ts must sanitize announcement bodies before innerHTML', async () => {
    const source = await readFile(BLOCK_HYDRATORS, 'utf8');
    // The announcement-body div must not interpolate `${a.body}` raw — it
    // must pass through sanitizeRichHtml.
    expect(source).not.toMatch(/data-editable-rich="announcements\.\$\{a\.id\}\.body">\$\{a\.body\}/);
    expect(source).toMatch(/sanitizeRichHtml/);
  });
});

// escHtml is the helper used elsewhere — keep it referenced so the import is
// not pruned by linters and so the test file documents the intended boundary.
escHtml(undefined);
