/**
 * Content history UI plumbing (content-history, Phase 3): the
 * recent-changeset store behind Undo, the before/after diff, revert outcome
 * mapping, and the History button on block toolbars.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const execOp = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/api', () => ({ execOp, queryOp: vi.fn() }));

import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';
import { diffRows, revertChangeset } from '../../src/lib/content-history';
import { rememberChangesets, takeRecentChangesets } from '../../src/lib/history-recent';

afterEach(() => {
  execOp.mockReset();
  takeRecentChangesets();
});

describe('recent changesets (Undo)', () => {
  it('remembers the changesets an action result reports and hands them out once', () => {
    rememberChangesets({ result: {}, changed: [], history: { changesetIds: ['7'] } });
    expect(takeRecentChangesets()).toEqual(['7']);
    expect(takeRecentChangesets()).toEqual([]);
  });

  it('accumulates within the undo window and expires after it', () => {
    rememberChangesets({ history: { changesetIds: [1] } });
    rememberChangesets({ history: { changesetIds: [2] } });
    expect(takeRecentChangesets()).toEqual(['1', '2']);
    rememberChangesets({ history: { changesetIds: [3] } });
    expect(takeRecentChangesets(Date.now() + 10_000)).toEqual([]);
  });

  it('ignores results without history', () => {
    rememberChangesets({ result: {}, changed: [] });
    rememberChangesets(null);
    expect(takeRecentChangesets()).toEqual([]);
  });
});

describe('diffRows', () => {
  it('lists only changed fields, all fields for an insert', () => {
    expect(diffRows({ id: 1, title: 'A', config: { x: 1 } }, { id: 1, title: 'B', config: { x: 1 } })).toEqual([
      { field: 'title', before: 'A', after: 'B' },
    ]);
    expect(diffRows(null, { id: 2, title: 'New' }).map((c) => c.field)).toEqual(['id', 'title']);
  });
});

describe('revertChangeset outcome', () => {
  it('reports success and announces the change', async () => {
    execOp.mockResolvedValue({ reverted_changeset_id: 4 });
    vi.stubGlobal('document', new EventTarget());
    const listener = vi.fn();
    document.addEventListener('kychon:history-changed', listener);
    expect(await revertChangeset('4')).toEqual({ ok: true });
    expect(execOp).toHaveBeenCalledWith('history.revert', { changeset_id: 4, force: false });
    expect(listener).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('maps a conflict (KychonApiError code/detail) without throwing', async () => {
    execOp.mockRejectedValue(
      Object.assign(new Error('Some rows changed'), {
        code: 'conflict.state',
        detail: { conflicts: [{ table: 'sections', key: { id: 3 } }] },
      }),
    );
    expect(await revertChangeset('4')).toEqual({
      ok: false,
      conflict: true,
      message: 'Some rows changed',
      conflicts: [{ table: 'sections', key: { id: 3 } }],
    });
  });
});

describe('section toolbar', () => {
  it('admin block toolbars carry a History button for that block, members see none', () => {
    const section: Section = {
      id: 42,
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'hero',
      config: { heading: 'Hi' },
      position: 1,
      visible: true,
    };
    const admin: BlockRenderContext = {
      admin: true,
      locale: 'en',
      authenticated: true,
      role: 'admin',
      isFeatureEnabled: () => true,
      currentPath: '/',
    };
    expect(renderBlock(section, admin)).toContain('data-section-history="42"');
    expect(renderBlock(section, { ...admin, admin: false })).not.toContain('data-section-history');
  });
});
