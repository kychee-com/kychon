// Admin content history (openspec content-history): browse changesets and
// revisions, and revert. Thin wrappers over the history.* capability
// operations; the UI lives in components/kychon/HistoryHost.tsx.

import { execOp, queryOp } from './api';

export interface HistoryTarget {
  table: string;
  key: Record<string, string | number>;
}

export interface Changeset {
  id: string;
  actor_type: 'admin' | 'agent' | 'jwt' | 'system' | 'unattributed';
  actor_id: string | null;
  label: string | null;
  reverts_changeset_id: string | null;
  created_at: string;
  revision_count: number;
  targets: HistoryTarget[];
}

export interface RevisionSummary {
  id: string;
  op: 'insert' | 'update' | 'delete';
  created_at: string;
  changeset_id: string;
  actor_type: Changeset['actor_type'];
  actor_id: string | null;
  label: string | null;
}

export interface Revision extends RevisionSummary {
  table_name: string;
  row_key: Record<string, string | number>;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

/** Fired after a revert so open views (and the page) can refresh. */
export const HISTORY_CHANGED_EVENT = 'kychon:history-changed';
/** Ask HistoryHost to open: no detail = site-wide list; `{ table, key, title }` = one row. */
export const HISTORY_OPEN_EVENT = 'kychon:history-open';

export interface HistoryOpenDetail {
  table?: string;
  key?: string | number;
  title?: string;
}

export function openHistory(detail: HistoryOpenDetail = {}): void {
  document.dispatchEvent(new CustomEvent<HistoryOpenDetail>(HISTORY_OPEN_EVENT, { detail }));
}

export async function listChangesets(beforeId?: string | null): Promise<{ changesets: Changeset[]; nextBeforeId: string | null }> {
  const data = await queryOp('history.list', beforeId ? { before_id: Number(beforeId) } : {});
  return {
    changesets: (data?.changesets ?? []).map(normalizeIds),
    nextBeforeId: data?.nextBeforeId != null ? String(data.nextBeforeId) : null,
  };
}

export async function listRevisions(table: string, key: string | number): Promise<RevisionSummary[]> {
  const data = await queryOp('history.revisions', { table, key });
  return (data?.revisions ?? []).map(normalizeIds);
}

export async function getRevision(id: string): Promise<Revision | null> {
  const data = await queryOp('history.revision', { id: Number(id) });
  return data?.revision ? normalizeIds(data.revision) : null;
}

export type RevertOutcome = { ok: true } | { ok: false; conflict: boolean; message: string; conflicts: HistoryTarget[] };

/** Revert one changeset. A conflict (row changed since) is reported, not thrown. */
export async function revertChangeset(changesetId: string, force = false): Promise<RevertOutcome> {
  try {
    await execOp('history.revert', { changeset_id: Number(changesetId), force });
    document.dispatchEvent(new CustomEvent(HISTORY_CHANGED_EVENT));
    return { ok: true };
  } catch (error) {
    // KychonApiError carries the capability error's code/detail directly.
    const err = error as { code?: string; message?: string; detail?: { conflicts?: HistoryTarget[] } };
    return {
      ok: false,
      conflict: err.code === 'conflict.state',
      message: err.message ?? 'Revert failed',
      conflicts: err.detail?.conflicts ?? [],
    };
  }
}

/** Fields that differ between two row snapshots (all fields for insert/delete). */
export function diffRows(before: Record<string, unknown> | null, after: Record<string, unknown> | null): FieldChange[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
  return fields
    .map((field) => ({ field, before: before?.[field] ?? null, after: after?.[field] ?? null }))
    .filter((change) => JSON.stringify(change.before) !== JSON.stringify(change.after));
}

// bigint ids arrive as strings or numbers depending on the driver; UI keys use strings.
function normalizeIds<T>(row: T): T {
  const out = { ...(row as Record<string, unknown>) };
  for (const field of ['id', 'changeset_id', 'reverts_changeset_id', 'capability_execution_id']) {
    if (out[field] != null) out[field] = String(out[field]);
  }
  return out as T;
}

/** All revisions of one changeset, with before/after rows (site history detail). */
export async function listChangesetRevisions(changesetId: string): Promise<Revision[]> {
  const data = await queryOp('history.revisions', { changeset_id: Number(changesetId) });
  return (data?.revisions ?? []).map(normalizeIds);
}
