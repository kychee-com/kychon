import {
  createKychonClient,
  type JsonObject,
  KYCHON_API_VERSION,
  DEMO_PORTAL_FIXTURES as KYCHON_DEMO_PORTALS,
} from '@kychon/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import kychonApi from '../../functions/kychon-api.js';
import { GET as wellKnownGet } from '../../src/pages/.well-known/kychon.json.ts';
import { GET as llmsGet } from '../../src/pages/llms.txt.ts';

type MockDbChain = Promise<JsonObject[]> & {
  eq(column: string, value: unknown): MockDbChain;
  limit(count: number): Promise<JsonObject[]>;
};

const mockState = vi.hoisted(() => ({
  user: null as null | { id: string; email?: string },
  tables: {} as Record<string, JsonObject[]>,
  chain(rows: JsonObject[]): MockDbChain {
    const query = Promise.resolve(rows) as MockDbChain;
    query.eq = (column: string, value: unknown) => mockState.chain(rows.filter((row) => row[column] === value));
    query.limit = (count: number) => Promise.resolve(rows.slice(0, count));
    return query;
  },
}));

vi.mock(
  '@run402/functions',
  () => ({
    getUser: vi.fn(async () => mockState.user),
    adminDb: () => ({
      from(table: string) {
        return {
          select() {
            return mockState.chain(mockState.tables[table] || []);
          },
        };
      },
    }),
  }),
  { virtual: true },
);

function demoTables(name: string): Record<string, JsonObject[]> {
  return {
    site_config: [{ key: 'site_name', value: name, category: 'branding' }],
    members: [
      {
        id: 10,
        user_id: 'member-user',
        email: 'demo-member@kychon.com',
        display_name: 'Demo Member',
        role: 'member',
        status: 'active',
      },
    ],
    events: [
      { id: 1, title: `${name} Public Event`, is_members_only: false },
      { id: 2, title: `${name} Member Event`, is_members_only: true },
    ],
    resources: [
      { id: 1, title: `${name} Public Guide`, is_members_only: false },
      { id: 2, title: `${name} Member Guide`, is_members_only: true },
    ],
    forum_categories: [{ id: 1, name: 'General' }],
    forum_topics: [{ id: 1, category_id: 1, title: `${name} Welcome`, hidden: false }],
    forum_replies: [{ id: 1, topic_id: 1, body: 'Glad to be here', hidden: false }],
    polls: [{ id: 1, question: `${name} poll`, results_visible: 'after_vote', is_open: true }],
    poll_options: [
      { id: 1, poll_id: 1, label: 'Yes' },
      { id: 2, poll_id: 1, label: 'No' },
    ],
    poll_votes: [{ id: 1, poll_id: 1, option_id: 1, member_id: 10 }],
    committees: [{ id: 1, name: `${name} Committee` }],
    committee_members: [{ id: 1, committee_id: 1, member_id: 10 }],
    reactions: [{ id: 1, content_type: 'forum.topic', content_id: 1, emoji: 'heart', member_id: 10 }],
    search_documents: [
      {
        id: 1,
        source_type: 'event',
        source_key: '1',
        title: `${name} volunteer day`,
        body: 'Volunteer signup and orientation',
        url: '/events.html',
        published: true,
        is_members_only: false,
      },
    ],
  };
}

function apiFetch(req: string | URL | Request, init?: RequestInit) {
  return kychonApi(new Request(req, init));
}

beforeEach(() => {
  mockState.user = null;
  mockState.tables = {};
});

afterEach(() => {
  delete process.env.KYCHON_PUBLIC_URL;
});

describe('official demo portal API integration', () => {
  for (const demo of KYCHON_DEMO_PORTALS) {
    it(`${demo.name} can use the typed SDK against the deployable capability API`, async () => {
      mockState.tables = demoTables(demo.name);
      const client = createKychonClient({ portalUrl: demo.portalUrl, fetch: apiFetch as typeof fetch });

      await expect(client.portal.version()).resolves.toMatchObject({ apiCurrentVersion: KYCHON_API_VERSION });
      await expect(client.config.get({ key: 'site_name' })).resolves.toMatchObject({ value: demo.name });
      await expect(client.events.list()).resolves.toMatchObject({ count: 1 });
      await expect(client.search.query({ q: 'volunteer' })).resolves.toMatchObject({ total: 1 });

      mockState.user = { id: 'member-user', email: 'demo-member@kychon.com' };
      await expect(client.resources.list()).resolves.toMatchObject({ count: 2 });
      await expect(client.forum.topics.list()).resolves.toMatchObject({ count: 1 });
      await expect(client.polls.results.get({ id: 1 })).resolves.toMatchObject({ totalVotes: 1 });
    });

    it(`${demo.name} discovery documents bake the demo portal URL`, async () => {
      process.env.KYCHON_PUBLIC_URL = demo.portalUrl;
      const url = new URL('https://build-origin.invalid');

      const wellKnown = await wellKnownGet({ url }).json();
      const llms = await llmsGet({ url }).text();

      expect(wellKnown).toMatchObject({
        portalUrl: demo.portalUrl,
        api: {
          endpoint: 'https://api.run402.com/functions/v1/kychon-api',
          transport: 'run402-functions',
          publicKeySource: '/js/env.js',
        },
        sdk: { package: '@kychon/sdk', firstDeliverable: true },
      });
      expect(llms).toContain('https://api.run402.com/functions/v1/kychon-api');
    });
  }
});
