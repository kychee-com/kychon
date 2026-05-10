import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { getActiveProjectSeed } from '../src/seeds/index.js';
import type { ProjectSeed } from '../src/seeds/types.js';

const ROOT = join(import.meta.dirname, '..');

const BASE_ROUTES = [
  { id: 'home', path: '/' },
  { id: 'events', path: '/events.html' },
  { id: 'resources', path: '/resources.html' },
  { id: 'forum', path: '/forum.html' },
  { id: 'admin-settings', path: '/admin-settings.html' },
] as const;

type RouteId = (typeof BASE_ROUTES)[number]['id'] | 'baked-chrome-page';

interface CaptureRoute {
  id: RouteId;
  path: string;
  expectedTitle?: string;
}

const VIEWPORTS = [
  { id: 'desktop', context: { viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' } },
  { id: 'mobile', context: { viewport: { width: 390, height: 844 }, isMobile: true, reducedMotion: 'reduce' } },
] as const;

const ERROR_TEXT = [
  'Error loading page',
  'Could not load forum categories',
  'Could not load topics',
  'Could not load resources',
  'Could not load announcements',
  'Could not load activity',
];

interface Options {
  base: string;
  outDir: string;
  liveApi: boolean;
  project: string | null;
}

const DEMO_ASSET_DIRS: Record<string, string> = {
  'barrio-unido': 'demo/barrio-unido/assets',
  eagles: 'demo/eagles/assets',
  'silver-pines': 'demo/silver-pines/assets',
};

let activeSeed: ProjectSeed;

function readFlag(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}

function parseOptions(args: string[]): Options {
  const base = readFlag(args, '--base');
  const outDir = readFlag(args, '--out-dir') ?? 'tmp/ui-screenshots';
  const liveApi = args.includes('--live-api');
  const project = readFlag(args, '--project') ?? process.env.KYCHON_PROJECT ?? null;
  if (!base) {
    throw new Error('Usage: npm exec --package=playwright -- tsx scripts/ui-capture-routes.ts --base http://localhost:4321 [--project eagles]');
  }
  return { base: base.replace(/\/+$/, ''), outDir, liveApi, project };
}

function captureRoutesForSeed(seed: ProjectSeed): CaptureRoute[] {
  const page =
    seed.pages?.find((candidate) => candidate.slug === 'showcase' && candidate.published !== false) ??
    seed.pages?.find((candidate) => candidate.published !== false);
  const pageRoute = page
    ? [{ id: 'baked-chrome-page' as const, path: `/page.html?slug=${encodeURIComponent(page.slug)}`, expectedTitle: page.title }]
    : [];
  return [...BASE_ROUTES, ...pageRoute];
}

async function importPlaywright(): Promise<any> {
  const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
  if (modulePath) {
    const loadFromPath = new Function('modulePath', 'return import(modulePath)') as (path: string) => Promise<any>;
    return loadFromPath(modulePath);
  }

  try {
    const load = new Function('return import("playwright")') as () => Promise<any>;
    return await load();
  } catch {
    throw new Error(
      'Playwright is required. Run with: npm exec --package=playwright -- tsx scripts/ui-capture-routes.ts --base http://localhost:4321',
    );
  }
}

const configOverrides: Record<string, unknown> = {
  directory_public: true,
  feature_forum: true,
  feature_committees: true,
};

function daysFromNow(days: number, hourOffset = 0): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000 + hourOffset * 60 * 60 * 1000);
  return date.toISOString();
}

function siteConfigRows(): unknown[] {
  return Object.entries(activeSeed.site_config).map(([key, entry]) => {
    const record = entry && typeof entry === 'object' ? (entry as { value?: unknown; category?: unknown }) : {};
    return {
      key,
      value: key in configOverrides ? configOverrides[key] : record.value,
      category: typeof record.category === 'string' ? record.category : 'general',
    };
  });
}

function sectionRowsForSlug(slug: string): unknown[] {
  return activeSeed.sections
    .map((section, index) => ({
      id: index + 1,
      visible: true,
      created_at: daysFromNow(-30),
      updated_at: daysFromNow(-1),
      ...section,
    }))
    .filter((section) => section.scope === 'global' || section.page_slug === '*' || section.page_slug === slug);
}

const adminMember = {
  id: 1,
  user_id: 'ui-capture-admin',
  email: 'admin@example.com',
  display_name: 'Kychon Admin',
  avatar_url: '',
  role: 'admin',
  status: 'active',
};

