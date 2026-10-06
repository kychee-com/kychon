import { resolveActiveProjectSeed } from '../seeds';
import { seedValue } from '../lib/chrome-bake';
import { SEO_NOINDEX_KEY, buildRobotsTxt, isSeoNoindex } from '../lib/seo';
import { ssrConfigValue } from '../lib/ssr-api';

// Per-request so an admin's `site_config.seo_noindex` toggle reaches crawlers
// without a redeploy (kychon#189). A port that stages its own
// `public/robots.txt` still wins: static files are served before SSR routes.
export const prerender = false;

export async function GET({ request }: { request: Request }) {
  const host = request.headers.get('host') ?? 'localhost';
  const live = await ssrConfigValue({ key: SEO_NOINDEX_KEY, host });
  // null = no row or the read failed: fall back to the baked seed's value.
  const noindex = isSeoNoindex(live ?? seedValue((await resolveActiveProjectSeed()).seed, SEO_NOINDEX_KEY));
  return new Response(buildRobotsTxt(noindex), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
