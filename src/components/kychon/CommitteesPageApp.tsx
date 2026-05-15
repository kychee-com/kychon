'use client';

import { ArrowLeft, BriefcaseBusiness, Loader2, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/kychon/ui';
import { del, get, getCommittees, post } from '@/lib/api';
import { isAdmin, isAuthenticated } from '@/lib/auth';
import { openAuthModal } from '@/lib/auth-modal-events';
import { ready, translateItems } from '@/lib/config';
import { showToast } from '@/lib/toast-events';
import type { Committee, CommitteeMember } from '@/schemas/committee';
import type { Member } from '@/schemas/member';

type CommitteeMemberWithMember = CommitteeMember & {
  members?: {
    avatar_url?: string | null;
    display_name?: string | null;
  } | null;
};

interface CreateFormState {
  name: string;
  description: string;
}

const EMPTY_CREATE_FORM: CreateFormState = {
  name: '',
  description: '',
};

function currentCommitteeId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('id');
}

function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'permission.denied';
}

function memberName(member: CommitteeMemberWithMember): string {
  return member.members?.display_name || 'Member';
}

function roleVariant(role: string): 'default' | 'secondary' {
  return role === 'chair' ? 'secondary' : 'default';
}

function MemberAvatar({ member }: { member: CommitteeMemberWithMember }) {
  const name = memberName(member);
  if (member.members?.avatar_url) {
    return <img alt="" className="h-10 w-10 rounded-full object-cover" height={40} src={member.members.avatar_url} width={40} />;
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function MemberRequired({ subject }: { subject: string }) {
  const signedIn = isAuthenticated();
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {signedIn ? `Active member access is required to view ${subject}.` : `Sign in as a member to view ${subject}.`}
        </p>
        {!signedIn ? (
          <Button onClick={() => openAuthModal({ mode: 'sign-in' })} type="button">
            Sign in
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CreateCommitteeDialog({
  creating,
  form,
  onFormChange,
  onOpenChange,
  onSubmit,
  open,
}: {
  creating: boolean;
  form: CreateFormState;
  onFormChange: (form: CreateFormState) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Committee</DialogTitle>
          <DialogDescription>Add a group that can organize members and workstreams.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="committee-name">Name</Label>
            <Input id="committee-name" onChange={(event) => onFormChange({ ...form, name: event.target.value })} required value={form.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="committee-description">Description</Label>
            <Textarea
              id="committee-description"
              onChange={(event) => onFormChange({ ...form, description: event.target.value })}
              value={form.description}
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={creating} onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={creating} onClick={onSubmit} type="button">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommitteeList({
  admin,
  committees,
  countByCommittee,
  onCreate,
}: {
  admin: boolean;
  committees: Committee[];
  countByCommittee: Record<number, number>;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Committees</h2>
          <p className="text-sm text-muted-foreground">Browse member groups, working teams, and board committees.</p>
        </div>
        {admin ? (
          <Button onClick={onCreate} size="sm" type="button">
            <Plus className="h-4 w-4" />
            Create Committee
          </Button>
        ) : null}
      </div>

      {committees.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No committees yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {committees.map((committee) => (
            <Card className="h-full transition-colors hover:bg-accent/50" key={committee.id}>
              <a className="block h-full text-foreground no-underline" href={`/committees?id=${committee.id}`}>
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <BriefcaseBusiness className="h-5 w-5" />
                  </div>
                  <CardTitle className="break-words text-lg tracking-normal">{committee.name}</CardTitle>
                  {committee.description ? <CardDescription className="break-words">{committee.description}</CardDescription> : null}
                </CardHeader>
                <CardFooter>
                  <Badge>
                    <Users className="mr-1 h-3 w-3" />
                    {countByCommittee[committee.id] || 0} members
                  </Badge>
                </CardFooter>
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CommitteeDetail({
  activeMembers,
  admin,
  committee,
  memberAccessDenied,
  members,
  onAddMember,
  onBack,
  onDelete,
  onRemoveMember,
}: {
  activeMembers: Member[];
  admin: boolean;
  committee: Committee;
  memberAccessDenied: boolean;
  members: CommitteeMemberWithMember[];
  onAddMember: (memberId: string, role: string) => void;
  onBack: () => void;
  onDelete: () => void;
  onRemoveMember: (membershipId: number) => void;
}) {
  const [memberId, setMemberId] = useState('');
  const [role, setRole] = useState('member');

  useEffect(() => {
    setMemberId('');
    setRole('member');
  }, [committee.id]);

  return (
    <div className="space-y-6">
      <Button onClick={onBack} size="sm" type="button" variant="ghost">
        <ArrowLeft className="h-4 w-4" />
        All Committees
      </Button>

      <div className="space-y-2">
        <h2 className="break-words text-3xl font-semibold tracking-normal" data-editable={admin ? `committees.${committee.id}.name` : undefined}>
          {committee.name}
        </h2>
        <p className="break-words text-muted-foreground" data-editable={admin ? `committees.${committee.id}.description` : undefined}>
          {committee.description || ''}
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-xl font-semibold tracking-normal">Members ({members.length})</h3>
        {memberAccessDenied ? <MemberRequired subject="committee membership" /> : null}
        {!memberAccessDenied && members.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">No members assigned.</CardContent>
          </Card>
        ) : null}
        {members.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {members.map((member) => (
              <Card key={member.id} className="shadow-none">
                <CardContent className="flex items-center gap-3 p-4">
                  <MemberAvatar member={member} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{memberName(member)}</div>
                    <Badge variant={roleVariant(member.role)}>{member.role}</Badge>
                  </div>
                  {admin ? (
                    <Button onClick={() => onRemoveMember(member.id)} size="sm" type="button" variant="destructive">
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </section>

      {admin ? (
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg tracking-normal">Add Member</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger aria-label="Select member">
                  <SelectValue placeholder="Select member..." />
                </SelectTrigger>
                <SelectContent>
                  {activeMembers.map((member) => (
                    <SelectItem key={member.id} value={String(member.id)}>
                      {member.display_name || member.email || `Member ${member.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger aria-label="Committee role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="chair">Chair</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled={!memberId} onClick={() => onAddMember(memberId, role)} type="button">
                <UserPlus className="h-4 w-4" />
                Add
              </Button>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={onDelete} size="sm" type="button" variant="destructive">
              <Trash2 className="h-4 w-4" />
              Delete Committee
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function CommitteesPageApp() {
  const [committeeId, setCommitteeId] = useState<string | null>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [selectedCommittee, setSelectedCommittee] = useState<Committee | null>(null);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMemberWithMember[]>([]);
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [memberAccessDenied, setMemberAccessDenied] = useState(false);
  const [countByCommittee, setCountByCommittee] = useState<Record<number, number>>({});
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memberRequired, setMemberRequired] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setMemberRequired(false);
    setMemberAccessDenied(false);
    try {
      await ready;
      const nextId = currentCommitteeId();
      const nextAdmin = isAdmin();
      setCommitteeId(nextId);
      setAdmin(nextAdmin);

      if (!nextId) {
        const rows = await getCommittees();
        const translated = (await translateItems('committee', rows, ['name', 'description'])) as Committee[];
        setCommittees(translated);
        setSelectedCommittee(null);
        setCommitteeMembers([]);
        setActiveMembers([]);
        try {
          const members = (await get('committee_members?select=committee_id')) as CommitteeMember[];
          setCountByCommittee(
            members.reduce<Record<number, number>>((acc, member) => {
              acc[member.committee_id] = (acc[member.committee_id] || 0) + 1;
              return acc;
            }, {}),
          );
        } catch (countError) {
          if (!isPermissionDenied(countError)) throw countError;
          setCountByCommittee({});
        }
        return;
      }

      const rows = await get(`committees?id=eq.${encodeURIComponent(nextId)}&limit=1`);
      if (!rows.length) {
        setSelectedCommittee(null);
        setError('Committee not found.');
        return;
      }
      const [translatedCommittee] = (await translateItems('committee', [rows[0]], ['name', 'description'])) as Committee[];
      setSelectedCommittee(translatedCommittee);
      setCommittees([]);
      setCountByCommittee({});

      try {
        const members = (await get(`committee_members?committee_id=eq.${encodeURIComponent(nextId)}&select=*,members(display_name,avatar_url)`)) as CommitteeMemberWithMember[];
        setCommitteeMembers(members);
      } catch (membersError) {
        if (!isPermissionDenied(membersError)) throw membersError;
        setMemberAccessDenied(true);
        setCommitteeMembers([]);
      }

      setActiveMembers(nextAdmin ? ((await get('members?status=eq.active&order=display_name.asc')) as Member[]) : []);
    } catch (loadError) {
      if (isPermissionDenied(loadError)) {
        setMemberRequired(true);
      } else {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load committees.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('popstate', refresh);
    document.addEventListener('wl-locale-changed', refresh);
    document.addEventListener('wl-auth-changed', refresh);
    return () => {
      window.removeEventListener('popstate', refresh);
      document.removeEventListener('wl-locale-changed', refresh);
      document.removeEventListener('wl-auth-changed', refresh);
    };
  }, [load]);

  const title = useMemo(() => (committeeId ? selectedCommittee?.name || 'Committee' : 'Committees'), [committeeId, selectedCommittee]);

  function backToList() {
    window.history.pushState(null, '', '/committees');
    void load();
  }

  async function createCommittee() {
    if (!createForm.name.trim()) {
      showToast('Committee name is required.', 'warning');
      return;
    }
    setCreating(true);
    try {
      await post('committees', {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
      });
      setCreateForm(EMPTY_CREATE_FORM);
      setCreateOpen(false);
      showToast('Committee created', 'success');
      await load();
    } catch {
      showToast('Could not create committee', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function addMember(memberId: string, role: string) {
    if (!selectedCommittee || !memberId) return;
    try {
      await post('committee_members', {
        committee_id: selectedCommittee.id,
        member_id: Number(memberId),
        role,
      });
      showToast('Member added', 'success');
      await load();
    } catch {
      showToast('Could not add member', 'error');
    }
  }

  async function removeMember(membershipId: number) {
    try {
      await del(`committee_members?id=eq.${membershipId}`);
      showToast('Member removed', 'success');
      await load();
    } catch {
      showToast('Could not remove member', 'error');
    }
  }

  async function deleteCommittee() {
    if (!selectedCommittee) return;
    setDeleting(true);
    try {
      await del(`committees?id=eq.${selectedCommittee.id}`);
      showToast('Committee deleted', 'success');
      setDeleteOpen(false);
      setDeleting(false);
      backToList();
    } catch {
      showToast('Could not delete committee', 'error');
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="space-y-4" role="status">
          <div className="h-8 w-48 rounded-md bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Card key={item}>
                <CardHeader>
                  <div className="h-10 w-10 rounded-md bg-muted" />
                  <div className="h-5 w-2/3 rounded-md bg-muted" />
                  <div className="h-4 rounded-md bg-muted" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      ) : memberRequired ? (
        <MemberRequired subject={committeeId ? 'this committee' : 'committees'} />
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : committeeId && selectedCommittee ? (
        <CommitteeDetail
          activeMembers={activeMembers}
          admin={admin}
          committee={selectedCommittee}
          memberAccessDenied={memberAccessDenied}
          members={committeeMembers}
          onAddMember={(memberId, role) => void addMember(memberId, role)}
          onBack={backToList}
          onDelete={() => setDeleteOpen(true)}
          onRemoveMember={(membershipId) => void removeMember(membershipId)}
        />
      ) : (
        <CommitteeList admin={admin} committees={committees} countByCommittee={countByCommittee} onCreate={() => setCreateOpen(true)} />
      )}

      <CreateCommitteeDialog
        creating={creating}
        form={createForm}
        onFormChange={setCreateForm}
        onOpenChange={setCreateOpen}
        onSubmit={() => void createCommittee()}
        open={createOpen}
      />

      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {title}?</DialogTitle>
            <DialogDescription>This removes the committee from the portal.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={deleting} onClick={() => setDeleteOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={deleting} onClick={() => void deleteCommittee()} type="button" variant="destructive">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
