import type { ProjectSnapshotDto } from '@run402/sdk';
import { describe, expect, it, vi } from 'vitest';
import { type SnapshotsApi, takeRestorePoint } from '../../scripts/restore-points';

function snapshot(status: string, overrides: Partial<ProjectSnapshotDto> = {}): ProjectSnapshotDto {
  return {
    snapshot_id: 'snap_1',
    operation_id: 'op_1',
    project_id: 'prj_1',
    kind: 'manual',
    profile: 'snapshot',
    status,
    manifest_sha256: null,
    size_bytes: 0,
    live_release_id: null,
    captured_at: status === 'ready' ? '2026-10-06T10:00:00Z' : null,
    expires_at: null,
    error: null,
    created_at: '2026-10-06T10:00:00Z',
    updated_at: '2026-10-06T10:00:00Z',
    next_actions: [],
    ...overrides,
  };
}

function fakeSnapshots(
  statuses: string[],
): SnapshotsApi & { create: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> } {
  const [first, ...rest] = statuses;
  const get = vi.fn();
  for (const status of rest) get.mockResolvedValueOnce(snapshot(status));
  return { create: vi.fn().mockResolvedValue(snapshot(first)), get };
}

const quiet = { log: () => {}, sleep: async () => {} };

describe('takeRestorePoint', () => {
  it('returns a snapshot that is ready immediately', async () => {
    const api = fakeSnapshots(['ready']);
    const result = await takeRestorePoint(api, 'before_reimport', quiet);
    expect(result.status).toBe('ready');
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('labels the snapshot and records the reason as metadata', async () => {
    const api = fakeSnapshots(['ready']);
    await takeRestorePoint(api, 'before_engine_upgrade', { ...quiet, metadata: { engine_version: '1.4.0' } });
    expect(api.create).toHaveBeenCalledWith({
      label: 'Before engine upgrade',
      metadata: { engine_version: '1.4.0', reason: 'before_engine_upgrade', source: 'deploy' },
    });
  });

  it('waits while the snapshot is running', async () => {
    const api = fakeSnapshots(['running', 'running', 'ready']);
    const result = await takeRestorePoint(api, 'before_reimport', quiet);
    expect(result.status).toBe('ready');
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenCalledWith('snap_1');
  });

  it('throws when the snapshot fails, so the re-import never runs without one', async () => {
    const api = fakeSnapshots(['running', 'failed']);
    await expect(takeRestorePoint(api, 'before_reimport', quiet)).rejects.toThrow(/snap_1 failed/);
  });

  it('throws when the snapshot is still running at the deadline', async () => {
    const api = {
      create: vi.fn().mockResolvedValue(snapshot('running')),
      get: vi.fn().mockResolvedValue(snapshot('running')),
    };
    let clock = 0;
    const promise = takeRestorePoint(api, 'before_engine_upgrade', {
      ...quiet,
      timeoutMs: 10_000,
      pollMs: 3_000,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });
    await expect(promise).rejects.toThrow(/still running after 10s/);
  });
});
