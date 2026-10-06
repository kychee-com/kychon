import { adminDb } from '@run402/functions';
import { buildWellKnownKychon } from '../../lib/capability-api/discovery.js';
import packageJson from '../../../package.json';

// Server-rendered so `connector.enabled` follows the admin switch
// (site_config.feature_ai_connector) without a rebuild.
export const prerender = false;

async function connectorEnabled(): Promise<boolean> {
  try {
    const rows = await adminDb().from('site_config').select('value').eq('key', 'feature_ai_connector').limit(1);
    const value = rows?.[0]?.value;
    return value !== false && value !== 'false';
  } catch {
    return true;
  }
}

export async function GET({ url }: { url: URL }) {
  const portalUrl = process.env.KYCHON_PUBLIC_URL || url.origin;
  const engineVersion = process.env.KYCHON_ENGINE_VERSION || packageJson.version;
  const body = buildWellKnownKychon({ portalUrl, engineVersion, connectorEnabled: await connectorEnabled() });
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
