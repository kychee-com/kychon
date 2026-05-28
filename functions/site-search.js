// schedule: none (native site search endpoint)
import { adminDb, auth } from '@run402/functions';

const SEARCH_TYPES = new Set(['all', 'pages', 'resources', 'events']);
const TYPE_TO_SOURCE = { pages: 'page', resources: 'resource', events: 'event' };
const SOURCE_TO_TYPE = { page: 'pages', resource: 'resources', event: 'events' };
const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_MAX = 50;
const SUGGESTION_LIMIT = 5;

export default async (req) => {
  const url = new URL(req.url);
  const query = normalizeQuery(url.searchParams.get('q') || '');
  const type = normalizeType(url.searchParams.get('type') || 'all');
  const suggest = url.searchParams.get('suggest') === '1' || url.searchParams.get('title_only') === '1';
  const page = suggest ? 1 : normalizePage(url.searchParams.get('page'));
  const pageSize = suggest ? SUGGESTION_LIMIT : clampPageSize(url.searchParams.get('page_size'));

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Authorization',
  };

  if (!query) {
    return new Response(JSON.stringify(emptyResponse(query, type, page, pageSize)), { headers });
  }

  try {
    const canSeeMembersOnly = await isActiveMember(req);
    const response = await runSearch({ query, type, page, pageSize, suggest, canSeeMembersOnly });
    return new Response(JSON.stringify(response), { headers });
  } catch (e) {
    console.error('site-search failed:', e);
    return new Response(JSON.stringify({ error: 'Search failed' }), { status: 500, headers });
  }
};

