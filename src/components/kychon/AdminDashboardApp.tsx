'use client';

import { KeyRound, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  Checkbox,
  Input,
  Label,
} from '@/components/kychon/ui';
import { AdminAccessGate, type AdminAccessState } from './AdminAccessGate';
import { count, get, patch } from '@/lib/api';
import {
  getCurrentUser,
  getSession,
  hasGoogleIdentity,
  hasPasswordSetMarker,
  isAdmin,
  passkeysSupported,
  registerPasskey,
  setPassword,
  signInWithGoogle,
} from '@/lib/auth';
import { isFeatureEnabled, ready, refreshMemberRecord } from '@/lib/config';
import {
  FRESH_START_CHECKLIST_ITEMS,
  FRESH_START_CHECKLIST_KEY,
  checklistProgress,
  dismissChecklist,
  normalizeChecklistState,
  shouldShowChecklist,
  toggleChecklistItem,
  type FreshStartChecklistState,
} from '@/lib/fresh-start-checklist';
import { showToast } from '@/lib/toast-events';
import { cn } from '@/lib/ui/cn';

interface DashboardStat {
  id: string;
  label: string;
  value: number;
}

interface AccountSecurityState {
  googleConnected: boolean;
  passkeyAvailable: boolean;
  hasCurrentPasskey: boolean;
  hasOtherPasskey: boolean;
  passwordSet: boolean;
  loaded: boolean;
}

interface ModerationItem {
  id: number;
  content_type: string;
  content_id: number;
  reason: string;
  confidence: number;
  preview: string;
}

interface ActivityItem {
  action?: string;
  created_at?: string;
  members?: {
    display_name?: string;
  };
}

const EMPTY_ACCOUNT_SECURITY: AccountSecurityState = {
  googleConnected: false,
  passkeyAvailable: false,
  hasCurrentPasskey: false,
  hasOtherPasskey: false,
  passwordSet: false,
  loaded: false,
};

function formatError(error: unknown, fallback = 'Something went wrong.'): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function thirtyDaysFromNow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

function passkeyStatusLabel(state: AccountSecurityState): string {
  if (!state.passkeyAvailable) return 'Unavailable';
  if (state.hasCurrentPasskey) return 'Added';
  if (state.hasOtherPasskey) return 'Not added on this domain';
  return 'Not added';
}

function statusTone(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'flagged' || status === 'hidden' || status === 'rejected') return 'destructive';
  if (status === 'approved') return 'secondary';
  return 'default';
}

