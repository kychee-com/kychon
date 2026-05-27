'use client';

import { Lock, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/kychon/ui';
import { getMemberTiers, getMembers } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { openAuthModal } from '@/lib/auth-modal-events';
import { getConfig, ready } from '@/lib/config';
import type { Member, MemberTier } from '@/schemas/member';

const ALL_TIERS = 'all';

interface DirectoryMember extends Member {
  tier_name?: string;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string): string {
  return (name.trim()[0] || '?').toUpperCase();
}

function visibleCustomFields(member: DirectoryMember): Array<[string, string]> {
  return Object.entries(member.custom_fields || {})
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .map(([key, value]) => [key, String(value)]);
}

interface DirectoryPageAppProps {
  /**
   * Pre-joined directory rows from the build-time SSR pass — see
   * `src/lib/build-members.ts` + `directory.astro`. Seeds `useState`
   * so the React island's first render matches the SSR HTML (no
   * skeleton flash). Background `load()` still runs to pick up admin
   * edits and member-gated rows visible only after sign-in.
   * Build-time fetch is **gated on `directory_public === true`** at
   * `directory.astro` — eagles/barrio (non-public dirs) pass
   * `undefined` here, and the island falls back to today's
   * skeleton → sign-in-gate → fetch path.
   */
  initialMembers?: DirectoryMember[];
  initialTiers?: MemberTier[];
}

export default function DirectoryPageApp({ initialMembers, initialTiers }: DirectoryPageAppProps = {}) {
  const [members, setMembers] = useState<DirectoryMember[]>(() => initialMembers ?? []);
  const [tiers, setTiers] = useState<MemberTier[]>(() => initialTiers ?? []);
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState(ALL_TIERS);
  const [selectedMember, setSelectedMember] = useState<DirectoryMember | null>(null);
  const [loading, setLoading] = useState(() => !initialMembers);
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Don't unconditionally flip loading=true — keeps the SSR-baked
      // cards on screen during locale/auth refreshes; the first-mount
      // skeleton is still covered by the `useState` initializer for
      // `loading` when no `initialMembers` are present.
      setError('');
      await ready;

      const isPublic = getConfig('directory_public') === true;
      if (!isPublic && !isAuthenticated()) {
        if (!cancelled) {
          setRequiresSignIn(true);
          setLoading(false);
        }
        return;
      }

      try {
        const [tierRows, memberRows] = await Promise.all([
          getMemberTiers().catch(() => []),
          getMembers('status=eq.active&order=display_name.asc'),
        ]);
        if (cancelled) return;
        const tierMap = new Map(tierRows.map((tier) => [String(tier.id), tier.name]));
        setTiers(tierRows);
        setMembers(
          memberRows.map((member) => ({
            ...member,
            tier_name: member.tier_id != null ? tierMap.get(String(member.tier_id)) || '' : '',
          })),
        );
        setRequiresSignIn(false);
      } catch (loadError) {
        if (!cancelled) {
          setMembers([]);
          setError(loadError instanceof Error ? loadError.message : 'Could not load the member directory.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    document.addEventListener('wl-auth-changed', load);
    document.addEventListener('wl-locale-changed', load);
    return () => {
      cancelled = true;
      document.removeEventListener('wl-auth-changed', load);
      document.removeEventListener('wl-locale-changed', load);
    };
  }, []);

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      const matchesQuery = !needle ||
        member.display_name.toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle);
      const matchesTier = tierFilter === ALL_TIERS || String(member.tier_id) === tierFilter;
      return matchesQuery && matchesTier;
    });
  }, [members, query, tierFilter]);

  if (requiresSignIn) {
    return (
      <Card className="mx-auto max-w-lg text-center" role="status" aria-live="polite">
        <CardHeader className="items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <CardTitle>Sign in to view the directory</CardTitle>
          <CardDescription>Member details are available to signed-in members.</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center gap-2">
          <Button type="button" onClick={(event) => openAuthModal({ trigger: event.currentTarget })}>
            Sign in
          </Button>
          <Button asChild variant="outline">
            <a href="/">Back home</a>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-normal">Member Directory</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="dir-search"
              name="directory_search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search members..."
              className="pl-9"
              aria-label="Search members"
            />
          </div>
          <Select value={tierFilter} onValueChange={setTierFilter} name="directory_tier">
            <SelectTrigger id="dir-tier-filter" className="sm:w-48" aria-label="Filter by tier">
              <SelectValue placeholder="All tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TIERS}>All Tiers</SelectItem>
              {tiers.map((tier) => (
                <SelectItem key={tier.id} value={String(tier.id)}>
                  {tier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index}>
              <CardContent className="flex items-center gap-3 p-5">
                <div className="h-12 w-12 rounded-md bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">No members found.</CardContent>
        </Card>
      ) : null}

      {!loading && filteredMembers.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => (
            <Button
              aria-label={`View ${member.display_name}`}
              key={member.id}
              className="h-full w-full justify-start whitespace-normal rounded-lg border-border bg-card p-5 text-left text-card-foreground shadow hover:border-primary/60 hover:bg-accent/30 focus-visible:ring-offset-2"
              onClick={() => setSelectedMember(member)}
              type="button"
              variant="outline"
            >
              <span className="flex min-w-0 items-center gap-3">
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                    {initials(member.display_name)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{member.display_name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {member.tier_name ? <Badge variant="secondary">{member.tier_name}</Badge> : null}
                    <span>{formatDate(member.joined_at) ? `Joined ${formatDate(member.joined_at)}` : 'Member'}</span>
                  </span>
                </span>
              </span>
            </Button>
          ))}
        </div>
      ) : null}

      <Dialog open={selectedMember != null} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedMember ? (
            <>
              <DialogHeader className="items-center text-center">
                {selectedMember.avatar_url ? (
                  <img src={selectedMember.avatar_url} alt="" className="h-20 w-20 rounded-md object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-md bg-primary text-xl font-semibold text-primary-foreground">
                    {initials(selectedMember.display_name)}
                  </div>
                )}
                <DialogTitle>{selectedMember.display_name}</DialogTitle>
                <DialogDescription>
                  {selectedMember.tier_name || 'Member'}
                  {formatDate(selectedMember.joined_at) ? ` - Joined ${formatDate(selectedMember.joined_at)}` : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{selectedMember.bio || 'No bio yet.'}</p>
                {visibleCustomFields(selectedMember).length ? (
                  <div className="space-y-2">
                    {visibleCustomFields(selectedMember).map(([key, value]) => (
                      <div key={key} className="flex gap-2 text-sm">
                        <span className="font-medium text-foreground">{key}:</span>
                        <span className="text-muted-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