function normalizeQuery(input) {
  return String(input || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function normalizeType(input) {
  return SEARCH_TYPES.has(input) ? input : 'all';
}

function normalizePage(input) {
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function clampPageSize(input) {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return PAGE_SIZE_DEFAULT;
  return Math.min(PAGE_SIZE_MAX, Math.floor(n));
}

function emptyResponse(query, type, page, pageSize) {
  return {
    query,
    type,
    page,
    page_size: pageSize,
    total: 0,
    has_next: false,
    facets: { all: 0, pages: 0, resources: 0, events: 0 },
    results: [],
  };
}

async function isActiveMember(_req) {
  // auth.user() returns Actor | null and never throws — no try/catch needed.
  const user = await auth.user();
  if (!user?.id) return false;
  // run402-allow-user-filter: adminDb() bypasses RLS to look up member by raw user.id
  const rows = await adminDb().from('members').select('id,status,role').eq('user_id', user.id).limit(1);
  const member = rows?.[0];
  return member?.status === 'active' && ['member', 'moderator', 'admin'].includes(member.role);
}

async function runSearch({ query, type, page, pageSize, suggest, canSeeMembersOnly }) {
  const db = adminDb();
  const offset = Math.max(0, (page - 1) * pageSize);
  const source = TYPE_TO_SOURCE[type] || null;
  const sourceFilter = source ? `AND source_type = ${sqlString(source)}` : '';
  const visibilityFilter = canSeeMembersOnly ? '' : 'AND is_members_only = false';
  const queryLit = sqlString(query);
  const match = buildMatchPredicate(queryLit, suggest);
  const rankExpr = `ts_rank_cd(search_vector, websearch_to_tsquery('simple', ${queryLit}))`;
  const titleMatchExpr = buildTitleMatchExpr(queryLit);

  const baseWhere = `
    published = true
    ${visibilityFilter}
    ${sourceFilter}
    AND (${match})
  `;
  const facetWhere = `
    published = true
    ${visibilityFilter}
    AND (${match})
  `;

  const rows = await sqlRows(
    db,
    `
    SELECT source_type, source_key, title, body, url, ${titleMatchExpr} AS title_match, ${rankExpr} AS rank, updated_at
    FROM search_documents
    WHERE ${baseWhere}
    ORDER BY title_match DESC, rank DESC, updated_at DESC, source_type ASC, source_key ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `,
  );

  const totalRows = await sqlRows(
    db,
    `
    SELECT count(*)::int AS total
    FROM search_documents
    WHERE ${baseWhere}
  `,
  );
  const total = Number(totalRows[0]?.total || 0);

  const facetRows = await sqlRows(
    db,
    `
    SELECT source_type, count(*)::int AS count
    FROM search_documents
    WHERE ${facetWhere}
    GROUP BY source_type
  `,
  );
  const facets = { all: 0, pages: 0, resources: 0, events: 0 };
  for (const row of facetRows) {
    const key = SOURCE_TO_TYPE[row.source_type];
    if (key) facets[key] = Number(row.count || 0);
  }
  facets.all = facets.pages + facets.resources + facets.events;

  return {
    query,
    type,
    page,
    page_size: pageSize,
    total,
    has_next: offset + rows.length < total,
    facets,
    results: rows.map((row) => ({
      id: `${row.source_type}:${row.source_key}`,
      type: row.source_type,
      title: row.title || 'Untitled',
      url: safeResultUrl(row.url, row.source_type, row.source_key),
      snippet: suggest ? '' : makeSnippet(row.body || row.title || '', query),
    })),
  };
}

function buildTitleMatchExpr(queryLit) {
  return `(
    title_vector @@ websearch_to_tsquery('simple', ${queryLit})
    OR lower(title) LIKE '%' || lower(${queryLit}) || '%'
  )`;
}

function buildMatchPredicate(queryLit, titleOnly) {
  const titleMatch = buildTitleMatchExpr(queryLit);
  const prefix = `(
    length(${queryLit}) >= 2
    AND (
      lower(title) LIKE lower(${queryLit}) || '%'
      OR lower(title) LIKE '% ' || lower(${queryLit}) || '%'
    )
  )`;
  if (titleOnly) return `(${titleMatch} OR ${prefix})`;
  return `(
    search_vector @@ websearch_to_tsquery('simple', ${queryLit})
    OR ${titleMatch}
    OR lower(body) LIKE '%' || lower(${queryLit}) || '%'
    OR ${prefix}
  )`;
}

async function sqlRows(db, sql) {
  const result = await db.sql(sql);
  return result?.rows || result || [];
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const RESERVED_CLEAN_PAGE_SLUGS = new Set([
  '',
  'index',
  'page',
  'admin',
  'admin-members',
  'admin-settings',
  'calendar',
  'committees',
  'directory',
  'event',
  'events',
  'forum',
  'join',
  'polls',
  'profile',
  'resources',
  'search',
  'ui-tokens',
]);

function safeCustomPageSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !RESERVED_CLEAN_PAGE_SLUGS.has(slug);
}

function canonicalInternalUrl(url) {
  try {
    const parsed = new URL(String(url || ''), 'https://kychon.local');
    if (parsed.pathname === '/page.html') {
      const slug = parsed.searchParams.get('slug') || '';
      if (!safeCustomPageSlug(slug)) return url;
      parsed.searchParams.delete('slug');
      const rest = parsed.searchParams.toString();
      return `/${slug}${rest ? `?${rest}` : ''}${parsed.hash}`;
    }
    if (parsed.pathname === '/resources.html') return `/resources${parsed.search}${parsed.hash}`;
    if (parsed.pathname === '/event.html') return `/event${parsed.search}${parsed.hash}`;
    if (parsed.pathname === '/search.html') return `/search${parsed.search}${parsed.hash}`;
  } catch {}
  return url;
}

function safeResultUrl(url, sourceType, sourceKey) {
  const fallback =
    sourceType === 'resource'
      ? `/resources#resource-${encodeURIComponent(sourceKey)}`
      : sourceType === 'event'
        ? `/event?id=${encodeURIComponent(sourceKey)}`
        : sourceKey === 'index'
          ? '/'
          : safeCustomPageSlug(sourceKey)
            ? `/${sourceKey}`
            : `/page.html?slug=${encodeURIComponent(sourceKey)}`;
  const raw = String(url || fallback);
  if (/^https?:\/\//i.test(raw)) return fallback;
  if (!raw.startsWith('/')) return fallback;
  return canonicalInternalUrl(raw);
}

function decodeSearchEntities(input) {
  let out = String(input || '');
  for (let i = 0; i < 2; i += 1) {
    out = out
      .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#(\d+);/g, (_m, code) => {
        const n = Number(code);
        return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ';
      })
      .replace(/&#x([0-9a-f]+);/gi, (_m, code) => {
        const n = Number.parseInt(code, 16);
        return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ';
      })
      .replace(/&amp;/gi, '&');
  }
  return out.replace(/\u00a0/g, ' ');
}

function stripHtml(input) {
  return decodeSearchEntities(input)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makeSnippet(input, query, maxLength = 180) {
  const text = stripHtml(input);
  if (!text) return '';
  const terms = String(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((term) => term.length >= 2)
    .slice(0, 8);
  const lower = text.toLowerCase();
  let firstHit = Number.POSITIVE_INFINITY;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx >= 0 && idx < firstHit) firstHit = idx;
  }
  const start = Number.isFinite(firstHit) ? Math.max(0, firstHit - Math.floor(maxLength / 3)) : 0;
  const slice = text.slice(start, start + maxLength);
  const prefix = start > 0 ? '...' : '';
  const suffix = start + maxLength < text.length ? '...' : '';
  let escaped = escapeHtml(`${prefix}${slice}${suffix}`);
  for (const term of terms) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    escaped = escaped.replace(new RegExp(`(${safe})`, 'gi'), '<mark>$1</mark>');
  }
  return escaped;
}
