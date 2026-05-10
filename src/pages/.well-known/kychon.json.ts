import { buildWellKnownKychon } from '../../lib/capability-api/discovery.js';
import packageJson from '../../../package.json';

export const prerender = true;

export function GET({ url }: { url: URL }) {
  const portalUrl = process.env.KYCHON_PUBLIC_URL || url.origin;
  const engineVersion = process.env.KYCHON_ENGINE_VERSION || packageJson.version;
  return new Response(JSON.stringify(buildWellKnownKychon({ portalUrl, engineVersion }), null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
