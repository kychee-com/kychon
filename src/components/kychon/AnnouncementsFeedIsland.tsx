import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Loader2, Pin, Plus, Trash2, X } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/kychon/ui';
import { PollCard, type PollCardData } from '@/components/kychon/PollsBlockIsland';
import { del, getAnnouncements, getPollOptions, getPolls, getPollVotes, patch, post } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { openAuthModal } from '@/lib/auth-modal-events';
import { translateItems } from '@/lib/config';
import { sanitizeRichHtml } from '@/lib/sanitize-html';
import { showToast } from '@/lib/toast-events';
import type { Announcement } from '@/schemas/content';
import type { Poll, PollOption } from '@/schemas/poll';

interface AnnouncementsFeedConfig {
  heading?: string;
  limit?: number;
}

interface AnnouncementsFeedProps {
  config: AnnouncementsFeedConfig;
  role?: string | null;
  pollsEnabled?: boolean;
  headingEditablePath?: string;
  /**
   * Pre-loaded announcement rows from the build-time SSR pass — see
   * `src/lib/build-announcements.ts` + `blocks.ts:ANNOUNCEMENTS_FEED.render`.
   * Seeds the `LoadState` initializer so the React island's first render
   * matches the SSR HTML (no skeleton flash). Polls land as `null` on
   * each card initially; the background `refresh()` in useEffect
   * resolves them per-card a moment later. Acceptable trade — most
   * announcements don't have polls, and the alternative is a full
   * skeleton flash on every page load.
   */
  initialAnnouncements?: Announcement[];
}

interface AnnouncementCardData {
  announcement: Announcement;
  poll: PollCardData | null;
}

interface PollFormState {
  question: string;
  options: string[];
  pollType: 'single' | 'multiple';
  isAnonymous: boolean;
  resultsVisible: 'always' | 'after_vote' | 'after_close';
  closesAt: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; announcements: AnnouncementCardData[] }
  | { status: 'error'; message: string };

const EMPTY_POLL_FORM: PollFormState = {
  question: '',
  options: ['', ''],
  pollType: 'single',
  isAnonymous: false,
  resultsVisible: 'after_vote',
  closesAt: '',
};

const roots = new WeakMap<HTMLElement, Root>();

function sessionLooksSignedIn(session: any): boolean {
  return !!(session?.access_token || session?.user);
}

function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'permission.denied';
}

