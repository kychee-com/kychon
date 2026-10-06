/**
 * Restore points: Run402 project snapshots taken before an operation that
 * rewrites portal content (re-import, engine upgrade). Owner-side only — they
 * need the wallet's `project.snapshots.manage` capability.
 *
 * Snapshots carry no caller label yet, so the reason is logged next to the
 * snapshot id; the owner finds it with `run402 snapshots list`.
 */

import type { ProjectSnapshotDto } from "@run402/sdk";

export type RestorePointReason = "before_reimport" | "before_engine_upgrade";

export interface SnapshotsApi {
  create(): Promise<ProjectSnapshotDto>;
  get(snapshotId: string): Promise<ProjectSnapshotDto>;
}

export interface TakeRestorePointOptions {
  /** Give up waiting for `ready` after this long (default 10 minutes). */
  timeoutMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (line: string) => void;
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
  let snapshot = await snapshots.create();
  log(`[restore-point] ${reason}: snapshot ${snapshot.snapshot_id} (${snapshot.status})`);
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