function StatCard({ stat }: { stat: DashboardStat }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-3xl font-semibold tracking-normal">{stat.value}</div>
        <div className="text-sm text-muted-foreground">{stat.label}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ children }: { children: string }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export default function AdminDashboardApp() {
  const [accessState, setAccessState] = useState<AdminAccessState>('checking');
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [checklistState, setChecklistState] = useState<FreshStartChecklistState | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showAccountSecurity, setShowAccountSecurity] = useState(false);
  const [accountSecurity, setAccountSecurity] = useState<AccountSecurityState>(EMPTY_ACCOUNT_SECURITY);
  const [accountMessage, setAccountMessage] = useState('');
  const [accountTone, setAccountTone] = useState<'muted' | 'success' | 'error'>('muted');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [password, setPasswordValue] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [moderationEnabled, setModerationEnabled] = useState(false);
  const [moderationItems, setModerationItems] = useState<ModerationItem[]>([]);
  const [moderationLoaded, setModerationLoaded] = useState(false);
  const [moderationBusyId, setModerationBusyId] = useState<number | null>(null);
  const [moderationError, setModerationError] = useState('');

  const progress = useMemo(
    () => (checklistState ? checklistProgress(checklistState) : { completed: 0, total: FRESH_START_CHECKLIST_ITEMS.length, percent: 0 }),
    [checklistState],
  );

  function setSecurityMessage(message: string, tone: 'muted' | 'success' | 'error' = 'muted') {
    setAccountMessage(message);
    setAccountTone(tone);
  }

  async function saveFreshStartChecklist(nextState: FreshStartChecklistState) {
    await patch(`site_config?key=eq.${FRESH_START_CHECKLIST_KEY}`, {
      value: nextState,
      category: 'onboarding',
    });
  }

  async function loadFreshStartChecklist(): Promise<boolean> {
    try {
      const rows = await get(`site_config?key=eq.${FRESH_START_CHECKLIST_KEY}&limit=1`);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) {
        setChecklistState(null);
        setShowChecklist(false);
        return false;
      }

      const nextState = normalizeChecklistState(row.value);
      setChecklistState(nextState);
      setShowChecklist(shouldShowChecklist(nextState));
      return true;
    } catch {
      setChecklistState(null);
      setShowChecklist(false);
      return false;
    }
  }

  async function refreshAccountSecurity() {
    const session = getSession();
    const account = await getCurrentUser(window.location.origin).catch(() => null);
    const accountSession = account
      ? {
          ...session,
          user: {
            ...(session?.user || {}),
            identities: account.identities,
            has_passkeys: account.has_passkeys,
            passkey_count: account.passkey_count,
            has_passkey_for_current_rp: account.has_passkey_for_current_rp,
            has_password: account.has_password,
          },
        }
      : session;

    const passkeyCount = Number(account?.passkey_count || 0);
    setAccountSecurity({
      googleConnected: hasGoogleIdentity(accountSession),
      passkeyAvailable: passkeysSupported(),
      hasCurrentPasskey: account?.has_passkey_for_current_rp === true || (!account && passkeyCount > 0),
      hasOtherPasskey: passkeyCount > 0 && account?.has_passkey_for_current_rp === false,
      passwordSet: account?.has_password === true || hasPasswordSetMarker(),
      loaded: true,
    });
  }

  async function loadStats() {
    const statRequests: Array<{ id: string; label: string; promise: Promise<number> }> = [
      { id: 'active', label: 'Active Members', promise: count('members?status=eq.active').catch(() => 0) },
      { id: 'pending', label: 'Pending Approval', promise: count('members?status=eq.pending').catch(() => 0) },
      { id: 'announcements', label: 'Announcements', promise: count('announcements').catch(() => 0) },
      {
        id: 'expiring',
        label: 'Expiring (30d)',
        promise: count(`members?status=eq.active&expires_at=lt.${thirtyDaysFromNow()}`).catch(() => 0),
      },
    ];

    if (isFeatureEnabled('feature_events')) {
      statRequests.push({
        id: 'events',
        label: 'Upcoming Events',
        promise: count(`events?starts_at=gte.${new Date().toISOString()}`).catch(() => 0),
      });
    }
    if (isFeatureEnabled('feature_resources')) {
      statRequests.push({ id: 'resources', label: 'Resources', promise: count('resources').catch(() => 0) });
    }
    if (isFeatureEnabled('feature_forum')) {
      statRequests.push({ id: 'forum', label: 'Forum Topics', promise: count('forum_topics').catch(() => 0) });
    }

    const values = await Promise.all(statRequests.map((stat) => stat.promise));
    setStats(statRequests.map((stat, index) => ({ id: stat.id, label: stat.label, value: values[index] })));
  }

  async function loadActivity() {
    setActivityLoaded(false);
    try {
      const rows = await get('activity_log?order=created_at.desc&limit=20&select=*,members(display_name)');
      setActivity(Array.isArray(rows) ? rows : []);
    } catch {
      setActivity([]);
    } finally {
      setActivityLoaded(true);
    }
  }

  async function loadModerationQueue() {
    setModerationLoaded(false);
    setModerationError('');
    try {
      const flagged = await get('moderation_log?action=eq.flagged&reviewed_by=is.null&order=created_at.desc&limit=10');
      const items: ModerationItem[] = [];

      for (const item of Array.isArray(flagged) ? flagged : []) {
        let preview = '';
        if (item.content_type === 'forum_topic') {
          const topics = await get(`forum_topics?id=eq.${item.content_id}&select=title,body&limit=1`);
          preview = topics[0]?.title || `Topic #${item.content_id}`;
        } else if (item.content_type === 'forum_reply') {
          const replies = await get(`forum_replies?id=eq.${item.content_id}&select=body&limit=1`);
          preview = (replies[0]?.body || '').substring(0, 100);
        }

        items.push({ ...item, preview });
      }

      setModerationItems(items);
    } catch (error) {
      setModerationItems([]);
      setModerationError(formatError(error, 'Could not load moderation queue.'));
    } finally {
      setModerationLoaded(true);
    }
  }

  async function loadDashboard() {
    setLoading(true);
    setFatalError('');
    setAccessState('checking');

    try {
      await ready;
      await refreshMemberRecord();
      if (!isAdmin()) {
        setAccessState('denied');
        return;
      }

      setAccessState('allowed');

      const hasChecklist = await loadFreshStartChecklist();
      setShowAccountSecurity(hasChecklist);
      if (hasChecklist) await refreshAccountSecurity();

      const aiModerationEnabled = isFeatureEnabled('feature_ai_moderation');
      setModerationEnabled(aiModerationEnabled);

      await Promise.all([loadStats(), loadActivity(), aiModerationEnabled ? loadModerationQueue() : Promise.resolve()]);
    } catch (error) {
      setAccessState('allowed');
      setFatalError(formatError(error, 'Could not load the admin dashboard.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();

    const reload = () => void loadDashboard();
    document.addEventListener('wl-auth-changed', reload);
    document.addEventListener('wl-locale-changed', reload);
    return () => {
      document.removeEventListener('wl-auth-changed', reload);
      document.removeEventListener('wl-locale-changed', reload);
    };
  }, []);

  async function toggleChecklist(itemId: string, checked: boolean) {
    if (!checklistState) return;
    const nextState = toggleChecklistItem(checklistState, itemId, checked);
    setChecklistState(nextState);
    setShowChecklist(shouldShowChecklist(nextState));
    await saveFreshStartChecklist(nextState).catch(() => {
      showToast({ type: 'error', message: 'Checklist change could not be saved.' });
    });
  }

  async function hideChecklist() {
    if (!checklistState) return;
    const nextState = dismissChecklist(checklistState);
    setChecklistState(nextState);
    setShowChecklist(false);
    await saveFreshStartChecklist(nextState).catch(() => {
      showToast({ type: 'error', message: 'Checklist preference could not be saved.' });
    });
  }

  async function connectGoogle() {
    setSecurityMessage('');
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setSecurityMessage(formatError(error, 'Google could not be connected.'), 'error');
      setGoogleBusy(false);
    }
  }

  async function addPasskey() {
    setSecurityMessage('Opening passkey setup...');
    setPasskeyBusy(true);
    try {
      await registerPasskey();
      setSecurityMessage('Passkey added.', 'success');
      await refreshAccountSecurity();
    } catch (error) {
      setSecurityMessage(formatError(error, 'Passkey could not be added.'), 'error');
    } finally {
      setPasskeyBusy(false);
      await refreshAccountSecurity().catch(() => {});
    }
  }

  async function savePassword(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setSecurityMessage('Use at least 8 characters.', 'error');
      return;
    }
    if (password !== passwordConfirm) {
      setSecurityMessage('Passwords do not match.', 'error');
      return;
    }

    setPasswordBusy(true);
    try {
      await setPassword(password);
      setPasswordValue('');
      setPasswordConfirm('');
      setPasswordOpen(false);
      setSecurityMessage('Password saved.', 'success');
      await refreshAccountSecurity();
    } catch (error) {
      setSecurityMessage(formatError(error, 'Password could not be saved.'), 'error');
    } finally {
      setPasswordBusy(false);
    }
  }

  async function moderate(item: ModerationItem, action: 'approve' | 'reject') {
    setModerationBusyId(item.id);
    try {
      const memberId = getSession()?.user?.member?.id;
      if (action === 'approve') {
        const table = item.content_type === 'forum_topic' ? 'forum_topics' : 'forum_replies';
        await patch(`${table}?id=eq.${item.content_id}`, { hidden: false });
        await patch(`moderation_log?id=eq.${item.id}`, { action: 'approved', reviewed_by: memberId });
      } else {
        await patch(`moderation_log?id=eq.${item.id}`, { action: 'hidden', reviewed_by: memberId });
      }
      await loadModerationQueue();
    } catch (error) {
      showToast({ type: 'error', message: formatError(error, 'Moderation action failed.') });
    } finally {
      setModerationBusyId(null);
    }
  }

  if (accessState !== 'allowed') {
    return <AdminAccessGate state={accessState}>{null}</AdminAccessGate>;
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading dashboard...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertDescription>{fatalError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">Dashboard</h2>
      </div>

      {showAccountSecurity ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <Badge>Owner setup</Badge>
                <div>
                  <CardTitle>Secure your account</CardTitle>
                  <CardDescription>Use a trusted sign-in method before inviting members in.</CardDescription>
                </div>
              </div>
              {!accountSecurity.loaded ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border p-4">
                <div className="mb-3 flex items-start gap-3">
                  <UserCheck className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <div className="font-medium">Connect Google</div>
                    <div className="text-sm text-muted-foreground">
                      {accountSecurity.googleConnected ? 'Connected' : 'Not connected'}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={googleBusy || accountSecurity.googleConnected}
                  onClick={connectGoogle}
                >
                  {googleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {accountSecurity.googleConnected ? 'Connected' : 'Connect'}
                </Button>
              </div>

              <div className="rounded-md border border-border p-4">
                <div className="mb-3 flex items-start gap-3">
                  <KeyRound className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <div className="font-medium">Add a passkey</div>
                    <div className="text-sm text-muted-foreground">{passkeyStatusLabel(accountSecurity)}</div>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={passkeyBusy || !accountSecurity.passkeyAvailable}
                  onClick={addPasskey}
                >
                  {passkeyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {accountSecurity.hasCurrentPasskey ? 'Add another' : 'Add'}
                </Button>
              </div>

              <div className="rounded-md border border-border p-4">
                <div className="mb-3 flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <div className="font-medium">Set a password</div>
                    <div className="text-sm text-muted-foreground">
                      {accountSecurity.passwordSet ? 'Set' : 'Optional'}
                    </div>
                  </div>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={() => setPasswordOpen((open) => !open)}>
                  {accountSecurity.passwordSet ? 'Change' : 'Set'}
                </Button>
              </div>
            </div>

            {passwordOpen ? (
              <form className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={savePassword}>
                <div className="space-y-1.5">
                  <Label htmlFor="account-security-password">New password</Label>
                  <Input
                    id="account-security-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPasswordValue(event.currentTarget.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account-security-password-confirm">Confirm password</Label>
                  <Input
                    id="account-security-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.currentTarget.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" size="sm" disabled={passwordBusy}>
                    {passwordBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save password
                  </Button>
                </div>
              </form>
            ) : null}

            {accountMessage ? (
              <p
                className={cn(
                  'text-sm',
                  accountTone === 'success' && 'text-emerald-600 dark:text-emerald-400',
                  accountTone === 'error' && 'text-destructive',
                  accountTone === 'muted' && 'text-muted-foreground',
                )}
                aria-live="polite"
              >
                {accountMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {checklistState && showChecklist ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <Badge>First run</Badge>
                <div>
                  <CardTitle>Launch checklist</CardTitle>
                  <CardDescription>Work through the basics before inviting members in.</CardDescription>
                </div>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={hideChecklist}>
                Hide
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2" aria-live="polite">
              <div className="text-sm text-muted-foreground">
                {progress.completed} of {progress.total} complete
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>

            <div className="grid gap-2">
              {FRESH_START_CHECKLIST_ITEMS.map((item) => {
                const checked = checklistState.completed.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) => toggleChecklist(item.id, nextChecked === true)}
                      aria-label={item.label}
                    />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={item.href}>Open</a>
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      {moderationEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Moderation Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {moderationError ? (
              <Alert variant="destructive">
                <AlertDescription>{moderationError}</AlertDescription>
              </Alert>
            ) : null}
            {!moderationLoaded ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading moderation queue...
              </div>
            ) : moderationItems.length === 0 ? (
              <EmptyState>No flagged content.</EmptyState>
            ) : (
              moderationItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">{item.content_type}</Badge>
                      <span className="truncate text-sm">{item.preview}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Reason: {item.reason} ({Math.round(item.confidence * 100)}%)
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={moderationBusyId === item.id}
                      onClick={() => moderate(item, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={moderationBusyId === item.id}
                      onClick={() => moderate(item, 'reject')}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <a href="/admin-members">Manage Members</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/admin-settings">Site Settings</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/">View Site</a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {!activityLoaded ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading activity...
            </div>
          ) : activity.length === 0 ? (
            <EmptyState>No activity yet.</EmptyState>
          ) : (
            <div className="divide-y divide-border">
              {activity.map((item, index) => (
                <div key={`${item.created_at || 'activity'}-${index}`} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge variant={statusTone(item.action || '')}>{item.action || 'activity'}</Badge>
                  <span>{item.members?.display_name || 'Unknown'}</span>
                  <span className="ml-auto text-sm text-muted-foreground">{formatDate(item.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
