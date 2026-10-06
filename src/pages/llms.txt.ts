import { buildLlmsTxt } from '../lib/capability-api/discovery.js';

// Server-rendered so every link names the host the agent asked: a portal
// reached through a new subdomain (temp-host cut-over, custom domain) never
// advertises the host it was built under (kychon#222).
export const prerender = false;

export function GET({ url }: { url: URL }) {
  return new Response(buildLlmsTxt({ portalUrl: url.origin }), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
