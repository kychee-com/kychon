import { buildLlmsTxt } from '../lib/capability-api/discovery.js';

export const prerender = true;

export function GET({ url }: { url: URL }) {
  const portalUrl = process.env.KYCHON_PUBLIC_URL || url.origin;
  return new Response(buildLlmsTxt({ portalUrl }), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
