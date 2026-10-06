/**
 * In-memory stand-in for the `snapshots` namespace of `@run402/functions`:
 * enough of the platform's behaviour (labels and metadata, newest-first list,
 * plan/confirm restore with a `pre_restore` snapshot, async restore status) to
 * drive kychon-api's restore points in unit tests.
 */
import { vi } from 'vitest';

export interface FakeSnapshot {
  snapshot_id: string;
  project_id: string;
  kind: string;
  status: string;
  created_at: string;
  captured_at: string | null;
  expires_at: string | null;
  label: string | null;
  metadata: Record<string, unknown> | null;
  restore_of: { snapshot_id: string; restore_id: string } | null;
  live_release_id: string | null;
}

export interface FakeRestore {
  restore_id: string;
  snapshot_id: string;
  status: string;
  release_mode: string;
  pre_restore_snapshot_id: string;
  started_at: string;
  completed_at: string | null;
  error: { code: string; message: string } | null;
}

function platformError(code: string, message: string, status: number) {
  return Object.assign(new Error(`snapshots: ${message}`), { name: 'R402SnapshotsError', code, status });
}

export function createFakeSnapshots() {
  let seq = 0;
  let clock = Date.now();
  const store = {
    snapshots: [] as FakeSnapshot[],
    restores: [] as FakeRestore[],
    /** Status new snapshots start in. */
    createStatus: 'ready',
    /** Status a confirmed restore reports. */
    restoreStatus: 'ready',
    /** Releases restorePlan reports as not restorable. */
    releaseRestorable: true,
    /** Called when a restore is confirmed (e.g. to rewind the test database). */
    onRestore: null as null | ((snapshot: FakeSnapshot) => Promise<void> | void),
    /** Manual snapshots allowed before create fails. */
    manualCap: 20,
    unsupported: false,
  };

  function now() {
    clock += 1000;
    return new Date(clock).toISOString();
  }

  function add(partial: Partial<FakeSnapshot>): FakeSnapshot {
    seq += 1;
    const at = partial.created_at ?? now();
    const snapshot: FakeSnapshot = {
      snapshot_id: `snap_${seq}`,
      project_id: 'prj_test',
      kind: 'manual',
      status: 'ready',
      created_at: at,
      captured_at: at,
      expires_at: null,
      label: null,
      metadata: null,
      restore_of: null,
      live_release_id: 'rel_1',
      ...partial,
    };
    store.snapshots.unshift(snapshot);
    return snapshot;
  }

  function find(id: string) {
    const snapshot = store.snapshots.find((s) => s.snapshot_id === id);
    if (!snapshot) throw platformError('SNAPSHOT_NOT_FOUND', 'snapshot not found', 404);
    return snapshot;
  }

  function guard() {
    if (store.unsupported) throw platformError('SNAPSHOTS_UNSUPPORTED', 'no snapshot routes', 404);
  }

  const api = {
    create: vi.fn(async (opts: { label?: string; metadata?: Record<string, unknown> } = {}) => {
      guard();
      if (store.snapshots.filter((s) => s.kind === 'manual').length >= store.manualCap) {
        throw platformError('SNAPSHOT_MANUAL_CAP_EXCEEDED', 'manual snapshot cap reached', 409);
      }
      return { ...add({ label: opts.label ?? null, metadata: opts.metadata ?? null, status: store.createStatus }) };
    }),
    list: vi.fn(async (_opts: { limit?: number; after?: string } = {}) => {
      guard();
      return { snapshots: store.snapshots.map((s) => ({ ...s })), has_more: false, next_cursor: null };
    }),
    get: vi.fn(async (id: string) => {
      guard();
      return { ...find(id) };
    }),
    delete: vi.fn(async (id: string) => {
      guard();
      const snapshot = find(id);
      if (snapshot.kind !== 'manual') {
        throw platformError('SNAPSHOT_KIND_NOT_DELETABLE_BY_SERVICE_KEY', 'not deletable', 403);
      }
      store.snapshots = store.snapshots.filter((s) => s.snapshot_id !== id);
    }),
    restorePlan: vi.fn(async (id: string, opts: { release?: string } = {}) => {
      guard();
      find(id);
      return {
        snapshot_id: id,
        release: { mode: opts.release ?? 'keep', restorable: opts.release !== 'snapshot' || store.releaseRestorable },
        confirm: { token: `confirm:${id}:${opts.release ?? 'keep'}`, expires_at: now() },
      };
    }),
    restore: vi.fn(async (id: string, confirm: string, opts: { release?: string } = {}) => {
      guard();
      const target = find(id);
      if (confirm !== `confirm:${id}:${opts.release ?? 'keep'}`) {
        throw platformError('STALE_RESTORE_CONFIRMATION', 'confirmation does not match', 409);
      }
      seq += 1;
      const restoreId = `rst_${seq}`;
      const pre = add({ kind: 'pre_restore', restore_of: { snapshot_id: id, restore_id: restoreId } });
      await store.onRestore?.(target);
      const restore: FakeRestore = {
        restore_id: restoreId,
        snapshot_id: id,
        status: store.restoreStatus,
        release_mode: opts.release ?? 'keep',
        pre_restore_snapshot_id: pre.snapshot_id,
        started_at: now(),
        completed_at: store.restoreStatus === 'ready' ? now() : null,
        error: store.restoreStatus === 'failed' ? { code: 'RESTORE_FAILED', message: 'restore failed' } : null,
      };
      store.restores.push(restore);
      return { restore_id: restoreId, snapshot_id: id, status: 'running', release_mode: restore.release_mode };
    }),
    getRestore: vi.fn(async (id: string, restoreId: string) => {
      guard();
      const restore = store.restores.find((r) => r.snapshot_id === id && r.restore_id === restoreId);
      if (!restore) throw platformError('RESTORE_NOT_FOUND', 'restore not found', 404);
      return { ...restore };
    }),
  };

  function reset() {
    clock = Date.now();
    store.snapshots = [];
    store.restores = [];
    store.createStatus = 'ready';
    store.restoreStatus = 'ready';
    store.releaseRestorable = true;
    store.onRestore = null;
    store.manualCap = 20;
    store.unsupported = false;
    for (const fn of Object.values(api)) fn.mockClear();
  }

  return { api, store, add, reset };
}