const activeMember = {
  id: 2,
  user_id: 'ui-capture-member',
  email: 'member@example.com',
  display_name: 'Taylor Member',
  avatar_url: '',
  role: 'member',
  status: 'active',
};

const adminSession = {
  access_token: 'ui-capture-token',
  refresh_token: 'ui-capture-refresh',
  user: {
    id: adminMember.user_id,
    email: adminMember.email,
    member: adminMember,
  },
};

const events = [
  {
    id: 1,
    title: 'Member Strategy Session',
    description: 'A working session for members to compare ideas, projects, and next steps.',
    location: 'Kychon Community Hall',
    starts_at: daysFromNow(14),
    ends_at: daysFromNow(14, 2),
    capacity: 48,
    image_url: '',
    is_members_only: false,
    source_timezone: 'America/New_York',
  },
  {
    id: 2,
    title: 'Spring Retrospective',
    description: 'Notes and highlights from a recent community gathering.',
    location: 'Online',
    starts_at: daysFromNow(-10),
    ends_at: daysFromNow(-10, 1),
    capacity: 0,
    image_url: '',
    is_members_only: false,
    source_timezone: 'America/New_York',
  },
];

const resources = [
  {
    id: 1,
    title: 'Community Starter Guide',
    description: 'A short guide for getting oriented inside the member portal.',
    category: 'Guides',
    file_type: 'pdf',
    file_url: '/sample-resource.pdf',
    is_members_only: false,
    created_at: daysFromNow(-3),
  },
  {
    id: 2,
    title: 'Planning Template',
    description: 'A reusable planning worksheet for committees and working groups.',
    category: 'Templates',
    file_type: 'link',
    file_url: 'https://example.com/planning-template',
    is_members_only: false,
    created_at: daysFromNow(-7),
  },
];

const forumCategories = [
  {
    id: 1,
    name: 'Announcements',
    description: 'Official updates and community notices.',
    color: '#6366f1',
    position: 1,
  },
  {
    id: 2,
    name: 'General Discussion',
    description: 'Open member conversations and questions.',
    color: '#0f766e',
    position: 2,
  },
];

const forumTopics = [
  {
    id: 1,
    category_id: 1,
    title: 'Welcome to the forum',
    author_name: 'Kychon Team',
    author_avatar: '',
    created_at: daysFromNow(-5),
    last_reply_at: daysFromNow(-1),
    reply_count: 2,
    is_pinned: true,
    locked: false,
    hidden: false,
  },
  {
    id: 2,
    category_id: 2,
    title: 'What should we improve next?',
    author_name: 'Taylor Member',
    author_avatar: '',
    created_at: daysFromNow(-2),
    last_reply_at: daysFromNow(-2),
    reply_count: 0,
    is_pinned: false,
    locked: false,
    hidden: false,
  },
];

function membershipTierRows(): unknown[] {
  return (activeSeed.membership_tiers || []).map((tier, index) => ({
    id: index + 1,
    ...tier,
  }));
}

function customFieldRows(): unknown[] {
  const fields = activeSeed.member_custom_fields || [
    {
      field_name: 'organization',
      field_label: 'Organization',
      field_type: 'text',
      options: null,
      required: false,
      visible_in_directory: true,
      position: 1,
    },
  ];
  return fields.map((field, index) => ({ id: index + 1, ...field }));
}

function pageRows(params: URLSearchParams): unknown[] {
  const slug = eqFilter(params, 'slug');
  return (activeSeed.pages || [])
    .map((page, index) => ({
      id: index + 1,
      content: '',
      requires_auth: false,
      published: true,
      ...page,
    }))
    .filter((page) => (!slug || page.slug === slug) && page.published !== false);
}

const announcements = [
  {
    id: 1,
    title: 'Welcome to Kychon Community',
    body: '<p>Your portal is ready for members, events, resources, and discussion.</p>',
    author_id: adminMember.id,
    is_pinned: true,
    created_at: daysFromNow(-4),
  },
];

const activityLog = [
  {
    id: 1,
    member_id: activeMember.id,
    action: 'resource_view',
    metadata: {},
    created_at: daysFromNow(-1),
  },
];

function eqFilter(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value?.startsWith('eq.') ? value.slice(3) : null;
}

function inFilter(params: URLSearchParams, key: string): string[] {
  const value = params.get(key);
  const match = value?.match(/^in\.\((.*)\)$/);
  if (!match) return [];
  return match[1].split(',').map((item) => item.trim()).filter(Boolean);
}

