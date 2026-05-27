// csp.ts — Build-time CSP generation. Source of truth is `public/_headers`
// (the file Run402 will honor once header config ships; today's static-asset
// serving doesn't apply it, so we also inject the CSP value as a meta tag in
// Portal.astro for browser enforcement). Both delivery surfaces read from the
// same template + provider registry, so the directive list never drifts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PROVIDERS, getProviderHosts } from './blocks/embed-providers.js';

const PLACEHOLDER = '{PROVIDER_HOSTS}';

/** Resolve the path of `public/_headers`. Defaults to `<cwd>/public/_headers`,
 *  which is correct for both `astro build` (cwd is repo root) and the deploy
 *  script (cwd is repo root). Tests can override via the optional argument. */
export function headersTemplatePath(cwd: string = process.cwd()): string {
  return join(cwd, 'public', '_headers');
}

/** Read the `public/_headers` template verbatim. Used by the deploy script
 *  and the CSP validator. */
export function readHeadersTemplate(cwd?: string): string {
  return readFileSync(headersTemplatePath(cwd), 'utf-8');
}

/** Build the CSP directive value from a pre-loaded template string. Pure
 *  function — no filesystem access. Use this from contexts where the
 *  template was loaded via Vite `?raw` import (e.g. `Portal.astro`, which
 *  needs to run at both build time AND inside the run402 SSR Lambda where
 *  `readFileSync('public/_headers')` would throw — the file isn't bundled
 *  into the SSR Lambda artifact). The pre-`?raw` shape (`buildCspValue`
 *  below) stays available for CLI deploy paths where `cwd` is the repo
 *  root and `public/_headers` is reachable on disk. */
export function buildCspValueFromTemplate(template: string): string {
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(
      `_headers template is missing the ${PLACEHOLDER} placeholder; expected it inside the frame-src directive`,
    );
  }
  const generated = substituteProviderHosts(template, getProviderHosts());
  const csp = extractCsp(generated);
  if (!csp) {
    throw new Error('_headers template does not declare a Content-Security-Policy directive');
  }
  return csp;
}

/** Substitute `{PROVIDER_HOSTS}` in a `_headers` template with the given
 *  hosts. When `hosts` is empty, the placeholder is replaced with `'none'`
 *  so the directive remains valid (and explicit) instead of malformed. */
export function substituteProviderHosts(template: string, hosts: string[]): string {
  const replacement = hosts.length > 0 ? hosts.join(' ') : "'none'";
  return template.replace(PLACEHOLDER, replacement);
}

/** Extract the `Content-Security-Policy` directive value from a generated
 *  `_headers` file content. Returns `null` if missing. */
export function extractCsp(headersContent: string): string | null {
  const match = headersContent.match(/Content-Security-Policy:\s*([^\n\r]+)/);
  if (!match || !match[1]) return null;
  return match[1].trim();
}

/** Build the CSP directive value used by both the meta tag and the
 *  `_headers` file. Reads the template and substitutes the registered
 *  provider hosts; throws if the template is missing or doesn't carry the
 *  placeholder. */
export function buildCspValue(cwd?: string): string {
  const tpl = readHeadersTemplate(cwd);
  if (!tpl.includes(PLACEHOLDER)) {
    throw new Error(
      `public/_headers is missing the ${PLACEHOLDER} placeholder; expected it inside the frame-src directive`,
    );
  }
  const generated = substituteProviderHosts(tpl, getProviderHosts());
  const csp = extractCsp(generated);
  if (!csp) {
    throw new Error('public/_headers does not declare a Content-Security-Policy directive');
  }
  return csp;
}

/** Generate the final `_headers` content with `{PROVIDER_HOSTS}` substituted.
 *  Emitted to `dist/_headers` by the deploy script so the bundle ships a
 *  fully-resolved file. */
export function generateHeadersContent(cwd?: string): string {
  const tpl = readHeadersTemplate(cwd);
  return substituteProviderHosts(tpl, getProviderHosts());
}

/** Required CSP directives. Every Kychon project ships these. */
const REQUIRED_DIRECTIVES = [
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'font-src',
  'frame-src',
  'connect-src',
] as const;

/** Required adjacent headers. */
const REQUIRED_HEADERS = [
  'X-Content-Type-Options:',
  'X-Frame-Options:',
  'Referrer-Policy:',
  'Permissions-Policy:',
] as const;

/**
 * Validate the generated `_headers` content. Throws with a clear, actionable
 * message on the first failure so the deploy aborts with a single fixable
 * problem at a time. Called by `scripts/deploy.ts` and in tests.
 *
 * Failure modes:
 * - Required CSP directive missing
 * - Required adjacent header missing
 * - `*` wildcard inside a critical directive (`default-src`, `connect-src`,
 *   `frame-src`)
 * - `'unsafe-eval'` anywhere in the CSP
 * - A registered provider's `frameAncestor` not present in `frame-src`
 * - Unsubstituted `{PROVIDER_HOSTS}` placeholder
 */
export function validateCsp(headersContent: string): void {
  if (headersContent.includes('{PROVIDER_HOSTS}')) {
    throw new Error(
      'CSP validation: {PROVIDER_HOSTS} placeholder was not substituted before deploy',
    );
  }

  for (const header of REQUIRED_HEADERS) {
    if (!headersContent.includes(header)) {
      throw new Error(`CSP validation: missing required header "${header}"`);
    }
  }

  const csp = extractCsp(headersContent);
  if (!csp) {
    throw new Error('CSP validation: missing Content-Security-Policy directive');
  }

  for (const directive of REQUIRED_DIRECTIVES) {
    const re = new RegExp(`(^|;\\s*)${directive}\\s`);
    if (!re.test(csp)) {
      throw new Error(`CSP validation: missing required CSP directive "${directive}"`);
    }
  }

  if (csp.includes("'unsafe-eval'")) {
    throw new Error("CSP validation: 'unsafe-eval' is not permitted in the CSP");
  }

  // Check for bare `*` wildcards in critical directives. We scan each
  // directive's source list for a token that is exactly `*`.
  for (const directive of ['default-src', 'connect-src', 'frame-src']) {
    const directiveRe = new RegExp(`${directive}\\s+([^;]+)`);
    const match = csp.match(directiveRe);
    if (!match || !match[1]) continue;
    const tokens = match[1].trim().split(/\s+/);
    if (tokens.includes('*')) {
      throw new Error(
        `CSP validation: bare \`*\` wildcard not permitted in "${directive}" directive`,
      );
    }
  }

  for (const provider of Object.values(PROVIDERS)) {
    if (!csp.includes(provider.frameAncestor)) {
      throw new Error(
        `CSP validation: provider "${provider.id}" requires frame-src ${provider.frameAncestor} but the generated CSP omits it`,
      );
    }
  }
}
