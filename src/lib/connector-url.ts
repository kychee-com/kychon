// The AI connector URL people paste into ChatGPT or Claude: the portal's
// Run402 MCP endpoint. Run402-managed `*.run402.com` hosts refuse sign-in and
// send clients to their `*.run402.app` twin, so those map across; custom
// domains serve it themselves. Deploys compare this with the `urls.mcp` Run402
// reports, so a platform change shows up as a deploy warning.
export const CONNECTOR_PATH = '/_run402/mcp';

export function connectorMcpUrl(portalUrl: string): string {
  const url = new URL(portalUrl);
  if (url.hostname.endsWith('.run402.com')) url.hostname = url.hostname.replace(/\.run402\.com$/, '.run402.app');
  return `${url.protocol}//${url.host}${CONNECTOR_PATH}`;
}

/**
 * Deploy check: the URL Kychon shows for the release's Run402 site against the
 * `urls.mcp` Run402 reports. A message means Run402 changed its host rule.
 */
export function connectorUrlDrift(urls: Record<string, string | undefined>): string | null {
  if (!urls.mcp || !urls.site) return null;
  const expected = connectorMcpUrl(urls.site);
  if (expected === urls.mcp.replace(/\/+$/, '')) return null;
  return `AI connector URL drift: Kychon shows ${expected} for ${urls.site}, but Run402 reports ${urls.mcp}. Update src/lib/connector-url.ts.`;
}
