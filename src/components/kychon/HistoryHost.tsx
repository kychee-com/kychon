'use client';

import { History, Loader2, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ScrollArea,
  toast,
} from '@/components/kychon/ui';
import { getRole } from '@/lib/auth';
import {
  type Changeset,
  diffRows,
  getRevision,
  HISTORY_OPEN_EVENT,
  type HistoryOpenDetail,
  type HistoryTarget,
  listChangesetRevisions,
  listChangesets,
  listRevisions,
  type Revision,
  type RevisionSummary,
  revertChangeset,
} from '@/lib/content-history';
import { t } from '@/lib/i18n';

/**
 * HistoryHost — admin content history.
 * One top-level dialog any admin UI opens with `kychon:history-open`:
 * no detail = site-wide changesets; `{ table, key, title }` = one row's
 * revisions (a block, a page, a config key). Revert asks before overwriting
 * later edits (conflict → "Revert anyway").
 */

type Mode = { kind: 'site' } | { kind: 'row'; table: string; key: string | number; title?: string };

function isAdminRole(): boolean {
  const role = getRole()?.toLowerCase();
  return role === 'admin' || role === 'project_admin';
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatValue(value: unknown): string {
  if (value == null) return '—';
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > 600 ? `${text.slice(0, 600)}…` : text;
}

function ActorBadge({ actorType }: { actorType: Changeset['actor_type'] }) {
  return <Badge variant={actorType === 'unattributed' ? 'outline' : 'secondary'}>{t(`history.actor.${actorType}`)}</Badge>;
}

function FieldDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const changes = diffRows(before, after);
  if (!changes.length) return <p className="text-sm text-muted-foreground">{t('history.no_field_changes')}</p>;
  return (
    <dl className="grid gap-2 text-sm">
      {changes.map((change) => (
        <div key={change.field} className="grid gap-1 rounded-md border p-2">
          <dt className="font-medium">{change.field}</dt>
          <dd className="grid gap-1 sm:grid-cols-2">
            <pre className="whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs" aria-label={t('history.before')}>
              {formatValue(change.before)}
            </pre>
            <pre className="whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs" aria-label={t('history.after')}>
              {formatValue(change.after)}
            </pre>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function targetLabel(target: HistoryTarget): string {
  return `${target.table} ${Object.values(target.key).join(', ')}`;
}

export default function HistoryHost() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: 'site' });
  const [conflict, setConflict] = useState<{ changesetId: string; count: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setIsAdmin(isAdminRole());
    const refresh = () => setIsAdmin(isAdminRole());
    document.addEventListener('wl-auth-changed', refresh);
    return () => document.removeEventListener('wl-auth-changed', refresh);
  }, []);

  // Listen from mount and check the role when asked: an admin can click History
  // before the session finishes loading, and that click must still open.
  useEffect(() => {
    function onOpen(event: Event) {
      if (!isAdminRole()) return;
      setIsAdmin(true);
      const detail = (event as CustomEvent<HistoryOpenDetail>).detail ?? {};
      setMode(detail.table && detail.key != null ? { kind: 'row', table: detail.table, key: detail.key, title: detail.title } : { kind: 'site' });
      setOpen(true);
    }
    document.addEventListener(HISTORY_OPEN_EVENT, onOpen);
    return () => document.removeEventListener(HISTORY_OPEN_EVENT, onOpen);
  }, []);

  const revert = useCallback(async (changesetId: string, force = false) => {
    setBusy(changesetId);
    const outcome = await revertChangeset(changesetId, force);
    setBusy(null);
    if (outcome.ok) {
      setConflict(null);
      toast.success(t('history.reverted'));
      window.setTimeout(() => window.location.reload(), 600);
      return;
    }
    if (outcome.conflict && !force) {
      setConflict({ changesetId, count: Math.max(outcome.conflicts.length, 1) });
      return;
    }
    toast.error(t('history.revert_failed'), { description: outcome.message });
  }, []);

  if (!isAdmin) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl" data-history-dialog>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-4" aria-hidden="true" />
              {mode.kind === 'site' ? t('history.site_title') : (mode.title ?? t('history.title'))}
            </DialogTitle>
            <DialogDescription>
              {mode.kind === 'site' ? t('history.site_description') : t('history.row_description')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-3">
            {open && mode.kind === 'site' ? <SiteHistory onRevert={revert} busy={busy} /> : null}
            {open && mode.kind === 'row' ? <RowHistory table={mode.table} rowKey={mode.key} onRevert={revert} busy={busy} /> : null}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={conflict != null} onOpenChange={(next) => (next ? null : setConflict(null))}>
        <DialogContent data-history-conflict>
          <DialogHeader>
            <DialogTitle>{t('history.conflict_title')}</DialogTitle>
            <DialogDescription>{t('history.conflict_body', { count: conflict?.count ?? 1 })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflict(null)}>
              {t('history.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={busy != null}
              onClick={() => conflict && void revert(conflict.changesetId, true)}
            >
              {t('history.revert_anyway')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RevertButton({ changesetId, busy, onRevert }: { changesetId: string; busy: string | null; onRevert: (id: string) => void }) {
  return (
    <Button size="sm" variant="outline" disabled={busy != null} onClick={() => onRevert(changesetId)} data-history-revert={changesetId}>
      {busy === changesetId ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
      {t('history.revert')}
    </Button>
  );
}

function SiteHistory({ onRevert, busy }: { onRevert: (id: string) => void; busy: string | null }) {
  const [changesets, setChangesets] = useState<Changeset[]>([]);
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [expanded, setExpanded] = useState<Record<string, Revision[] | 'loading'>>({});

  const load = useCallback(async (beforeId?: string | null) => {
    try {
      const page = await listChangesets(beforeId);
      setChangesets((prev) => (beforeId ? [...prev, ...page.changesets] : page.changesets));
      setNextBeforeId(page.nextBeforeId);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(id: string) {
    if (expanded[id]) {
      setExpanded(({ [id]: _, ...rest }) => rest);
      return;
    }
    setExpanded((prev) => ({ ...prev, [id]: 'loading' }));
    const revisions = await listChangesetRevisions(id).catch(() => []);
    setExpanded((prev) => ({ ...prev, [id]: revisions }));
  }

  if (state === 'loading') return <p className="text-sm text-muted-foreground">{t('history.loading')}</p>;
  if (state === 'error') return <p className="text-sm text-destructive">{t('history.load_failed')}</p>;
  if (!changesets.length) return <p className="text-sm text-muted-foreground">{t('history.empty')}</p>;

  return (
    <div className="grid gap-3" data-history-site>
      {changesets.map((changeset) => {
        const detail = expanded[changeset.id];
        return (
          <section key={changeset.id} className="grid gap-2 rounded-lg border p-3" data-history-changeset={changeset.id}>
            <div className="flex flex-wrap items-center gap-2">
              <ActorBadge actorType={changeset.actor_type} />
              <span className="font-medium">{changeset.label ?? `#${changeset.id}`}</span>
              <span className="text-sm text-muted-foreground">{formatTime(changeset.created_at)}</span>
              <span className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => void toggle(changeset.id)}>
                  {t('history.changes', { count: changeset.revision_count })}
                </Button>
                <RevertButton changesetId={changeset.id} busy={busy} onRevert={onRevert} />
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{changeset.targets.map(targetLabel).join(' · ')}</p>
            {detail === 'loading' ? <p className="text-sm text-muted-foreground">{t('history.loading')}</p> : null}
            {Array.isArray(detail)
              ? detail.map((revision) => (
                  <div key={revision.id} className="grid gap-2">
                    <p className="text-sm font-medium">
                      {t(`history.op.${revision.op}`)} · {revision.table_name} {Object.values(revision.row_key).join(', ')}
                    </p>
                    <FieldDiff before={revision.before} after={revision.after} />
                  </div>
                ))
              : null}
          </section>
        );
      })}
      {nextBeforeId ? (
        <Button variant="outline" onClick={() => void load(nextBeforeId)}>
          {t('history.load_more')}
        </Button>
      ) : null}
    </div>
  );
}

function RowHistory({
  table,
  rowKey,
  onRevert,
  busy,
}: {
  table: string;
  rowKey: string | number;
  onRevert: (id: string) => void;
  busy: string | null;
}) {
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Revision | null>(null);

  useEffect(() => {
    listRevisions(table, rowKey)
      .then(setRevisions)
      .catch(() => setFailed(true));
  }, [table, rowKey]);

  if (failed) return <p className="text-sm text-destructive">{t('history.load_failed')}</p>;
  if (!revisions) return <p className="text-sm text-muted-foreground">{t('history.loading')}</p>;
  if (!revisions.length) return <p className="text-sm text-muted-foreground">{t('history.empty')}</p>;

  if (selected) {
    return (
      <div className="grid gap-3" data-history-revision={selected.id}>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
            {t('history.back')}
          </Button>
          <ActorBadge actorType={selected.actor_type} />
          <span className="font-medium">{selected.label ?? t(`history.op.${selected.op}`)}</span>
          <span className="text-sm text-muted-foreground">{formatTime(selected.created_at)}</span>
          <span className="ml-auto">
            <RevertButton changesetId={selected.changeset_id} busy={busy} onRevert={onRevert} />
          </span>
        </div>
        <FieldDiff before={selected.before} after={selected.after} />
      </div>
    );
  }

  return (
    <ul className="grid gap-2" data-history-row>
      {revisions.map((revision) => (
        <li key={revision.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <ActorBadge actorType={revision.actor_type} />
          <span className="font-medium">{t(`history.op.${revision.op}`)}</span>
          {revision.label ? <span className="text-sm">{revision.label}</span> : null}
          <span className="text-sm text-muted-foreground">{formatTime(revision.created_at)}</span>
          <span className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => void getRevision(revision.id).then((r) => r && setSelected(r))}>
              {t('history.open')}
            </Button>
            <RevertButton changesetId={revision.changeset_id} busy={busy} onRevert={onRevert} />
          </span>
        </li>
      ))}
    </ul>
  );
}
