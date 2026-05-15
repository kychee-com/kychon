import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Check, Circle, CircleDot, Loader2, Square, SquareCheck } from 'lucide-react';

import { Alert, AlertDescription, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kychon/ui';
import { getPollOptions, getPolls, getPollVotes, patch, post } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { openAuthModal } from '@/lib/auth-modal-events';
import { showToast } from '@/lib/toast-events';
import type { Poll, PollOption, PollVote } from '@/schemas/poll';

interface PollsBlockConfig {
  heading?: string;
  poll_ids?: number[];
}

export interface PollCardData {
  poll: Poll;
  options: PollOption[];
  votes: PollVote[];
}

interface PollsBlockProps {
  config: PollsBlockConfig;
  headingEditablePath?: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; polls: PollCardData[] }
  | { status: 'error'; message: string };

const roots = new WeakMap<HTMLElement, Root>();

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

async function loadConfiguredPolls(pollIds: number[]): Promise<PollCardData[]> {
  const rows = await Promise.all(
    pollIds.map(async (pollId) => {
      try {
        const [row] = await getPolls(`id=eq.${pollId}`);
        if (!row) return null;
        const poll = await autoCloseIfNeeded(row);
        const [options, votes] = await Promise.all([getPollOptions(poll.id), getPollVotes(poll.id)]);
        return { poll, options, votes };
      } catch (error) {
        console.warn(`Failed to fetch poll ${pollId}:`, error);
        return null;
      }
    }),
  );
  return rows.filter((row): row is PollCardData => !!row);
}

function PollResults({ options, votes, myVotes }: { options: PollOption[]; votes: PollVote[]; myVotes: PollVote[] }) {
  const totalVotes = votes.length;
  const counts = React.useMemo(() => voteCountsFor(options, votes), [options, votes]);

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const count = counts.get(option.id) || 0;
        const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const selected = myVotes.some((vote) => sameId(vote.option_id, option.id));
        return (
          <div className="space-y-2 rounded-md border border-border bg-background p-3" key={option.id}>
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
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
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
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" key={option.id}>
          {option.label}
        </div>
      ))}
    </div>
  );
}

export function PollCard({
  data,
  votingKey,
  onVote,
}: {
  data: PollCardData;
  votingKey: string;
  onVote: (poll: Poll, option: PollOption) => void;
}) {
  const { poll, options, votes } = data;
  const session = getSession();
  const memberId = memberIdFromSession(session);
  const signedIn = sessionLooksSignedIn(session);
  const closed = pollIsClosed(poll);
  const myVotes = memberId != null ? votes.filter((vote) => sameId(vote.member_id, memberId)) : [];
  const hasVoted = myVotes.length > 0;
  const showResults =
    poll.results_visible === 'always' ||
    (poll.results_visible === 'after_vote' && hasVoted) ||
    (poll.results_visible === 'after_close' && closed);
  const canVote = signedIn && !closed && !showResults;
  const meta = [
    `${votes.length} vote${votes.length === 1 ? '' : 's'}`,
    poll.closes_at && !closed ? `Closes ${closeDateLabel(poll.closes_at)}` : '',
    closed ? 'Closed' : '',
    poll.is_anonymous ? 'Anonymous' : '',
    poll.poll_type === 'multiple' ? 'Select multiple' : 'Single choice',
    poll.results_visible === 'after_close' && !closed && !showResults ? 'Results after close' : '',
  ].filter(Boolean);

  return (
    <Card data-section-poll={poll.id}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <CardTitle className="break-words text-lg leading-6">{poll.question}</CardTitle>
            {poll.description ? <CardDescription className="break-words">{poll.description}</CardDescription> : null}
          </div>
          {closed ? <Badge variant="secondary">Closed</Badge> : <Badge>Open</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showResults ? (
          <PollResults myVotes={myVotes} options={options} votes={votes} />
        ) : canVote ? (
          <PollVoteOptions myVotes={myVotes} onVote={onVote} options={options} poll={poll} votingKey={votingKey} />
        ) : (
          <PollReadonlyOptions options={options} />
        )}
        <div className="flex flex-wrap gap-2">
          {meta.map((item) => (
            <Badge key={item} variant="outline">
              {item}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PollsBlockIsland({ config, headingEditablePath }: PollsBlockProps) {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });
  const [votingKey, setVotingKey] = React.useState('');
  const heading = String(config.heading || '').trim();
  const pollIds = React.useMemo(
    () => (Array.isArray(config.poll_ids) ? config.poll_ids.map(Number).filter((id) => Number.isFinite(id)) : []),
    [config.poll_ids],
  );

  const refresh = React.useCallback(async () => {
    if (pollIds.length === 0) {
      setState({ status: 'ready', polls: [] });
      return;
    }
    setState({ status: 'loading' });
    try {
      const polls = await loadConfiguredPolls(pollIds);
      setState({ status: 'ready', polls });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not load polls.' });
    }
  }, [pollIds]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

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
      showToast('Vote recorded', 'success');
      await refresh();
      document.dispatchEvent(new CustomEvent('wl-content-rendered'));
    } catch (error) {
      showToast(isPermissionDenied(error) ? 'Active member access is required to vote.' : 'Could not record your vote.', 'error');
    } finally {
      setVotingKey('');
    }
  }

  return (
    <div className="space-y-4" data-polls-block>
      {heading ? (
        <h2 className="text-2xl font-semibold tracking-normal" data-editable={headingEditablePath || undefined}>
          {heading}
        </h2>
      ) : null}

      {state.status === 'loading' ? (
        <Card role="status">
          <CardHeader>
            <div className="h-5 w-2/3 rounded-md bg-muted" />
            <div className="h-4 w-1/2 rounded-md bg-muted" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-10 rounded-md bg-muted" />
            <div className="h-10 rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : null}

      {state.status === 'error' ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === 'ready' && state.polls.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground" data-polls-empty>
            No polls to display.
          </CardContent>
        </Card>
      ) : null}

      {state.status === 'ready' && state.polls.length > 0 ? (
        <div className="space-y-4">
          {state.polls.map((pollData) => (
            <PollCard data={pollData} key={pollData.poll.id} onVote={submitVote} votingKey={votingKey} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function mountPollsBlockIsland(element: HTMLElement, props: PollsBlockProps): void {
  let root = roots.get(element);
  if (!root) {
    root = createRoot(element);
    roots.set(element, root);
  }
  root.render(<PollsBlockIsland {...props} />);
}
