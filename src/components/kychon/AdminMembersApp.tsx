'use client';

import { Download, Loader2, ShieldCheck, ShieldOff, UserCheck } from 'lucide-react';
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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/kychon/ui';
import { revealAdminContent, showAdminAccessDenied } from '@/lib/admin-access';
import { get, patch } from '@/lib/api';
import { isAdmin } from '@/lib/auth';
import { ready, refreshMemberRecord } from '@/lib/config';
import { showToast } from '@/lib/toast-events';

interface Member {
  id: number | string;
  display_name?: string;
  email?: string;
  avatar_url?: string;
  status?: string;
  tier_id?: number | string | null;
  tier_name?: string;
  role?: string;
  joined_at?: string;
}

interface Tier {
  id: number | string;
  name: string;
}

const ALL = '__all';
const NO_TIER = '__none';
const STATUS_OPTIONS = [
  ['active', 'Active'],
  ['pending', 'Pending'],
  ['expired', 'Expired'],
  ['suspended', 'Suspended'],
] as const;

function formatError(error: unknown, fallback = 'Something went wrong.'): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function memberName(member: Member): string {
  return member.display_name?.trim() || member.email?.trim() || 'Unnamed member';
}

function memberInitial(member: Member): string {
  return memberName(member).slice(0, 1).toUpperCase() || '?';
}

function badgeVariant(status?: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'active') return 'secondary';
  if (status === 'pending') return 'outline';
  if (status === 'expired' || status === 'suspended' || status === 'rejected') return 'destructive';
  return 'default';
}

