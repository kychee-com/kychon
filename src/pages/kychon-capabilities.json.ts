import { buildCapabilityManifest } from '../lib/capability-api/discovery.js';
import { listPortPatterns } from '../lib/port-patterns.js';

export const prerender = true;

export function GET() {
  // Compose at the page level so the API/discovery layer stays decoupled from
  // the block module. `portPatterns` lets the copy-website porter (and any
  // agent) see which copied-site patterns have first-class blocks. (#99/#91/#123/#124)
  const manifest = { ...buildCapabilityManifest(), portPatterns: listPortPatterns() };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