function rowsForTable(table: string, params: URLSearchParams): unknown[] {
  switch (table) {
    case 'site_config': {
      const rows = siteConfigRows();
      const key = eqFilter(params, 'key');
      if (key) return rows.filter((row) => (row as { key: string }).key === key);
      const keys = inFilter(params, 'key');
      if (keys.length) return rows.filter((row) => keys.includes((row as { key: string }).key));
      return rows;
    }
    case 'sections': {
      const orClause = params.get('or') || '';
      const slug = orClause.match(/page_slug\.eq\.([^,)]+)/)?.[1] || eqFilter(params, 'page_slug') || 'index';
      const rows = sectionRowsForSlug(decodeURIComponent(slug));
      const id = eqFilter(params, 'id');
      return id ? rows.filter((row) => String((row as { id: number }).id) === id) : rows;
    }
    case 'pages': {
      return pageRows(params);
    }
    case 'events':
      return events;
    case 'resources':
      return resources;
    case 'forum_categories': {
      const id = eqFilter(params, 'id');
      return id ? forumCategories.filter((category) => String(category.id) === id) : forumCategories;
    }
    case 'forum_topics': {
      const categoryId = eqFilter(params, 'category_id');
      const visible = params.get('hidden') === 'eq.false';
      return forumTopics.filter((topic) => {
        if (categoryId && String(topic.category_id) !== categoryId) return false;
        if (visible && topic.hidden) return false;
        return true;
      });
    }
    case 'members': {
      const members = [adminMember, activeMember];
      const userId = eqFilter(params, 'user_id');
      const email = eqFilter(params, 'email');
      const id = eqFilter(params, 'id');
      const ids = inFilter(params, 'id');
      const status = eqFilter(params, 'status');
      return members.filter((member) => {
        if (userId && member.user_id !== userId) return false;
        if (email && member.email !== email) return false;
        if (id && String(member.id) !== id) return false;
        if (ids.length && !ids.includes(String(member.id))) return false;
        if (status && member.status !== status) return false;
        return true;
      });
    }
    case 'membership_tiers':
      return membershipTierRows();
    case 'member_custom_fields':
      return customFieldRows();
    case 'announcements':
      return announcements;
    case 'activity_log':
      return activityLog;
    case 'content_translations':
    case 'moderation_log':
    case 'polls':
    case 'poll_options':
    case 'poll_votes':
    case 'event_rsvps':
    case 'event_registration_options':
    case 'i18n_strings':
      return [];
    default:
      return [];
  }
}

function paramsFromCapabilityInput(input: Record<string, unknown> = {}): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value == null || typeof value === 'object') continue;
    params.set(key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), `eq.${String(value)}`);
  }
  return params;
}

function rowsForOperation(operation: string, input: Record<string, unknown>): unknown[] {
  const params = paramsFromCapabilityInput(input);
  switch (operation) {
    case 'config.get':
      return rowsForTable('site_config', params);
    case 'sections.list':
      return rowsForTable('sections', params);
    case 'pages.list':
    case 'pages.get':
      return rowsForTable('pages', params);
    case 'events.list':
    case 'events.get':
      return rowsForTable('events', params);
    case 'resources.list':
    case 'resources.get':
      return rowsForTable('resources', params);
    case 'forum.categories.list':
    case 'forum.categories.get':
      return rowsForTable('forum_categories', params);
    case 'forum.topics.list':
    case 'forum.topics.get':
      return rowsForTable('forum_topics', params);
    case 'members.list':
    case 'members.get':
      return rowsForTable('members', params);
    case 'tiers.list':
      return rowsForTable('membership_tiers', params);
    case 'memberFields.list':
      return rowsForTable('member_custom_fields', params);
    case 'announcements.list':
    case 'announcements.get':
      return rowsForTable('announcements', params);
    case 'activity.list':
      return rowsForTable('activity_log', params);
    default:
      return [];
  }
}

function assetContentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

async function installDemoAssetRoutes(context: any, project: string | null): Promise<void> {
  const assetDir = project ? DEMO_ASSET_DIRS[project] : null;
  if (!assetDir) return;

  await context.route('**/assets/**', async (route: any) => {
    const url = new URL(route.request().url());
    const filename = basename(decodeURIComponent(url.pathname));
    const assetPath = join(ROOT, assetDir, filename);
    if (!existsSync(assetPath)) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: assetContentType(assetPath),
      body: readFileSync(assetPath),
    });
  });
}

