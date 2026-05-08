import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildCspValue,
  extractCsp,
  generateHeadersContent,
  readHeadersTemplate,
  substituteProviderHosts,
} from '../../src/lib/csp.ts';

const REPO_ROOT = process.cwd();
const HEADERS_PATH = join(REPO_ROOT, 'public', '_headers');

describe('public/_headers template structure', () => {
  it('exists and is non-empty', () => {
    const raw = readFileSync(HEADERS_PATH, 'utf-8');
    expect(raw.length).toBeGreaterThan(0);
  });

  it('matches the directive set every Kychon project must ship', () => {
    const raw = readHeadersTemplate();
    const required = [
      'Content-Security-Policy:',
      'X-Content-Type-Options: nosniff',
      'X-Frame-Options: SAMEORIGIN',
      'Referrer-Policy: strict-origin-when-cross-origin',
      'Permissions-Policy: camera=(), microphone=(), geolocation=()',
    ];
    for (const directive of required) {
      expect(raw).toContain(directive);
    }
  });

  it('CSP carries the required directives', () => {
    const raw = readHeadersTemplate();
    const csp = extractCsp(raw);
    expect(csp).not.toBeNull();
    const directives = [
      "default-src 'self'",
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'frame-src',
      'connect-src',
    ];
    for (const directive of directives) {
      expect(csp).toContain(directive);
    }
  });

  it('CSP allows v1 unsafe-inline for scripts and styles (documented compromise)', () => {
    const raw = readHeadersTemplate();
    const csp = extractCsp(raw)!;
    expect(csp).toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
  });

  it('CSP allows the Google Fonts stylesheet and font files used by baked themes', () => {
    const raw = readHeadersTemplate();
    const csp = extractCsp(raw)!;
    expect(csp).toMatch(/style-src[^;]*https:\/\/fonts\.googleapis\.com/);
    expect(csp).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  });

  it('CSP forbids unsafe-eval and wildcards in critical directives', () => {
    const raw = readHeadersTemplate();
    const csp = extractCsp(raw)!;
    expect(csp).not.toContain("'unsafe-eval'");
    // No bare `*` token in critical directives.
    expect(csp).not.toMatch(/default-src[^;]*\s\*\s/);
    expect(csp).not.toMatch(/connect-src[^;]*\s\*\s/);
    expect(csp).not.toMatch(/frame-src[^;]*\s\*\s/);
  });

  it('frame-src placeholder is present in the template (substituted at deploy)', () => {
    const raw = readHeadersTemplate();
    expect(raw).toContain('{PROVIDER_HOSTS}');
  });
});

describe('substituteProviderHosts', () => {
  const tpl = 'frame-src {PROVIDER_HOSTS};';

  it("substitutes 'none' when no providers are registered", () => {
    expect(substituteProviderHosts(tpl, [])).toBe("frame-src 'none';");
  });

  it('joins multiple hosts with spaces', () => {
    expect(substituteProviderHosts(tpl, ['https://a.com', 'https://b.com'])).toBe(
      'frame-src https://a.com https://b.com;',
    );
  });
});

describe('buildCspValue / generateHeadersContent', () => {
  it('produces a CSP value with no placeholder remaining', () => {
    const csp = buildCspValue();
    expect(csp).not.toContain('{PROVIDER_HOSTS}');
    expect(csp).toContain("default-src 'self'");
  });

  it('produces full headers content with no placeholder remaining', () => {
    const headers = generateHeadersContent();
    expect(headers).not.toContain('{PROVIDER_HOSTS}');
    expect(headers).toContain('Content-Security-Policy:');
    expect(headers).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=()');
  });
});
