import { describe, expect, it } from 'vitest';
import { PROVIDERS } from '../../src/lib/blocks/embed-providers.ts';
import { generateHeadersContent, validateCsp } from '../../src/lib/csp.ts';

describe('validateCsp — happy path', () => {
  it('accepts the generated headers content', () => {
    expect(() => validateCsp(generateHeadersContent())).not.toThrow();
  });
});

describe('validateCsp — missing pieces', () => {
  it('throws on unsubstituted placeholder', () => {
    const tpl = generateHeadersContent().replace('https:', '{PROVIDER_HOSTS}');
    expect(() => validateCsp(tpl)).toThrow(/PROVIDER_HOSTS.*not substituted/);
  });

  it('throws when X-Content-Type-Options is missing', () => {
    const headers = generateHeadersContent().replace('X-Content-Type-Options: nosniff', '');
    expect(() => validateCsp(headers)).toThrow(/X-Content-Type-Options/);
  });

  it('throws when X-Frame-Options is missing', () => {
    const headers = generateHeadersContent().replace('X-Frame-Options: SAMEORIGIN', '');
    expect(() => validateCsp(headers)).toThrow(/X-Frame-Options/);
  });

  it('throws when Referrer-Policy is missing', () => {
    const headers = generateHeadersContent().replace('Referrer-Policy: strict-origin-when-cross-origin', '');
    expect(() => validateCsp(headers)).toThrow(/Referrer-Policy/);
  });

  it('throws when Permissions-Policy is missing', () => {
    const headers = generateHeadersContent().replace(
      'Permissions-Policy: camera=(), microphone=(), geolocation=()',
      '',
    );
    expect(() => validateCsp(headers)).toThrow(/Permissions-Policy/);
  });

  it('throws when CSP is missing entirely', () => {
    const csp = generateHeadersContent().match(/Content-Security-Policy: [^\n]+/)![0];
    const headers = generateHeadersContent().replace(csp, '');
    expect(() => validateCsp(headers)).toThrow(/Content-Security-Policy/);
  });

  it('throws when frame-src directive is missing', () => {
    const headers = generateHeadersContent().replace(/; frame-src [^;]+/, '');
    expect(() => validateCsp(headers)).toThrow(/frame-src/);
  });

  it('throws when default-src directive is missing', () => {
    const headers = generateHeadersContent().replace(/default-src [^;]+; /, '');
    expect(() => validateCsp(headers)).toThrow(/default-src/);
  });
});

describe('validateCsp — dangerous patterns', () => {
  it("throws on 'unsafe-eval'", () => {
    const headers = generateHeadersContent().replace("'unsafe-inline'", "'unsafe-inline' 'unsafe-eval'");
    expect(() => validateCsp(headers)).toThrow(/unsafe-eval/);
  });

  it('throws on bare * in default-src', () => {
    const headers = generateHeadersContent().replace("default-src 'self'", 'default-src *');
    expect(() => validateCsp(headers)).toThrow(/wildcard.*default-src/);
  });

  it('throws on bare * in connect-src', () => {
    const headers = generateHeadersContent().replace(/connect-src [^;\n\r]+/, 'connect-src *');
    expect(() => validateCsp(headers)).toThrow(/wildcard.*connect-src/);
  });

  it('throws on bare * in frame-src', () => {
    const headers = generateHeadersContent().replace(/frame-src [^;\n\r]+/, 'frame-src *');
    expect(() => validateCsp(headers)).toThrow(/wildcard.*frame-src/);
  });
});

describe('validateCsp — provider host coverage', () => {
  it('throws when a provider host is removed from frame-src', () => {
    const youtubeHost = PROVIDERS.youtube!.frameAncestor;
    const headers = generateHeadersContent().replace(youtubeHost, '');
    expect(() => validateCsp(headers)).toThrow(/youtube.*frame-src/);
  });

  it('lists every provider in frame-src after generation', () => {
    const headers = generateHeadersContent();
    for (const provider of Object.values(PROVIDERS)) {
      expect(headers, `provider ${provider.id}`).toContain(provider.frameAncestor);
    }
  });
});
