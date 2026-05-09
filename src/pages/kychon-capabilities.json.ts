import { buildCapabilityManifest } from '../lib/capability-api/discovery.js';

export const prerender = true;

export function GET() {
  return new Response(JSON.stringify(buildCapabilityManifest(), null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
