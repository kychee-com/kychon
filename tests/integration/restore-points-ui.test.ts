/**
 * Admin settings "Restore points": lists the platform's restore points, takes
 * one, and lets only the owner restore after typing the site name, polling a
 * restore that outlasts its call.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const api = vi.hoisted(() => ({ queryOp: vi.fn(), execOp: vi.fn() }));
vi.mock('../../src/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/api')>()),
  queryOp: api.queryOp,
  execOp: api.execOp,
}));

const { RestorePointsCard, RESTORE_POLL_MS } = await import('../../src/components/kychon/RestorePointsCard');

const POINTS = [
  {
    id: 'snap_2',
    label: 'Before restoring "Before spring redesign"',
    reason: 'before_restore',
    kind: 'pre_restore',
    status: 'ready',
    createdAt: '2026-10-06T11:00:00Z',
    createdBy: null,
    restoreOf: 'snap_1',
    deletable: false,
  },
  {
    id: 'snap_1',
    label: 'Before spring redesign',
    reason: 'manual',
    kind: 'manual',
    status: 'ready',
    createdAt: '2026-10-06T10:00:00Z',
    createdBy: 'Ada Admin',
    restoreOf: null,
    deletable: true,
  },
  {
    id: 'snap_0',
    label: 'Automatic snapshot',
    reason: 'pre_migration',
    kind: 'pre_migration',
    status: 'ready',
    createdAt: '2026-10-06T09:00:00Z',
    createdBy: null,
    restoreOf: null,
    deletable: false,
  },
];

let root: Root | null = null;
let host: HTMLElement;

function listing(canRestore: boolean) {
  return { restorePoints: POINTS, siteName: 'Riverside Eagles', canRestore, nextCursor: null };
}

beforeEach(() => {
  clearBodyFixture();
  bodyFixture('<div data-restore-test-host></div>');
  host = document.querySelector('[data-restore-test-host]') as HTMLElement;
  api.queryOp.mockReset();
  api.execOp.mockReset();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  vi.useRealTimers();
});

async function render() {
  await act(async () => {
    root = createRoot(host);
    root.render(createElement(RestorePointsCard));
  });
}

function button(label: string, scope: ParentNode = document): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(label));
  if (!found) throw new Error(`no button ${label}`);
  return found as HTMLButtonElement;
}

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function dialog(): HTMLElement {
  const found = document.querySelector('[role="dialog"]');
  if (!found) throw new Error('no dialog');
  return found as HTMLElement;
}

describe('RestorePointsCard', () => {
  it('lists restore points with label, reason and who took them', async () => {
    api.queryOp.mockResolvedValue(listing(false));
    await render();
    expect(api.queryOp).toHaveBeenCalledWith('restorePoints.list');
    expect(host.textContent).toContain('Before spring redesign');
    expect(host.textContent).toContain('Taken by an admin · Ada Admin');
    expect(host.textContent).toContain('undo that restore with this one');
    expect(host.textContent).toContain('Only the site owner can restore one.');
    // Admins (not owners) get no Restore button; only manual points are deletable.
    expect([...host.querySelectorAll('button')].some((b) => b.textContent?.includes('Restore'))).toBe(false);
    expect(host.querySelectorAll('[aria-label^="Delete restore point"]')).toHaveLength(1);
  });

  it('folds automatic pre-migration snapshots away until asked', async () => {
    api.queryOp.mockResolvedValue(listing(false));
    await render();
    expect(host.querySelector('[data-restore-point="snap_0"]')).toBeNull();
    await act(async () => button('Show 1 automatic snapshot', host).click());
    expect(host.textContent).toContain('Before a database migration');
    await act(async () => button('Hide automatic snapshots', host).click());
    expect(host.querySelector('[data-restore-point="snap_0"]')).toBeNull();
  });

  it('takes a labelled restore point and reloads the list', async () => {
    api.queryOp.mockResolvedValue(listing(false));
    api.execOp.mockResolvedValue({ restorePoint: POINTS[1] });
    await render();
    await type(host.querySelector('input') as HTMLInputElement, ' Before the gala ');
    await act(async () => button('Create restore point', host).click());
    expect(api.execOp).toHaveBeenCalledWith('restorePoints.create', { label: 'Before the gala' });
    expect(api.queryOp).toHaveBeenCalledTimes(2);
  });

  it('restores for the owner only after the site name is typed, polling until done', async () => {
    vi.useFakeTimers();
    api.queryOp.mockImplementation(async (operation: string) =>
      operation === 'restorePoints.list'
        ? listing(true)
        : { restore: { id: 'rst_1', snapshotId: 'snap_1', status: 'ready', error: null } },
    );
    api.execOp.mockResolvedValue({ restore: { id: 'rst_1', snapshotId: 'snap_1', status: 'running', error: null } });
    await render();

    const row = host.querySelector('[data-restore-point="snap_1"]') as HTMLElement;
    await act(async () => button('Restore', row).click());
    const submit = button('Restore site', dialog());
    expect(submit.disabled).toBe(true);
    await type(dialog().querySelector('input') as HTMLInputElement, 'riverside eagles');
    expect(button('Restore site', dialog()).disabled).toBe(false);

    await act(async () => button('Restore site', dialog()).click());
    expect(api.execOp).toHaveBeenCalledWith('restorePoints.restore', {
      snapshot_id: 'snap_1',
      confirm_site_name: 'riverside eagles',
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESTORE_POLL_MS);
    });
    expect(api.queryOp).toHaveBeenCalledWith('restorePoints.restoreStatus', {
      snapshot_id: 'snap_1',
      restore_id: 'rst_1',
    });
    expect(host.textContent).toContain('The site was restored to "Before spring redesign"');
  });

  it('shows why a restore failed and keeps the dialog open', async () => {
    api.queryOp.mockResolvedValue(listing(true));
    api.execOp.mockRejectedValue(new Error('Type the site name "Riverside Eagles" to confirm the restore.'));
    await render();
    const row = host.querySelector('[data-restore-point="snap_1"]') as HTMLElement;
    await act(async () => button('Restore', row).click());
    await type(dialog().querySelector('input') as HTMLInputElement, 'Riverside Eagles');
    await act(async () => button('Restore site', dialog()).click());
    expect(dialog().textContent).toContain('to confirm the restore.');
  });

  it('shows a load error', async () => {
    api.queryOp.mockRejectedValue(new Error('restorePoints.list requires admin role.'));
    await render();
    expect(host.textContent).toContain('restorePoints.list requires admin role.');
  });
});
