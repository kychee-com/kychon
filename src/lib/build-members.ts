/**
 * Build-time members + tiers loader for the `/directory` page.
 *
 * **Gated on the site's `directory_public` flag.** When false (the
 * default for member-gated portals — eagles, barrio in the demos), the
 * loader skips the fetch entirely: the anon-key fetch would either RLS-
 * gate to empty or, worse, surface auth-gated member data into the
 * public HTML. The directory React island falls back to its today
 * behavior (skeleton → sign-in gate → fetch on auth).
 *
 * **Requires `members.list` to allow anonymous when `directory_public=true`**
 * — a Kychon capability-layer fix landed alongside this module
 * (`src/lib/capability-api/operations.ts` + `query-handlers.ts`).
 * Without that fix the build-time fetch would always get
 * `permission.denied for members.list` even when the seed says the
 * directory is public.
 *
 * Same env-var contract as `build-events.ts` / `build-announcements.ts`:
 * `KYCHON_ANON_KEY` + `KYCHON_PROJECT_ID` + `KYCHON_PUBLIC_URL`. Same
 * fallback semantics — missing vars or fetch failure resolves to empty
 * caches and the runtime path takes over.
 *
 * Fetches members + tiers in parallel. The runtime island joins them
 * client-side; we expose both caches and let the consumer
 * (`directory.astro`) join in its frontmatter before threading into
 * the React island as `initialMembers` (already joined).
 */

import { createKychonClient } from '@kychon/sdk';

import type { Member, MemberTier } from '@/schemas/member';

const MEMBERS_LIMIT = 500;

interface CapabilityListResult<T> {
  rows?: T[];
}

interface State {
  members: Member[];
  tiers: MemberTier[];
}

let loaderPromise: Promise<State> | null = null;
let cache: State | null = null;

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function fetchAll(): Promise<State> {
  const anonKey = readEnv('KYCHON_ANON_KEY');
  const projectId = readEnv('KYCHON_PROJECT_ID');
  const portalUrl = readEnv('KYCHON_PUBLIC_URL');
  if (!anonKey || !projectId || !portalUrl) {
    console.log(
      `[build-members] skipped — missing ${[
        !anonKey && 'KYCHON_ANON_KEY',
        !projectId && 'KYCHON_PROJECT_ID',
        !portalUrl && 'KYCHON_PUBLIC_URL',
      ].filter(Boolean).join(', ')}`,
    );
    return { members: [], tiers: [] };
  }

  const client = createKychonClient({
    portalUrl,
    apiKey: anonKey,
    apiBaseUrl: 'https://api.run402.com',
  });

  try {
    // Same filter as the runtime island: active members only, ordered
    // by display_name. Tiers loaded in parallel for the join.
    const [memberResult, tierResult] = await Promise.all([
      client.request<CapabilityListResult<Member>>('members.list', 'query', {
        filters: [{ field: 'status', op: 'eq', value: 'active' }],
        order: [{ field: 'display_name', direction: 'asc' }],
        limit: MEMBERS_LIMIT,
      }),
      client.request<CapabilityListResult<MemberTier>>('tiers.list', 'query', {}),
    ]);
    const members = Array.isArray(memberResult?.rows) ? memberResult.rows : [];
    const tiers = Array.isArray(tierResult?.rows) ? tierResult.rows : [];
    console.log(`[build-members] fetched ${members.length} member(s) + ${tiers.length} tier(s) for ${projectId}`);
    return { members, tiers };
  } catch (error) {
    console.warn(
      `[build-members] fetch failed for ${projectId} (${portalUrl}):`,
      error instanceof Error ? error.message : error,
    );
    return { members: [], tiers: [] };
  }
}

/**
 * Trigger the build-time members + tiers fetch. **Pass
 * `publicAccess: false` (or omit) on portals where the directory is
 * member-gated** — we skip the fetch to avoid surfacing auth-gated
 * names / avatars / bios into anonymous SSR HTML. Idempotent;
 * subsequent calls return the same promise.
 */
export async function ensureBuildMembersLoaded(opts: { publicAccess: boolean }): Promise<void> {
  if (!opts.publicAccess) {
    cache = { members: [], tiers: [] };
    return;
  }
  if (loaderPromise) {
    await loaderPromise;
    return;
  }
  loaderPromise = fetchAll();
  cache = await loaderPromise;
}

export function getAllBuildMembers(): readonly Member[] | null {
  return cache?.members ?? null;
}

export function getAllBuildMemberTiers(): readonly MemberTier[] | null {
  return cache?.tiers ?? null;
}

/** Test-only: clear cache between runs. */
export function _clearBuildMembersCacheForTests(): void {
  loaderPromise = null;
  cache = null;
}
