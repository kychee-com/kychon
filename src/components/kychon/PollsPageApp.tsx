'use client';

import { Check, Circle, CircleDot, Loader2, Plus, Square, SquareCheck, Trash2 } from 'lucide-react';
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
import { del, getPollOptions, getPolls, getPollVotes, patch, post } from '@/lib/api';
import { getSession, isAdmin, isAuthenticated } from '@/lib/auth';
import { openAuthModal } from '@/lib/auth-modal-events';
import { getConfig, isFeatureEnabled, ready, refreshMemberRecord } from '@/lib/config';
import { showToast } from '@/lib/toast-events';
import type { Poll, PollOption, PollVote } from '@/schemas/poll';

type PollFormType = 'single' | 'multiple';
type PollResultsVisibility = 'always' | 'after_vote' | 'after_close';

interface PollCardData {
  poll: Poll;
  options: PollOption[];
  votes: PollVote[];
}

interface PollFormState {
  question: string;
  description: string;
  pollType: PollFormType;
  isAnonymous: boolean;
  resultsVisible: PollResultsVisibility;
  closesAt: string;
  options: string[];
}

const EMPTY_FORM: PollFormState = {
  question: '',
  description: '',
  pollType: 'single',
  isAnonymous: false,
  resultsVisible: 'after_vote',
  closesAt: '',
  options: ['', ''],
};

function sameId(left: number | string | null | undefined, right: number | string | null | undefined): boolean {
  if (left == null || right == null) return left == null && right == null;
  return String(left) === String(right);
}

function sessionLooksSignedIn(session: any): boolean {
  return !!(session?.access_token || session?.user);
}

function memberIdFromSession(session: any): number | string | null {
  return session?.user?.member?.id ?? null;
}

function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'permission.denied';
}

function pollIsExpired(poll: Poll): boolean {
  return poll.closes_at ? new Date(poll.closes_at) <= new Date() : false;
}

function pollIsClosed(poll: Poll): boolean {
  return !poll.is_open || pollIsExpired(poll);
}

function closeDateLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function voteCountsFor(options: PollOption[], votes: PollVote[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const option of options) counts.set(option.id, 0);
  for (const vote of votes) counts.set(vote.option_id, (counts.get(vote.option_id) || 0) + 1);
  return counts;
}

async function autoCloseIfNeeded(poll: Poll): Promise<Poll> {
  if (!poll.is_open || !poll.closes_at || new Date(poll.closes_at) > new Date()) return poll;
  try {
    await patch(`polls?id=eq.${poll.id}`, { is_open: false });
    return { ...poll, is_open: false };
  } catch {
    return poll;
  }
}

async function hydratePollCard(row: Poll): Promise<PollCardData> {
  const poll = await autoCloseIfNeeded(row);
  const [options, votes] = await Promise.all([getPollOptions(poll.id), getPollVotes(poll.id)]);
  return { poll, options, votes };
}

async function loadPollCardById(pollId: number): Promise<PollCardData | null> {
  const [row] = await getPolls(`id=eq.${pollId}`);
  return row ? hydratePollCard(row) : null;
}

function normalizeOptions(options: string[]): string[] {
  return options.map((option) => option.trim()).filter(Boolean);
}

function parseClosesAt(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error('Use a valid close date, or leave it blank.');
  return parsed.toISOString();
}

