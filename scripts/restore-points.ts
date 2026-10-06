/**
 * Restore points: Run402 project snapshots taken before an operation that
 * rewrites portal content (re-import, engine upgrade), taken by the deploy
 * tooling with the wallet's `project.snapshots.manage` capability.
 *
 * Each one carries a label and `{ reason }` metadata. Run402 keeps both outside
 * the portal database, so the snapshot list is the restore-point ledger: admin
 * settings (kychon-api `restorePoints.list`) and `run402 snapshots list` show
 * them, and restoring never loses one.
 */

import type { ProjectSnapshotCreateOptions, ProjectSnapshotDto } from "@run402/sdk";

export type RestorePointReason = "before_reimport" | "before_engine_upgrade";

/** Same labels kychon-api shows for these reasons. */
export const RESTORE_POINT_LABELS: Record<RestorePointReason, string> = {
  before_reimport: "Before re-import",
  before_engine_upgrade: "Before engine upgrade",
};

export interface SnapshotsApi {
  create(opts?: ProjectSnapshotCreateOptions): Promise<ProjectSnapshotDto>;
  get(snapshotId: string): Promise<ProjectSnapshotDto>;
}

export interface TakeRestorePointOptions {
  /** Give up waiting for `ready` after this long (default 10 minutes). */
  timeoutMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (line: string) => void;
  /** Replaces the reason's default label. */
  label?: string;
  /** Extra metadata (e.g. the engine version) stored next to the reason. */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Take a snapshot and wait until it is `ready`. Throws when it fails, expires
 * or times out, so the operation it protects never runs without one.
 */
export async function takeRestorePoint(
  snapshots: SnapshotsApi,
  reason: RestorePointReason,
  opts: TakeRestorePointOptions = {},
): Promise<ProjectSnapshotDto> {
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
  const pollMs = opts.pollMs ?? 3000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((line: string) => console.log(line));

  const deadline = now() + timeoutMs;
  const label = opts.label ?? RESTORE_POINT_LABELS[reason];
  let snapshot = await snapshots.create({ label, metadata: { ...opts.metadata, reason, source: "deploy" } });
  log(`[restore-point] ${reason}: snapshot ${snapshot.snapshot_id} "${label}" (${snapshot.status})`);
  while (snapshot.status === "running") {
    if (now() >= deadline) {
      throw new Error(`[restore-point] ${reason}: snapshot ${snapshot.snapshot_id} still running after ${Math.round(timeoutMs / 1000)}s`);
    }
    await sleep(pollMs);
    snapshot = await snapshots.get(snapshot.snapshot_id);
  }
  if (snapshot.status !== "ready") {
    const detail = snapshot.error ? `: ${JSON.stringify(snapshot.error)}` : "";
    throw new Error(`[restore-point] ${reason}: snapshot ${snapshot.snapshot_id} ${snapshot.status}${detail}`);
  }
  log(`[restore-point] ${reason}: snapshot ${snapshot.snapshot_id} ready (captured ${snapshot.captured_at ?? "?"})`);
  return snapshot;
}
