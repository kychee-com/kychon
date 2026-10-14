import { buildWellKnownKychon } from '../../lib/capability-api/discovery.js';
import { ssrConnectorEnabled } from '../../lib/ssr-db';
import packageJson from '../../../package.json';

// Server-rendered so `connector.enabled` follows the admin switch
// (site_config.feature_ai_connector) without a rebuild, and `portalUrl` names
// the host that was asked, never the one the release was built under — after a
// temp-host cut-over the build-time host is gone (kychon#222).
export const prerender = false;

export async function GET({ url }: { url: URL }) {
  const engineVersion = process.env.KYCHON_ENGINE_VERSION || packageJson.version;
  const body = buildWellKnownKychon({ portalUrl: url.origin, engineVersion, connectorEnabled: await ssrConnectorEnabled() });
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