function canReadMemberOnlyCapabilities(session: any, role: string | null | undefined): boolean {
  const member = session?.user?.member;
  return (
    role === 'admin' ||
    role === 'member' ||
    member?.status === 'active' ||
    (!member?.status && !!member?.id) ||
    !!session?.user
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

async function autoCloseIfNeeded(poll: Poll): Promise<Poll> {
  if (!poll.is_open || !poll.closes_at || new Date(poll.closes_at) > new Date()) return poll;
  try {
    await patch(`polls?id=eq.${poll.id}`, { is_open: false });
    return { ...poll, is_open: false };
  } catch {
    return poll;
  }
}

async function loadAttachedPoll(announcementId: number): Promise<PollCardData | null> {
  const [row] = await getPolls(`attached_to=eq.announcement&attached_id=eq.${announcementId}`);
  if (!row) return null;
  const poll = await autoCloseIfNeeded(row);
  const [options, votes] = await Promise.all([getPollOptions(poll.id), getPollVotes(poll.id)]);
  return { poll, options, votes };
}

async function loadPollCardById(pollId: number): Promise<PollCardData | null> {
  const [row] = await getPolls(`id=eq.${pollId}`);
  if (!row) return null;
  const poll = await autoCloseIfNeeded(row);
  const [options, votes] = await Promise.all([getPollOptions(poll.id), getPollVotes(poll.id)]);
  return { poll, options, votes };
}

function PollFields({
  form,
  onChange,
}: {
  form: PollFormState;
  onChange: (form: PollFormState) => void;
}) {
  function updateOption(index: number, value: string) {
    onChange({ ...form, options: form.options.map((option, optionIndex) => (optionIndex === index ? value : option)) });
  }

  function removeOption(index: number) {
    if (form.options.length <= 2) return;
    onChange({ ...form, options: form.options.filter((_, optionIndex) => optionIndex !== index) });
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
      <div className="space-y-2">
        <Label htmlFor="announcement-poll-question">Poll question</Label>
        <Input
          id="announcement-poll-question"
          onChange={(event) => onChange({ ...form, question: event.target.value })}
          placeholder="What do you want to ask?"
          value={form.question}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-medium" id="announcement-poll-type-label">
            Type
          </div>
          <Select onValueChange={(value) => onChange({ ...form, pollType: value as PollFormState['pollType'] })} value={form.pollType}>
            <SelectTrigger aria-labelledby="announcement-poll-type-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single choice</SelectItem>
              <SelectItem value="multiple">Multiple choice</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium" id="announcement-poll-results-label">
            Results
          </div>
          <Select
            onValueChange={(value) => onChange({ ...form, resultsVisible: value as PollFormState['resultsVisible'] })}
            value={form.resultsVisible}
          >
            <SelectTrigger aria-labelledby="announcement-poll-results-label">
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
          <Label htmlFor="announcement-poll-closes-at">Closes at</Label>
          <Input
            id="announcement-poll-closes-at"
            onChange={(event) => onChange({ ...form, closesAt: event.target.value })}
            placeholder="2026-06-30 18:00"
            value={form.closesAt}
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium" id="announcement-poll-anonymous-label">
            Anonymous poll
          </div>
          <Button
            aria-labelledby="announcement-poll-anonymous-label"
            aria-pressed={form.isAnonymous}
            className="w-full justify-start"
            onClick={() => onChange({ ...form, isAnonymous: !form.isAnonymous })}
            type="button"
            variant={form.isAnonymous ? 'secondary' : 'outline'}
          >
            {form.isAnonymous ? 'Anonymous' : 'Named responses'}
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Options</div>
          <Button onClick={() => onChange({ ...form, options: [...form.options, ''] })} size="sm" type="button" variant="secondary">
            <Plus className="h-4 w-4" />
            Add option
          </Button>
        </div>
        {form.options.map((option, index) => (
          <div className="flex gap-2" key={index}>
            <div className="min-w-0 flex-1">
              <Label className="sr-only" htmlFor={`announcement-poll-option-${index + 1}`}>
                Option {index + 1}
              </Label>
              <Input
                id={`announcement-poll-option-${index + 1}`}
                onChange={(event) => updateOption(index, event.target.value)}
                placeholder={`Option ${index + 1}`}
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
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateAnnouncementCard({
  pollsEnabled,
  posting,
  onCreate,
}: {
  pollsEnabled: boolean;
  posting: boolean;
  onCreate: (data: { title: string; body: string; poll: PollFormState | null }) => Promise<boolean>;
}) {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [addPoll, setAddPoll] = React.useState(false);
  const [pollForm, setPollForm] = React.useState<PollFormState>(EMPTY_POLL_FORM);

  async function submit() {
    const created = await onCreate({ title, body, poll: addPoll ? pollForm : null });
    if (!created) return;
    setTitle('');
    setBody('');
    setAddPoll(false);
    setPollForm(EMPTY_POLL_FORM);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">New Announcement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="announcement-title">Title</Label>
          <Input id="announcement-title" onChange={(event) => setTitle(event.target.value)} placeholder="Title" value={title} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="announcement-body">Body</Label>
          <Textarea
            id="announcement-body"
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write your announcement..."
            value={body}
          />
        </div>
        {pollsEnabled && addPoll ? <PollFields form={pollForm} onChange={setPollForm} /> : null}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-between">
        {pollsEnabled ? (
          <Button onClick={() => setAddPoll((value) => !value)} type="button" variant="secondary">
            {addPoll ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {addPoll ? 'Remove Poll' : 'Add Poll'}
          </Button>
        ) : (
          <span />
        )}
        <Button disabled={posting} onClick={submit} type="button">
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Post
        </Button>
      </CardFooter>
    </Card>
  );
}

function AnnouncementCard({
  data,
  admin,
  votingKey,
  onDelete,
  onTogglePin,
  onVote,
}: {
  data: AnnouncementCardData;
  admin: boolean;
  votingKey: string;
  onDelete: (announcement: Announcement) => void;
  onTogglePin: (announcement: Announcement) => void;
  onVote: (poll: Poll, option: PollOption) => void;
}) {
  const { announcement, poll } = data;

  return (
    <Card data-announcement-card={announcement.id}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <CardTitle className="break-words text-lg leading-6" data-editable={`announcements.${announcement.id}.title`}>
              {announcement.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {announcement.is_pinned ? <Badge>Pinned</Badge> : null}
              <span>{formatDate(announcement.created_at)}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="min-w-0 break-words text-sm leading-6 text-foreground [&_a]:text-primary [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc"
          data-editable-rich={`announcements.${announcement.id}.body`}
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(announcement.body) }}
        />
        {poll ? <PollCard data={poll} onVote={onVote} votingKey={votingKey} /> : null}
      </CardContent>
      {admin ? (
        <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => onTogglePin(announcement)} type="button" variant="secondary">
            <Pin className="h-4 w-4" />
            {announcement.is_pinned ? 'Unpin' : 'Pin'}
          </Button>
          <Button onClick={() => onDelete(announcement)} type="button" variant="destructive">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function initialAnnouncementState(initial: Announcement[] | undefined): LoadState {
  if (!initial) return { status: 'loading' };
  if (initial.length === 0) return { status: 'ready', announcements: [] };
  return {
    status: 'ready',
    announcements: initial.map((announcement) => ({ announcement, poll: null })),
  };
}

function AnnouncementsFeedIsland({ config, role, pollsEnabled = true, headingEditablePath, initialAnnouncements }: AnnouncementsFeedProps) {
  const [state, setState] = React.useState<LoadState>(() => initialAnnouncementState(initialAnnouncements));
  const [posting, setPosting] = React.useState(false);
  const [votingKey, setVotingKey] = React.useState('');
  const heading = String(config.heading || 'Announcements').trim();
  const limit = Number(config.limit || 20);
  const admin = role === 'admin';

  const refresh = React.useCallback(async () => {
    // Don't flip back to 'loading' if the SSR pass (or a previous refresh)
    // already produced 'ready' state — wiping to skeleton on every locale /
    // auth change would re-paint over the SSR-baked cards on every refresh.
    // The first-mount skeleton is still covered by the `useState` initializer.
    try {
      const items = await getAnnouncements(`order=is_pinned.desc,created_at.desc&limit=${Number.isFinite(limit) ? limit : 20}`);
      await translateItems('announcement', items, ['title', 'body']);
      const session = getSession();
      const canReadPolls = pollsEnabled && canReadMemberOnlyCapabilities(session, role);
      const announcements = await Promise.all(
        items.map(async (announcement) => {
          let poll: PollCardData | null = null;
          if (canReadPolls) {
            try {
              poll = await loadAttachedPoll(announcement.id);
            } catch (error) {
              console.warn(`Failed to fetch poll for announcement ${announcement.id}:`, error);
            }
          }
          return { announcement, poll };
        }),
      );
      setState({ status: 'ready', announcements });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not load announcements.' });
    }
  }, [limit, pollsEnabled, role]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createAnnouncement(data: { title: string; body: string; poll: PollFormState | null }): Promise<boolean> {
    const title = data.title.trim();
    const body = data.body.trim();
    if (!title || !body) {
      showToast('Please add a title and announcement body.', 'warning');
      return false;
    }

    let poll: Record<string, unknown> | null = null;
    if (data.poll) {
      const options = normalizeOptions(data.poll.options);
      if (!data.poll.question.trim() || options.length < 2) {
        showToast('Please fill in the poll question and at least 2 options.', 'warning');
        return false;
      }
      let closesAt: string | null;
      try {
        closesAt = parseClosesAt(data.poll.closesAt);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Use a valid close date, or leave it blank.', 'warning');
        return false;
      }
      poll = {
        question: data.poll.question.trim(),
        options,
        poll_type: data.poll.pollType,
        is_anonymous: data.poll.isAnonymous,
        results_visible: data.poll.resultsVisible,
        closes_at: closesAt,
      };
    }

    setPosting(true);
    try {
      await post('announcements', { title, body, ...(poll ? { poll } : {}) });
      showToast('Announcement posted', 'success');
      await refresh();
      return true;
    } catch (error) {
      showToast(isPermissionDenied(error) ? 'Admin access is required to post announcements.' : 'Could not post announcement.', 'error');
      return false;
    } finally {
      setPosting(false);
    }
  }

  async function togglePin(announcement: Announcement) {
    try {
      await patch(`announcements?id=eq.${announcement.id}`, { is_pinned: !announcement.is_pinned });
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update announcement.', 'error');
    }
  }

  async function deleteAnnouncement(announcement: Announcement) {
    try {
      await del(`polls?attached_to=eq.announcement&attached_id=eq.${announcement.id}`);
    } catch (error) {
      console.warn('Failed to delete attached poll:', error);
    }
    try {
      await del(`announcements?id=eq.${announcement.id}`);
      showToast('Announcement deleted', 'success');
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete announcement.', 'error');
    }
  }

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
        setState((current) =>
          current.status === 'ready'
            ? {
                status: 'ready',
                announcements: current.announcements.map((item) =>
                  item.poll?.poll.id === poll.id ? { ...item, poll: updated } : item,
                ),
              }
            : current,
        );
      }
      showToast('Vote recorded', 'success');
      document.dispatchEvent(new CustomEvent('wl-content-rendered'));
    } catch (error) {
      showToast(isPermissionDenied(error) ? 'Active member access is required to vote.' : 'Could not record your vote.', 'error');
    } finally {
      setVotingKey('');
    }
  }

  return (
    <div className="space-y-5" data-announcements-feed>
      {admin ? <CreateAnnouncementCard onCreate={createAnnouncement} pollsEnabled={pollsEnabled} posting={posting} /> : null}

      {heading ? (
        <h2
          className="text-2xl font-semibold tracking-normal"
          data-editable={headingEditablePath || undefined}
          id="announcements-title"
        >
          {heading}
        </h2>
      ) : null}

      {state.status === 'loading' ? (
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
      ) : null}

      {state.status === 'error' ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">{state.message}</CardContent>
        </Card>
      ) : null}

      {state.status === 'ready' && state.announcements.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground" data-announcements-empty>
            No announcements yet.
          </CardContent>
        </Card>
      ) : null}

      {state.status === 'ready' && state.announcements.length > 0 ? (
        <div className="space-y-4">
          {state.announcements.map((data) => (
            <AnnouncementCard
              admin={admin}
              data={data}
              key={data.announcement.id}
              onDelete={deleteAnnouncement}
              onTogglePin={togglePin}
              onVote={submitVote}
              votingKey={votingKey}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function mountAnnouncementsFeedIsland(element: HTMLElement, props: AnnouncementsFeedProps): void {
  let root = roots.get(element);
  if (!root) {
    root = createRoot(element);
    roots.set(element, root);
  }
  root.render(<AnnouncementsFeedIsland {...props} />);
}

/**
 * Build-time SSR: render the announcements-feed block to a plain HTML
 * string using the same React component the runtime island uses.
 * Called from `blocks.ts:ANNOUNCEMENTS_FEED.render` when
 * `getAllBuildAnnouncements()` returns a hit. Polls render as null on
 * each card (build-time has no per-user session); the runtime
 * `refresh()` resolves them after hydration.
 */
export function renderAnnouncementsFeedStaticHtml(props: {
  announcements: Announcement[];
  config: AnnouncementsFeedConfig;
  headingEditablePath?: string;
}): string {
  return renderToStaticMarkup(
    <AnnouncementsFeedIsland
      config={props.config}
      headingEditablePath={props.headingEditablePath}
      initialAnnouncements={props.announcements}
    />,
  );
}
