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