function PollResults({
  options,
  votes,
  myVotes,
}: {
  options: PollOption[];
  votes: PollVote[];
  myVotes: PollVote[];
}) {
  const totalVotes = votes.length;
  const counts = useMemo(() => voteCountsFor(options, votes), [options, votes]);

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const count = counts.get(option.id) || 0;
        const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const selected = myVotes.some((vote) => sameId(vote.option_id, option.id));
        return (
          <div key={option.id} className="space-y-2 rounded-md border border-border bg-background p-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                <span className="min-w-0 break-words text-sm font-medium">{option.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">{percent}%</Badge>
                <span className="text-xs text-muted-foreground">{count}</span>
              </div>
            </div>
            <div
              aria-label={`${option.label}: ${percent}%`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={percent}
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PollVoteOptions({
  poll,
  options,
  myVotes,
  votingKey,
  onVote,
}: {
  poll: Poll;
  options: PollOption[];
  myVotes: PollVote[];
  votingKey: string;
  onVote: (poll: Poll, option: PollOption) => void;
}) {
  const multiple = poll.poll_type === 'multiple';

  return (
    <div className="space-y-2">
      {options.map((option) => {
        const selected = myVotes.some((vote) => sameId(vote.option_id, option.id));
        const busy = votingKey === `${poll.id}:${option.id}`;
        return (
          <Button
            className="h-auto min-h-11 w-full justify-start whitespace-normal px-3 py-2 text-left"
            disabled={!!votingKey}
            key={option.id}
            onClick={() => onVote(poll, option)}
            type="button"
            variant={selected ? 'secondary' : 'outline'}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : multiple ? (
              selected ? (
                <SquareCheck className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )
            ) : selected ? (
              <CircleDot className="h-4 w-4" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
            <span className="min-w-0 break-words">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

function PollReadonlyOptions({ options }: { options: PollOption[] }) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <div key={option.id} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          {option.label}
        </div>
      ))}
    </div>
  );
}

function PollCard({
  data,
  admin,
  votingKey,
  onVote,
  onToggleOpen,
  onDelete,
}: {
  data: PollCardData;
  admin: boolean;
  votingKey: string;
  onVote: (poll: Poll, option: PollOption) => void;
  onToggleOpen: (poll: Poll) => void;
  onDelete: (poll: Poll) => void;
}) {
  const { poll, options, votes } = data;
  const session = getSession();
  const memberId = memberIdFromSession(session);
  const signedIn = sessionLooksSignedIn(session);
  const closed = pollIsClosed(poll);
  const myVotes = memberId != null ? votes.filter((vote) => sameId(vote.member_id, memberId)) : [];
  const hasVoted = myVotes.length > 0;
  const showResults = poll.results_visible === 'after_close' ? closed && hasVoted : hasVoted;
  const canVote = signedIn && !closed;
  const meta = [
    showResults ? `${votes.length} vote${votes.length === 1 ? '' : 's'}` : '',
    poll.closes_at && !closed ? `Closes ${closeDateLabel(poll.closes_at)}` : '',
    closed ? 'Closed' : '',
    poll.is_anonymous ? 'Anonymous' : '',
    poll.poll_type === 'multiple' ? 'Select multiple' : 'Single choice',
    poll.results_visible === 'after_close' && !closed && !showResults ? 'Results after close' : '',
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <CardTitle className="break-words text-lg leading-6">{poll.question}</CardTitle>
            {poll.description ? <CardDescription className="break-words">{poll.description}</CardDescription> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canVote ? (
          <PollVoteOptions myVotes={myVotes} onVote={onVote} options={options} poll={poll} votingKey={votingKey} />
        ) : !showResults ? (
          <PollReadonlyOptions options={options} />
        ) : null}
        {showResults ? (
          <PollResults myVotes={myVotes} options={options} votes={votes} />
        ) : null}
        <div className="flex flex-wrap gap-2">
          {meta.map((item) => (
            <Badge key={item} variant="outline">
              {item}
            </Badge>
          ))}
        </div>
      </CardContent>
      {admin ? (
        <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => onToggleOpen(poll)} type="button" variant="secondary">
            {poll.is_open && !closed ? 'Close Poll' : 'Reopen Poll'}
          </Button>
          <Button onClick={() => onDelete(poll)} type="button" variant="destructive">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function CreatePollDialog({
  open,
  creating,
  form,
  onOpenChange,
  onFormChange,
  onSubmit,
}: {
  open: boolean;
  creating: boolean;
  form: PollFormState;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: PollFormState) => void;
  onSubmit: () => void;
}) {
  function updateOption(index: number, value: string) {
    onFormChange({
      ...form,
      options: form.options.map((option, optionIndex) => (optionIndex === index ? value : option)),
    });
  }

  function removeOption(index: number) {
    if (form.options.length <= 2) return;
    onFormChange({ ...form, options: form.options.filter((_, optionIndex) => optionIndex !== index) });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Poll</DialogTitle>
          <DialogDescription>Ask members a question and choose when results become visible.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="poll-question">Question</Label>
            <Input
              id="poll-question"
              name="poll_question"
              onChange={(event) => onFormChange({ ...form, question: event.target.value })}
              placeholder="What do you want to ask?"
              required
              value={form.question}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="poll-description">Description</Label>
            <Textarea
              id="poll-description"
              name="poll_description"
              onChange={(event) => onFormChange({ ...form, description: event.target.value })}
              placeholder="Add optional context for members."
              value={form.description}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium" id="poll-type-label">
                Type
              </div>
              <Select
                name="poll_type"
                onValueChange={(value) => onFormChange({ ...form, pollType: value as PollFormType })}
                value={form.pollType}
              >
                <SelectTrigger aria-labelledby="poll-type-label" id="poll-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single choice</SelectItem>
                  <SelectItem value="multiple">Multiple choice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium" id="poll-results-visible-label">
                Results
              </div>
              <Select
                name="poll_results_visible"
                onValueChange={(value) => onFormChange({ ...form, resultsVisible: value as PollResultsVisibility })}
                value={form.resultsVisible}
              >
                <SelectTrigger aria-labelledby="poll-results-visible-label" id="poll-results-visible">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="after_vote">After voting</SelectItem>
                  <SelectItem value="always">Always visible</SelectItem>
                  <SelectItem value="after_close">After close</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="poll-closes-at">Closes at</Label>
              <Input
                aria-label="Poll closes at"
                id="poll-closes-at"
                name="poll_closes_at"
                onChange={(event) => onFormChange({ ...form, closesAt: event.target.value })}
                placeholder="2026-06-30 18:00"
                value={form.closesAt}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium" id="poll-anonymous-label">
                Anonymous poll
              </div>
              <Button
                aria-labelledby="poll-anonymous-label"
                aria-pressed={form.isAnonymous}
                className="w-full justify-start"
                id="poll-anonymous"
                onClick={() => onFormChange({ ...form, isAnonymous: !form.isAnonymous })}
                type="button"
                variant={form.isAnonymous ? 'secondary' : 'outline'}
              >
                {form.isAnonymous ? <SquareCheck className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                Anonymous poll
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Options</div>
              <Button
                onClick={() => onFormChange({ ...form, options: [...form.options, ''] })}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Plus className="h-4 w-4" />
                Add option
              </Button>
            </div>
            <div className="space-y-2">
              {form.options.map((option, index) => (
                <div className="flex gap-2" key={index}>
                  <div className="min-w-0 flex-1">
                    <Label className="sr-only" htmlFor={`poll-option-${index + 1}`}>
                      Option {index + 1}
                    </Label>
                    <Input
                      id={`poll-option-${index + 1}`}
                      name={`poll_option_${index + 1}`}
                      onChange={(event) => updateOption(index, event.target.value)}
                      placeholder={`Option ${index + 1}`}
                      required={index < 2}
                      value={option}
                    />
                  </div>
                  <Button
                    aria-label={`Remove option ${index + 1}`}
                    disabled={form.options.length <= 2}
                    onClick={() => removeOption(index)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button disabled={creating} onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={creating} onClick={onSubmit} type="button">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create Poll
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PollsPageApp() {
  const [polls, setPolls] = useState<PollCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PollFormState>(EMPTY_FORM);
  const [votingKey, setVotingKey] = useState('');
  const [updatingPollId, setUpdatingPollId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Poll | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPolls = useCallback(async () => {
    setLoading(true);
    setError('');
    setAccessBlocked(false);

    try {
      await ready;
      await refreshMemberRecord();
      const enabled = isFeatureEnabled('feature_polls');
      setFeatureEnabled(enabled);
      const signedIn = isAuthenticated();
      const currentAdmin = isAdmin();
      setAuthenticated(signedIn);
      setAdmin(currentAdmin);
      setCanCreate((currentAdmin || getConfig('polls_member_create') === true) && signedIn);

      if (!enabled) {
        setPolls([]);
        return;
      }

      const rows = await getPolls('attached_to=is.null&order=is_open.desc,created_at.desc');
      const hydrated = await Promise.all(rows.map(hydratePollCard));
      setPolls(hydrated);
    } catch (loadError) {
      if (isPermissionDenied(loadError)) {
        setAccessBlocked(true);
      } else {
        setError(loadError instanceof Error ? loadError.message : 'Could not load polls.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPolls();
    document.addEventListener('wl-auth-changed', loadPolls);
    document.addEventListener('wl-locale-changed', loadPolls);
    return () => {
      document.removeEventListener('wl-auth-changed', loadPolls);
      document.removeEventListener('wl-locale-changed', loadPolls);
    };
  }, [loadPolls]);

  async function submitVote(poll: Poll, option: PollOption) {
    const session = getSession();
    if (!sessionLooksSignedIn(session)) {
      showToast('Sign in as a member to vote.', 'warning');
      openAuthModal({ mode: 'sign-in' });
      return;
    }

    setVotingKey(`${poll.id}:${option.id}`);
    try {
      await post('poll_votes', { poll_id: poll.id, option_id: option.id });
      const updated = await loadPollCardById(poll.id);
      if (updated) {
        setPolls((current) => current.map((item) => (item.poll.id === poll.id ? updated : item)));
      }
      showToast('Vote recorded', 'success');
    } catch (voteError) {
      showToast(isPermissionDenied(voteError) ? 'Active member access is required to vote.' : 'Could not record your vote.', 'error');
    } finally {
      setVotingKey('');
    }
  }

  async function togglePollOpen(poll: Poll) {
    setUpdatingPollId(poll.id);
    try {
      await patch(`polls?id=eq.${poll.id}`, { is_open: !poll.is_open });
      await loadPolls();
    } catch (updateError) {
      showToast(updateError instanceof Error ? updateError.message : 'Could not update poll.', 'error');
    } finally {
      setUpdatingPollId(null);
    }
  }

  async function deletePoll() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await del(`polls?id=eq.${deleteTarget.id}`);
      setPolls((current) => current.filter(({ poll }) => poll.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast('Poll deleted', 'success');
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : 'Could not delete poll.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function submitCreate() {
    const options = normalizeOptions(form.options);
    if (!form.question.trim() || options.length < 2) {
      showToast('Please fill in the question and at least 2 options.', 'warning');
      return;
    }
    if (!getSession()) {
      showToast('Sign in as a member to create polls.', 'warning');
      openAuthModal({ mode: 'sign-in' });
      return;
    }

    let closesAt: string | null;
    try {
      closesAt = parseClosesAt(form.closesAt);
    } catch (parseError) {
      showToast(parseError instanceof Error ? parseError.message : 'Use a valid close date, or leave it blank.', 'warning');
      return;
    }

    setCreating(true);
    try {
      const [created] = await post('polls', {
        question: form.question.trim(),
        description: form.description.trim() || null,
        poll_type: form.pollType,
        is_anonymous: form.isAnonymous,
        results_visible: form.resultsVisible,
        closes_at: closesAt,
        options: options.map((label) => ({ label })),
      });
      await post('activity_log', {
        action: 'poll_create',
        metadata: { poll_id: created?.id, question: form.question.trim() },
      });
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      showToast('Poll created', 'success');
      await loadPolls();
    } catch (createError) {
      showToast(isPermissionDenied(createError) ? 'Active member access is required to create polls.' : 'Failed to create poll.', 'error');
    } finally {
      setCreating(false);
    }
  }

  const emptyMessage = useMemo(() => {
    if (!featureEnabled) return 'Polls are not enabled for this site.';
    if (loading) return '';
    return 'No polls yet.';
  }, [featureEnabled, loading]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Polls</h2>
          <p className="text-sm text-muted-foreground">Vote in member polls and review open questions.</p>
        </div>
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)} type="button">
            <Plus className="h-4 w-4" />
            Create Poll
          </Button>
        ) : null}
      </div>

      {accessBlocked ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {authenticated ? 'Active member access is required to view polls.' : 'Sign in as a member to view polls.'}
            </p>
            {!authenticated ? (
              <Button onClick={() => openAuthModal({ mode: 'sign-in' })} type="button">
                Sign in
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="space-y-3" role="status">
          <Card>
            <CardHeader>
              <div className="h-5 w-2/3 rounded-md bg-muted" />
              <div className="h-4 w-1/2 rounded-md bg-muted" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-10 rounded-md bg-muted" />
              <div className="h-10 rounded-md bg-muted" />
            </CardContent>
          </Card>
        </div>
      ) : !accessBlocked && polls.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</CardContent>
        </Card>
      ) : null}

      {!loading && !accessBlocked && polls.length > 0 ? (
        <div className="space-y-4">
          {polls.map((pollData) => (
            <div aria-busy={updatingPollId === pollData.poll.id} key={pollData.poll.id}>
              <PollCard
                admin={admin}
                data={pollData}
                onDelete={setDeleteTarget}
                onToggleOpen={togglePollOpen}
                onVote={submitVote}
                votingKey={votingKey}
              />
            </div>
          ))}
        </div>
      ) : null}

      <CreatePollDialog
        creating={creating}
        form={form}
        onFormChange={setForm}
        onOpenChange={setCreateOpen}
        onSubmit={submitCreate}
        open={createOpen}
      />

      <Dialog onOpenChange={(open) => !open && setDeleteTarget(null)} open={!!deleteTarget}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete poll?</DialogTitle>
            <DialogDescription>
              This removes the poll and its votes. Members will no longer see this question.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={deleting} onClick={() => setDeleteTarget(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={deleting} onClick={deletePoll} type="button" variant="destructive">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