function csvCell(value: unknown): string {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

function buildMembersCsv(members: Member[]): string {
  const headers = ['display_name', 'email', 'status', 'role', 'tier', 'joined_at'];
  const rows = members.map((member) => [
    member.display_name,
    member.email,
    member.status,
    member.role,
    member.tier_name,
    member.joined_at,
  ]);
  return [headers.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
}

function csvHref(members: Member[]): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(buildMembersCsv(members))}`;
}

export default function AdminMembersApp() {
  const [members, setMembers] = useState<Member[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [tierFilter, setTierFilter] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const tierNameById = useMemo(() => new Map(tiers.map((tier) => [String(tier.id), tier.name])), [tiers]);
  const hydratedMembers = useMemo(
    () =>
      members.map((member) => ({
        ...member,
        tier_name: member.tier_id != null ? tierNameById.get(String(member.tier_id)) || member.tier_name || '' : '',
      })),
    [members, tierNameById],
  );
  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return hydratedMembers.filter((member) => {
      const matchesQuery =
        !normalizedQuery ||
        memberName(member).toLowerCase().includes(normalizedQuery) ||
        String(member.email || '').toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === ALL || member.status === statusFilter;
      const matchesTier = tierFilter === ALL || String(member.tier_id ?? NO_TIER) === tierFilter;
      return matchesQuery && matchesStatus && matchesTier;
    });
  }, [hydratedMembers, query, statusFilter, tierFilter]);

  async function loadMembers() {
    setFatalError('');
    const [memberRows, tierRows] = await Promise.all([
      get('members?order=created_at.desc'),
      get('membership_tiers?order=position.asc').catch(() => []),
    ]);
    setTiers(tierRows);
    setMembers(memberRows);
  }

  async function loadPage() {
    setLoading(true);
    setFatalError('');
    try {
      await ready;
      await refreshMemberRecord();
      if (!isAdmin()) {
        showAdminAccessDenied();
        return;
      }
      revealAdminContent();
      await loadMembers();
    } catch (error) {
      setFatalError(formatError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();

    const reload = () => void loadPage();
    document.addEventListener('wl-auth-changed', reload);
    document.addEventListener('wl-locale-changed', reload);
    return () => {
      document.removeEventListener('wl-auth-changed', reload);
      document.removeEventListener('wl-locale-changed', reload);
    };
  }, []);

  async function updateMember(member: Member, patchBody: Record<string, unknown>, key: string, successMessage: string) {
    setBusyKey(key);
    try {
      await patch(`members?id=eq.${member.id}`, patchBody);
      await loadMembers();
      showToast({ type: 'success', message: successMessage });
    } catch (error) {
      showToast({ type: 'error', message: formatError(error) });
    } finally {
      setBusyKey(null);
    }
  }

  async function updateStatus(member: Member, status: string, label: string) {
    await updateMember(member, { status }, `status:${member.id}:${status}`, `${memberName(member)} ${label}`);
  }

  async function updateTier(member: Member, value: string) {
    const tierId = value === NO_TIER ? null : Number(value);
    await updateMember(member, { tier_id: tierId }, `tier:${member.id}`, `${memberName(member)} tier updated`);
  }

  async function updateRole(member: Member, role: string) {
    await updateMember(member, { role }, `role:${member.id}`, `${memberName(member)} role updated`);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading members
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Members</h2>
          <p className="text-sm text-muted-foreground">{hydratedMembers.length} total member records</p>
        </div>
        <Button asChild variant="outline">
          <a href={csvHref(hydratedMembers)} download="members.csv">
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>

      {fatalError ? (
        <Alert variant="destructive">
          <AlertDescription>{fatalError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Directory Controls</CardTitle>
          <CardDescription>Filter, review, and update member access.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_12rem_12rem]">
            <div className="space-y-2">
              <Label htmlFor="member-search">Search</Label>
              <Input
                id="member-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="member-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {STATUS_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-tier-filter">Tier</Label>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger id="member-tier-filter">
                  <SelectValue placeholder="All tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All tiers</SelectItem>
                  <SelectItem value={NO_TIER}>No tier</SelectItem>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.id} value={String(tier.id)}>
                      {tier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Member List</CardTitle>
          <CardDescription>{filteredMembers.length} records shown</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[16rem] pl-6">Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="min-w-[22rem] pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        {member.avatar_url ? (
                          <img
                            className="h-9 w-9 rounded-full object-cover"
                            src={member.avatar_url}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                            {memberInitial(member)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{memberName(member)}</div>
                          <div className="truncate text-xs text-muted-foreground">{member.email || ''}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant(member.status)}>{member.status || 'unknown'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{member.tier_name || 'No tier'}</TableCell>
                    <TableCell className="capitalize">{member.role || 'member'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(member.joined_at)}</TableCell>
                    <TableCell className="pr-6">
                      <div className="flex flex-wrap items-center gap-2">
                        {member.status === 'pending' ? (
                          <Button
                            size="sm"
                            onClick={() => updateStatus(member, 'active', 'approved')}
                            disabled={busyKey === `status:${member.id}:active`}
                          >
                            {busyKey === `status:${member.id}:active` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                            Approve
                          </Button>
                        ) : null}
                        {member.status === 'active' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(member, 'suspended', 'suspended')}
                            disabled={busyKey === `status:${member.id}:suspended`}
                          >
                            {busyKey === `status:${member.id}:suspended` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldOff className="h-4 w-4" />
                            )}
                            Suspend
                          </Button>
                        ) : null}
                        {member.status === 'suspended' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(member, 'active', 'reactivated')}
                            disabled={busyKey === `status:${member.id}:active`}
                          >
                            {busyKey === `status:${member.id}:active` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-4 w-4" />
                            )}
                            Reactivate
                          </Button>
                        ) : null}
                        <Select
                          value={String(member.tier_id ?? NO_TIER)}
                          onValueChange={(value) => updateTier(member, value)}
                          disabled={busyKey === `tier:${member.id}`}
                        >
                          <SelectTrigger className="h-8 w-[9.5rem] text-xs" aria-label={`Tier for ${memberName(member)}`}>
                            <SelectValue placeholder="Tier" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_TIER}>No tier</SelectItem>
                            {tiers.map((tier) => (
                              <SelectItem key={tier.id} value={String(tier.id)}>
                                {tier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={member.role || 'member'}
                          onValueChange={(role) => updateRole(member, role)}
                          disabled={busyKey === `role:${member.id}`}
                        >
                          <SelectTrigger className="h-8 w-[8.5rem] text-xs" aria-label={`Role for ${memberName(member)}`}>
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="moderator">Moderator</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
