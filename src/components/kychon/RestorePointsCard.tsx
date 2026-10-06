// Admin settings "Restore points": whole-site snapshots kept by Run402 (the
// restorePoints.* capabilities). Admins see and take them; only the site owner
// restores one, after typing the site name. A restore takes its own "Before
// restoring" point first, which shows up here so the restore can be undone.
import { History, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { type SyntheticEvent, useCallback, useEffect, useId, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/kychon/ui';
import { execOp, queryOp } from '@/lib/api';
import { showToast } from '@/lib/toast-events';

export interface RestorePoint {
  id: string;
  label: string;
  reason: string;
  kind: string;
  status: string;
  createdAt: string;
  createdBy: string | null;
  restoreOf: string | null;
  deletable: boolean;
}

interface RestoreStatus {
  id: string;
  snapshotId: string;
  status: string;
  error: { message?: string } | null;
}

const REASONS: Record<string, string> = {
  manual: 'Taken by an admin',
  before_agent_run: 'Before an AI assistant changed the site',
  before_engine_upgrade: 'Before an engine upgrade',
  before_reimport: 'Before a re-import',
  before_restore: 'Before a restore (undo that restore with this one)',
  scheduled: 'Automatic',
  pre_migration: 'Before a database migration',
};

/** How often a running snapshot or restore is checked again. */
export const RESTORE_POLL_MS = 3000;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function sameName(typed: string, expected: string): boolean {
  const norm = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  return norm(typed) !== '' && norm(typed) === norm(expected);
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export function RestorePointsCard() {
  const labelId = useId();
  const confirmId = useId();
  const [points, setPoints] = useState<RestorePoint[]>([]);
  const [siteName, setSiteName] = useState('');
  const [canRestore, setCanRestore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<RestorePoint | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | undefined>();
  const [restored, setRestored] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RestorePoint | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await queryOp('restorePoints.list');
      setPoints(Array.isArray(data?.restorePoints) ? data.restorePoints : []);
      setSiteName(typeof data?.siteName === 'string' ? data.siteName : '');
      setCanRestore(data?.canRestore === true);
      setError(undefined);
    } catch (loadError) {
      setError(errorMessage(loadError, 'Could not load restore points.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A snapshot is "running" for a few seconds after it is taken.
  const anyRunning = points.some((point) => point.status === 'running');
  useEffect(() => {
    if (!anyRunning) return;
    const timer = window.setTimeout(() => void load(), RESTORE_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [anyRunning, load]);

  async function create(event: SyntheticEvent) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await execOp('restorePoints.create', { label: trimmed });
      setLabel('');
      showToast(`Restore point "${trimmed}" taken`, 'success');
      await load();
    } catch (createError) {
      setError(errorMessage(createError, 'Could not take a restore point.'));
    } finally {
      setCreating(false);
    }
  }

  async function restore(event: SyntheticEvent) {
    event.preventDefault();
    if (!restoring || !sameName(confirmName, siteName)) return;
    setRestoreBusy(true);
    setRestoreError(undefined);
    try {
      const result = await execOp('restorePoints.restore', {
        snapshot_id: restoring.id,
        confirm_site_name: confirmName,
      });
      let status = result?.restore as RestoreStatus | undefined;
      while (status?.status === 'running') {
        await wait(RESTORE_POLL_MS);
        const polled = await queryOp('restorePoints.restoreStatus', {
          snapshot_id: status.snapshotId,
          restore_id: status.id,
        });
        status = polled?.restore as RestoreStatus | undefined;
      }
      if (status?.status !== 'ready') throw new Error(status?.error?.message || 'The restore did not finish.');
      setRestored(restoring.label);
      setRestoring(null);
      showToast(`Site restored to "${restoring.label}"`, 'success');
      await load();
    } catch (restoreFailure) {
      setRestoreError(errorMessage(restoreFailure, 'The restore failed.'));
    } finally {
      setRestoreBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await execOp('restorePoints.delete', { snapshot_id: deleting.id });
      setDeleting(null);
      await load();
    } catch (deleteError) {
      setDeleting(null);
      setError(errorMessage(deleteError, 'Could not delete the restore point.'));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <Card data-restore-points>
      <CardHeader>
        <CardTitle>Restore points</CardTitle>
        <CardDescription>
          A restore point saves the whole site: pages, blocks, settings, events and members. Kychon takes one before
          engine upgrades and before an AI assistant changes the site; take your own before a big change.
          {canRestore
            ? ' Restoring one replaces everything changed since, and takes a restore point first so you can undo it.'
            : ' Only the site owner can restore one.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {restored ? (
          <Alert>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              The site was restored to "{restored}". Reload to see it.
              <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void create(event)}>
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor={labelId}>Label</Label>
            <Input
              id={labelId}
              maxLength={120}
              placeholder="Before spring redesign"
              value={label}
              onChange={(event) => setLabel(event.currentTarget.value)}
            />
          </div>
          <Button type="submit" disabled={creating || !label.trim()}>
            {creating ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}
            Create restore point
          </Button>
        </form>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading restore points</p>
        ) : points.length === 0 ? (
          <p className="text-sm text-muted-foreground">No restore points yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restore point</TableHead>
                <TableHead>Taken</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point) => (
                <TableRow key={point.id} data-restore-point={point.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {point.reason === 'before_restore' ? <History aria-hidden="true" className="size-4" /> : null}
                      {point.label}
                      {point.status !== 'ready' ? <Badge variant="secondary">{point.status}</Badge> : null}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {REASONS[point.reason] ?? point.reason}
                      {point.createdBy ? ` · ${point.createdBy}` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatTime(point.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {canRestore && point.status === 'ready' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRestoring(point);
                            setConfirmName('');
                            setRestoreError(undefined);
                          }}
                        >
                          <RotateCcw aria-hidden="true" />
                          Restore
                        </Button>
                      ) : null}
                      {point.deletable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete restore point ${point.label}`}
                          onClick={() => setDeleting(point)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={restoring !== null} onOpenChange={(open) => !open && !restoreBusy && setRestoring(null)}>
        <DialogContent>
          <form className="space-y-4" onSubmit={(event) => void restore(event)}>
            <DialogHeader>
              <DialogTitle>Restore "{restoring?.label}"?</DialogTitle>
              <DialogDescription>
                The whole site goes back to how it was on {restoring ? formatTime(restoring.createdAt) : ''}. Every change
                made since is replaced. A restore point of the site as it is now is taken first, so you can undo this.
              </DialogDescription>
            </DialogHeader>
            {restoreError ? (
              <Alert variant="destructive">
                <AlertDescription>{restoreError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={confirmId}>Type the site name, {siteName}, to confirm</Label>
              <Input
                id={confirmId}
                autoComplete="off"
                value={confirmName}
                onChange={(event) => setConfirmName(event.currentTarget.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={restoreBusy} onClick={() => setRestoring(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={restoreBusy || !sameName(confirmName, siteName)}>
                {restoreBusy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RotateCcw aria-hidden="true" />}
                {restoreBusy ? 'Restoring' : 'Restore site'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && !deleteBusy && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleting?.label}"?</DialogTitle>
            <DialogDescription>The site can no longer be restored to this point.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleteBusy} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={deleteBusy} onClick={() => void remove()}>
              {deleteBusy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
