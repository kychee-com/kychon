import { buildLlmsTxt } from '../lib/capability-api/discovery.js';

export const prerender = true;

export function GET({ url }: { url: URL }) {
  return new Response(buildLlmsTxt({ portalUrl: url.origin }), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
