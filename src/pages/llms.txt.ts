import { buildLlmsTxt } from '../lib/capability-api/discovery.js';
import { seedValue } from '../lib/chrome-bake';
import { SEO_NOINDEX_KEY, UNLISTED_LLMS_TXT, isSeoNoindex } from '../lib/seo';
import { ssrConfigValue } from '../lib/ssr-api';
import { resolveActiveProjectSeed } from '../seeds';

// Server-rendered so every link names the host the agent asked: a portal
// reached through a new subdomain (temp-host cut-over, custom domain) never
// advertises the host it was built under (kychon#222). Per request also means
// an unlisted portal (`site_config.seo_noindex`, kychon#189) stops advertising
// itself as soon as an admin flips the switch.
export const prerender = false;

export async function GET({ url }: { url: URL }) {
  const live = await ssrConfigValue({ key: SEO_NOINDEX_KEY, host: url.host });
  // null = no row or the read failed: fall back to the baked seed's value.
  if (isSeoNoindex(live ?? seedValue((await resolveActiveProjectSeed()).seed, SEO_NOINDEX_KEY))) {
    return new Response(UNLISTED_LLMS_TXT, {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return new Response(buildLlmsTxt({ portalUrl: url.origin }), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
