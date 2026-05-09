import { buildWellKnownKychon } from '../../lib/capability-api/discovery.js';

export const prerender = true;

export function GET({ url }: { url: URL }) {
  return new Response(JSON.stringify(buildWellKnownKychon({ portalUrl: url.origin }), null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
