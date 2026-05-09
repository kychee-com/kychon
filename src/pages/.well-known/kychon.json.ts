import { buildWellKnownKychon } from '../../lib/capability-api/discovery.js';

export const prerender = true;

export function GET({ url }: { url: URL }) {
  const portalUrl = process.env.KYCHON_PUBLIC_URL || url.origin;
  return new Response(JSON.stringify(buildWellKnownKychon({ portalUrl }), null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