async function installMockApi(context: any): Promise<void> {
  await context.route('**/functions/v1/kychon-api', async (route: any) => {
    const request = route.request();
    const method = request.method();
    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: corsHeaders(),
      });
      return;
    }

    let body: Record<string, unknown> = {};
    if (method === 'POST') {
      try {
        body = request.postDataJSON();
      } catch {
        body = {};
      }
    }
    const operation = String(body.operation || '');
    const input = body.input && typeof body.input === 'object' ? body.input : {};
    const rows = rowsForOperation(operation, input);
    const data = operation.startsWith('search.')
      ? { query: input.q || '', type: input.type || 'all', page: 1, page_size: 5, total: 0, has_next: false, facets: {}, results: [] }
      : { rows, count: rows.length };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        ...corsHeaders(),
      },
      body: JSON.stringify({ ok: true, correlationId: 'ui-capture', data }),
    });
  });

  await context.route('**/auth/v1/**', async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders(),
      body: JSON.stringify(adminSession),
    });
  });

  await context.route('**/functions/v1/**', async (route: any) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders(),
      body: JSON.stringify({ results: [], text: '' }),
    });
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Range',
  };
}

async function prepareContext(
  browser: any,
  options: Options,
  routeId: string,
  contextOptions: Record<string, unknown>,
): Promise<any> {
  const context = await browser.newContext(contextOptions);
  if (!options.liveApi) {
    await installDemoAssetRoutes(context, options.project);
    await installMockApi(context);
  }
  await context.addInitScript((session: unknown) => {
    localStorage.clear();
    if (session) localStorage.setItem('wl_session', JSON.stringify(session));
  }, routeId === 'admin-settings' ? adminSession : null);
  return context;
}

async function waitForRouteReady(page: any, route: CaptureRoute): Promise<void> {
  await page.waitForLoadState('networkidle');
  switch (route.id) {
    case 'home':
      await page.waitForSelector('#sections .section', { timeout: 5000 });
      break;
    case 'events':
      await page.waitForSelector('#events-list .card', { timeout: 5000 });
      break;
    case 'resources':
      await page.waitForSelector('#resources-grid .card', { timeout: 5000 });
      break;
    case 'forum':
      await page.waitForSelector('.forum-category', { timeout: 5000 });
      break;
    case 'admin-settings':
      await page.waitForSelector('[data-admin-content]:not([hidden])', { timeout: 8000 });
      break;
    case 'baked-chrome-page':
      await page.waitForFunction(
        (expectedTitle: string) => document.querySelector('#page-title')?.textContent?.trim() === expectedTitle,
        route.expectedTitle || '',
        { timeout: 5000 },
      );
      break;
  }
  await assertNoErrorText(page, route.id);
}

async function assertNoErrorText(page: any, routeId: string): Promise<void> {
  const bodyText = await page.locator('body').innerText();
  const match = ERROR_TEXT.find((text) => bodyText.includes(text));
  if (match) {
    throw new Error(`Screenshot route "${routeId}" rendered error text: ${match}`);
  }
}

async function prepareFullPageScreenshot(page: any): Promise<void> {
  await page.addStyleTag({
    content: `
      .section { opacity: 1 !important; }
      #sections-skeleton { display: none !important; }
      #announcements-section,
      .section-activity-feed {
        content-visibility: visible !important;
        contain-intrinsic-size: auto !important;
      }
    `,
  });
  await page.evaluate(`
    (async () => {
      const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
      const step = Math.max(480, Math.floor(window.innerHeight * 0.75));
      const max = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      for (let y = 0; y <= max; y += step) {
        window.scrollTo(0, y);
        await sleep(60);
      }
      window.scrollTo(0, 0);
      await sleep(900);
    })()
  `);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (options.project) process.env.KYCHON_PROJECT = options.project;
  activeSeed = await getActiveProjectSeed();

  const routes = captureRoutesForSeed(activeSeed);
  const outDir = join(ROOT, options.outDir);
  mkdirSync(outDir, { recursive: true });

  const { chromium } = await importPlaywright();
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : undefined);
  try {
    for (const viewport of VIEWPORTS) {
      for (const route of routes) {
        const context = await prepareContext(browser, options, route.id, viewport.context);
        try {
          const page = await context.newPage();
          await page.goto(`${options.base}${route.path}`, { waitUntil: 'networkidle' });
          await waitForRouteReady(page, route);
          await prepareFullPageScreenshot(page);
          await page.screenshot({ path: join(outDir, `${route.id}-${viewport.id}.png`), fullPage: true });
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  const source = options.liveApi ? 'live API' : 'mock API';
  const project = options.project ? ` for ${options.project}` : '';
  process.stdout.write(`wrote screenshots to ${options.outDir}${project} using ${source}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
