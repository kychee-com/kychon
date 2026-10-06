/**
 * Content history UI (content-history, Phase 3) in a DOM: the
 * HistoryHost dialog lists changesets and resolves a revert conflict with
 * "Revert anyway"; a save toast offers Undo for the save's changesets.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const history = vi.hoisted(() => ({
  listChangesets: vi.fn(),
  listChangesetRevisions: vi.fn(),
  listRevisions: vi.fn(),
  getRevision: vi.fn(),
  revertChangeset: vi.fn(),
}));
vi.mock('../../src/lib/content-history', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/content-history')>()),
  ...history,
}));
const role = vi.hoisted(() => ({ value: 'admin' as string | null }));
vi.mock('../../src/lib/auth', () => ({ getRole: () => role.value }));

const sonner = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('../../src/components/kychon/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/components/kychon/ui')>()),
  toast: sonner,
}));

let root: Root | null = null;
let host: HTMLElement;

beforeEach(() => {
  clearBodyFixture();
  bodyFixture('<div data-history-test-host></div>');
  host = document.querySelector('[data-history-test-host]') as HTMLElement;
  for (const fn of [...Object.values(history), ...Object.values(sonner)]) fn.mockReset();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const changeset = {
  id: '12',
  actor_type: 'admin',
  actor_id: 'u1',
  label: 'sections.updateConfig',
  reverts_changeset_id: null,
  created_at: '2026-10-06T10:00:00Z',
  revision_count: 1,
  targets: [{ table: 'sections', key: { id: 3 } }],
};

describe('HistoryHost', () => {
  it('lists changesets, and a conflicting revert asks before forcing', async () => {
    history.listChangesets.mockResolvedValue({ changesets: [changeset], nextBeforeId: null });
    history.revertChangeset
      .mockResolvedValueOnce({
        ok: false,
        conflict: true,
        message: 'changed',
        conflicts: [{ table: 'sections', key: { id: 3 } }],
      })
      .mockResolvedValueOnce({ ok: true });
    const { default: HistoryHost } = await import('../../src/components/kychon/HistoryHost');
    const { openHistory } = await import('../../src/lib/content-history');

    root = createRoot(host);
    await act(async () => root?.render(createElement(HistoryHost)));
    await act(async () => openHistory());
    await flush();

    const item = document.querySelector('[data-history-changeset="12"]');
    expect(item?.textContent).toContain('sections.updateConfig');

    await act(async () => (document.querySelector('[data-history-revert="12"]') as HTMLButtonElement).click());
    await flush();
    expect(history.revertChangeset).toHaveBeenNthCalledWith(1, '12', false);
    const conflict = document.querySelector('[data-history-conflict]');
    expect(conflict).not.toBeNull();

    const forceButton = [...(conflict?.querySelectorAll('button') ?? [])].find((b) =>
      /anyway/i.test(b.textContent ?? ''),
    );
    await act(async () => forceButton?.click());
    await flush();
    expect(history.revertChangeset).toHaveBeenNthCalledWith(2, '12', true);
    expect(sonner.success).toHaveBeenCalled();
  });
});

describe('HistoryHost before the session resolves', () => {
  it('opens on request once the admin role is known, even if it mounted before', async () => {
    role.value = null;
    history.listChangesets.mockResolvedValue({ changesets: [], nextBeforeId: null });
    const { default: HistoryHost } = await import('../../src/components/kychon/HistoryHost');
    const { openHistory } = await import('../../src/lib/content-history');
    root = createRoot(host);
    await act(async () => root?.render(createElement(HistoryHost)));

    role.value = 'admin'; // session finished loading; no auth-changed event fired
    await act(async () => openHistory());
    await flush();
    expect(document.querySelector('[data-history-dialog]')).not.toBeNull();
  });

  it('ignores requests from non-admins', async () => {
    role.value = 'member';
    const { default: HistoryHost } = await import('../../src/components/kychon/HistoryHost');
    const { openHistory } = await import('../../src/lib/content-history');
    root = createRoot(host);
    await act(async () => root?.render(createElement(HistoryHost)));
    await act(async () => openHistory());
    await flush();
    expect(document.querySelector('[data-history-dialog]')).toBeNull();
    role.value = 'admin';
  });
});

describe('save toast Undo', () => {
  it('offers Undo on the success toast right after a save, and only then', async () => {
    const { rememberChangesets } = await import('../../src/lib/history-recent');
    const { mountToastIsland, emitKychonToast } = await import('../../src/components/kychon/ToastIsland');
    await act(async () => mountToastIsland(host));
    await flush();

    rememberChangesets({ result: {}, changed: [], history: { changesetIds: ['21'] } });
    emitKychonToast({ message: 'Saved', type: 'success' });
    const [, withUndo] = sonner.success.mock.calls.at(-1) ?? [];
    expect(withUndo?.action?.label).toBe('Undo');

    emitKychonToast({ message: 'Copied', type: 'success' });
    const [, plain] = sonner.success.mock.calls.at(-1) ?? [];
    expect(plain?.action).toBeUndefined();

    history.revertChangeset.mockResolvedValue({ ok: true });
    await act(async () => withUndo.action.onClick());
    await flush();
    expect(history.revertChangeset).toHaveBeenCalledWith('21');
  });
});
