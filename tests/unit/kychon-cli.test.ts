import { describe, expect, it, vi } from 'vitest';

import { runKychonCli } from '../../src/cli/index.ts';

function io(env: Record<string, string | undefined> = { KYCHON_PORTAL_URL: 'https://portal.test' }) {
  return {
    stdout: { write: vi.fn() },
    stderr: { write: vi.fn() },
    env,
  };
}

function fakeClient() {
  const mutation = (name: string) => ({
    validate: vi.fn(async (input = {}) => ({ op: name, phase: 'validate', input })),
    execute: vi.fn(async (input = {}, options = {}) => ({ op: name, phase: 'execute', input, options })),
  });
  return {
    discover: vi.fn(async () => ({ discovery: true })),
    capabilities: vi.fn(async () => ({ operations: [] })),
    portal: { version: vi.fn(async () => ({ version: true })) },
    request: vi.fn(async (operation: string, phase: string, input = {}) => ({ operation, phase, input })),
    events: { create: mutation('events.create') },
    members: { approve: mutation('members.approve') },
    announcements: { publish: mutation('announcements.publish') },
    forum: { topics: { create: mutation('forum.topics.create') } },
    polls: { votes: { cast: mutation('pollVotes.cast') } },
    moderation: { queue: vi.fn(async (input = {}) => ({ op: 'moderation.queue', input })) },
    exports: {
      membersCsv: mutation('exports.membersCsv'),
      eventsCsv: mutation('exports.eventsCsv'),
      portalData: mutation('exports.portalData'),
    },
  };
}

describe('kychon CLI thin SDK wrapper', () => {
  it('implements api discover, capabilities, and versions through the SDK', async () => {
    const client = fakeClient();
    const factory = vi.fn(() => client as any);
    const out = io();

    await expect(runKychonCli(['api', 'discover'], out, factory)).resolves.toBe(0);
    await expect(runKychonCli(['api', 'capabilities'], out, factory)).resolves.toBe(0);
    await expect(runKychonCli(['api', 'versions'], out, factory)).resolves.toBe(0);

    expect(client.discover).toHaveBeenCalledOnce();
    expect(client.capabilities).toHaveBeenCalledOnce();
    expect(client.portal.version).toHaveBeenCalledOnce();
  });

  it('executes arbitrary JSON operation envelopes through client.request', async () => {
    const client = fakeClient();
    const out = io();

    await expect(
      runKychonCli(
        ['api', 'call', '--json', JSON.stringify({ operation: 'search.query', phase: 'query', input: { q: 'dues' } })],
        out,
        () => client as any,
      ),
    ).resolves.toBe(0);

    expect(client.request).toHaveBeenCalledWith('search.query', 'query', { q: 'dues' }, {});
  });

  it('dry-runs friendly mutation commands with validate', async () => {
    const client = fakeClient();

    await runKychonCli(['event', 'create', '--dry-run', '--json', '{"title":"Meet"}'], io(), () => client as any);
    await runKychonCli(['member', 'approve', '--dry-run', '--json', '{"id":7}'], io(), () => client as any);
    await runKychonCli(
      ['announcement', 'publish', '--dry-run', '--json', '{"title":"News"}'],
      io(),
      () => client as any,
    );
    await runKychonCli(
      ['forum', 'topic', 'create', '--dry-run', '--json', '{"title":"Topic"}'],
      io(),
      () => client as any,
    );
    await runKychonCli(['poll', 'vote', '--dry-run', '--json', '{"pollId":1,"optionId":2}'], io(), () => client as any);
    await runKychonCli(['exports', 'membersCsv', '--dry-run'], io(), () => client as any);

    expect(client.events.create.validate).toHaveBeenCalledWith({ title: 'Meet' });
    expect(client.members.approve.validate).toHaveBeenCalledWith({ id: 7 });
    expect(client.announcements.publish.validate).toHaveBeenCalledWith({ title: 'News' });
    expect(client.forum.topics.create.validate).toHaveBeenCalledWith({ title: 'Topic' });
    expect(client.polls.votes.cast.validate).toHaveBeenCalledWith({ pollId: 1, optionId: 2 });
    expect(client.exports.membersCsv.validate).toHaveBeenCalledWith({});
  });

  it('executes friendly mutation commands only with --yes', async () => {
    const client = fakeClient();

    await runKychonCli(['event', 'create', '--yes', '--json', '{"title":"Meet"}'], io(), () => client as any);
    await runKychonCli(['moderation', 'queue'], io(), () => client as any);

    expect(client.events.create.execute).toHaveBeenCalledWith({ title: 'Meet' }, { confirmed: true });
    expect(client.moderation.queue).toHaveBeenCalledWith({});
  });

  it('returns non-zero when portal configuration is missing', async () => {
    const out = io({});

    await expect(runKychonCli(['api', 'discover'], out, () => fakeClient() as any)).resolves.toBe(1);
    expect(out.stderr.write).toHaveBeenCalledWith(expect.stringContaining('Missing --portal'));
  });
});
