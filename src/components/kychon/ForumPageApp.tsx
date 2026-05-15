'use client';

import {
  ArrowLeft,
  Check,
  Circle,
  CircleDot,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MessageSquare,
  Pin,
  Plus,
  ShieldAlert,
  Square,
  SquareCheck,
  Trash2,
} from 'lucide-react';
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
import { del, get, getPollOptions, getPollVotes, patch, post } from '@/lib/api';
import { getSession, isAdmin, isAuthenticated } from '@/lib/auth';
import { openAuthModal } from '@/lib/auth-modal-events';
import { getConfig, isFeatureEnabled, ready, siteConfig, translateItems } from '@/lib/config';
import { showToast as showKychonToast, type KychonToastType } from '@/lib/toast-events';
import type { ForumCategory, ForumReply, ForumTopic } from '@/schemas/forum';
import type { Member } from '@/schemas/member';
import type { Poll, PollOption, PollVote } from '@/schemas/poll';

type ForumRoute = { view: 'categories' } | { view: 'category'; categoryId: string } | { view: 'topic'; topicId: string };
type TopicWithAuthor = ForumTopic & { author_avatar?: string | null };
type ReplyWithAuthor = ForumReply & { author_avatar?: string | null };
type PollFormType = 'single' | 'multiple';
type PollResultsVisibility = 'always' | 'after_vote' | 'after_close';

interface TopicFormState {
  title: string;
  body: string;
  poll: PollDraft;
}

interface PollDraft {
  enabled: boolean;
  question: string;
  description: string;
  pollType: PollFormType;
  isAnonymous: boolean;
  resultsVisible: PollResultsVisibility;
  closesAt: string;
  options: string[];
}

interface AttachedPoll {
  poll: Poll;
  options: PollOption[];
  votes: PollVote[];
}

type DeleteTarget = { kind: 'topic'; topic: TopicWithAuthor } | { kind: 'reply'; reply: ReplyWithAuthor } | null;

function emptyPollDraft(): PollDraft {
  return {
    enabled: false,
    question: '',
    description: '',
    pollType: 'single',
    isAnonymous: false,
    resultsVisible: 'after_vote',
    closesAt: '',
    options: ['', ''],
  };
}

function emptyTopicForm(): TopicFormState {
  return {
    title: '',
    body: '',
    poll: emptyPollDraft(),
  };
}

function currentForumRoute(): ForumRoute {
  if (typeof window === 'undefined') return { view: 'categories' };
  const params = new URLSearchParams(window.location.search);
  const topicId = params.get('topic');
  if (topicId) return { view: 'topic', topicId };
  const categoryId = params.get('cat');
  if (categoryId) return { view: 'category', categoryId };
  return { view: 'categories' };
}

function routePath(route: ForumRoute): string {
  if (route.view === 'topic') return `/forum?topic=${encodeURIComponent(route.topicId)}`;
  if (route.view === 'category') return `/forum?cat=${encodeURIComponent(route.categoryId)}`;
  return '/forum';
}

function sameId(left: number | string | null | undefined, right: number | string | null | undefined): boolean {
  if (left == null || right == null) return left == null && right == null;
  return String(left) === String(right);
}

function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'permission.denied';
}

function showForumToast(message: string, type: KychonToastType = 'info'): void {
  showKychonToast({ message, type });
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const timestamp = new Date(dateStr).getTime();
  if (Number.isNaN(timestamp)) return '';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function sessionLooksSignedIn(): boolean {
  const session = getSession();
  return !!(session?.access_token || session?.user);
}

function memberIdFromSession(): number | string | null {
  return getSession()?.user?.member?.id ?? null;
}

function closeDateLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function pollIsExpired(poll: Poll): boolean {
  return poll.closes_at ? new Date(poll.closes_at) <= new Date() : false;
}

function pollIsClosed(poll: Poll): boolean {
  return !poll.is_open || pollIsExpired(poll);
}

function voteCountsFor(options: PollOption[], votes: PollVote[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const option of options) counts.set(option.id, 0);
  for (const vote of votes) counts.set(vote.option_id, (counts.get(vote.option_id) || 0) + 1);
  return counts;
}

function normalizePollOptions(options: string[]): string[] {
  return options.map((option) => option.trim()).filter(Boolean);
}

function parseClosesAt(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error('Use a valid poll close date, or leave it blank.');
  return parsed.toISOString();
}

function pollPayloadFromDraft(draft: PollDraft) {
  if (!draft.enabled) return null;
  const question = draft.question.trim();
  const options = normalizePollOptions(draft.options);
  if (!question) throw new Error('Add a poll question, or remove the poll.');
  if (options.length < 2) throw new Error('Add at least two poll options.');
  return {
    question,
    description: draft.description.trim() || null,
    poll_type: draft.pollType,
    is_anonymous: draft.isAnonymous,
    results_visible: draft.resultsVisible,
    closes_at: parseClosesAt(draft.closesAt),
    options,
  };
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

async function enrichWithAvatars<T extends TopicWithAuthor | ReplyWithAuthor>(items: T[]): Promise<T[]> {
  const ids = Array.from(new Set(items.map((item) => item.author_id).filter((id): id is number => typeof id === 'number')));
  if (ids.length === 0) return items;

  try {
    const members = (await get(`members?id=in.(${ids.join(',')})&select=id,display_name,avatar_url`)) as Member[];
    const membersById = new Map<number, Member>(members.map((member) => [member.id, member]));
    return items.map((item) => {
      const member = item.author_id ? membersById.get(item.author_id) : null;
      if (!member) return item;
      return {
        ...item,
        author_name: item.author_name || member.display_name,
        author_avatar: member.avatar_url,
      };
    });
  } catch {
    return items;
  }
}

async function fetchAttachedForumPoll(topicId: number): Promise<AttachedPoll | null> {
  for (const attachedTo of ['forum.topic', 'forum_topic']) {
    const rows = (await get(`polls?attached_to=eq.${attachedTo}&attached_id=eq.${topicId}`)) as Poll[];
    const found = rows[0];
    if (!found) continue;
    const poll = await autoCloseIfNeeded(found);
    const [options, votes] = await Promise.all([getPollOptions(poll.id), getPollVotes(poll.id)]);
    return { poll, options, votes };
  }
  return null;
}

function MemberRequired({ authenticated, subject }: { authenticated: boolean; subject: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {authenticated ? `Active member access is required to view ${subject}.` : `Sign in as a member to view ${subject}.`}
        </p>
        {!authenticated ? (
          <Button onClick={() => openAuthModal({ mode: 'sign-in' })} type="button">
            Sign in
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AuthorAvatar({ item, size = 'md' }: { item: TopicWithAuthor | ReplyWithAuthor; size?: 'sm' | 'md' | 'lg' }) {
  const name = item.author_name || 'Anonymous';
  const sizeClass = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const textClass = size === 'lg' ? 'text-sm' : 'text-xs';

  if (item.author_avatar) {
    return <img alt="" className={`${sizeClass} shrink-0 rounded-full object-cover`} height={40} src={item.author_avatar} width={40} />;
  }

  return (
    <div className={`${sizeClass} ${textClass} flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ForumBreadcrumb({
  categoryId,
  current,
  onNavigate,
}: {
  categoryId?: number | null;
  current?: string;
  onNavigate: (route: ForumRoute) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <Button className="h-auto p-0 text-sm" onClick={() => onNavigate({ view: 'categories' })} type="button" variant="link">
        Forum
      </Button>
      {categoryId != null ? (
        <>
          <span>/</span>
          <Button className="h-auto p-0 text-sm" onClick={() => onNavigate({ view: 'category', categoryId: String(categoryId) })} type="button" variant="link">
            Back to topics
          </Button>
        </>
      ) : null}
      {current ? (
        <>
          <span>/</span>
          <span className="min-w-0 break-words">{current}</span>
        </>
      ) : null}
    </div>
  );
}

function TopicBadges({ topic }: { topic: Pick<ForumTopic, 'hidden' | 'is_pinned' | 'locked'> }) {
  return (
    <>
      {topic.is_pinned ? (
        <Badge>
          <Pin className="mr-1 h-3 w-3" />
          Pinned
        </Badge>
      ) : null}
      {topic.locked ? (
        <Badge variant="secondary">
          <Lock className="mr-1 h-3 w-3" />
          Locked
        </Badge>
      ) : null}
      {topic.hidden ? <Badge variant="destructive">Hidden</Badge> : null}
    </>
  );
}

function PollResults({ myVotes, options, votes }: { myVotes: PollVote[]; options: PollOption[]; votes: PollVote[] }) {
  const totalVotes = votes.length;
  const counts = useMemo(() => voteCountsFor(options, votes), [options, votes]);

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

function PollVoteOptions({
  myVotes,
  onVote,
  options,
  poll,
  votingKey,
}: {
  myVotes: PollVote[];
  onVote: (poll: Poll, option: PollOption) => void;
  options: PollOption[];
  poll: Poll;
  votingKey: string;
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

function AttachedPollPanel({
  data,
  onVote,
  votingKey,
}: {
  data: AttachedPoll;
  onVote: (poll: Poll, option: PollOption) => void;
  votingKey: string;
}) {
  const { poll, options, votes } = data;
  const memberId = memberIdFromSession();
  const signedIn = sessionLooksSignedIn();
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
  ].filter(Boolean);

  return (
    <section className="space-y-4 rounded-md border border-border bg-muted/25 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="break-words text-base font-semibold tracking-normal">{poll.question}</h3>
          {poll.description ? <p className="break-words text-sm text-muted-foreground">{poll.description}</p> : null}
        </div>
        {closed ? <Badge variant="secondary">Closed</Badge> : <Badge>Open</Badge>}
      </div>
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
    </section>
  );
}

function PollDraftEditor({
  draft,
  onChange,
}: {
  draft: PollDraft;
  onChange: (draft: PollDraft) => void;
}) {
  function updateOption(index: number, value: string) {
    onChange({
      ...draft,
      options: draft.options.map((option, optionIndex) => (optionIndex === index ? value : option)),
    });
  }

  function removeOption(index: number) {
    if (draft.options.length <= 2) return;
    onChange({ ...draft, options: draft.options.filter((_, optionIndex) => optionIndex !== index) });
  }

  if (!draft.enabled) {
    return (
      <Button onClick={() => onChange({ ...draft, enabled: true })} type="button" variant="secondary">
        <Plus className="h-4 w-4" />
        Add Poll
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/25 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">Poll</div>
          <p className="text-xs text-muted-foreground">Attach a member poll to this topic.</p>
        </div>
        <Button onClick={() => onChange(emptyPollDraft())} size="sm" type="button" variant="outline">
          Remove Poll
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="forum-poll-question">Question</Label>
        <Input
          id="forum-poll-question"
          name="forum_poll_question"
          onChange={(event) => onChange({ ...draft, question: event.target.value })}
          placeholder="What do you want to ask?"
          value={draft.question}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="forum-poll-description">Description</Label>
        <Textarea
          id="forum-poll-description"
          name="forum_poll_description"
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          placeholder="Optional context for members."
          value={draft.description}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-medium" id="forum-poll-type-label">
            Type
          </div>
          <Select onValueChange={(value) => onChange({ ...draft, pollType: value as PollFormType })} value={draft.pollType}>
            <SelectTrigger aria-labelledby="forum-poll-type-label" id="forum-poll-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single choice</SelectItem>
              <SelectItem value="multiple">Multiple choice</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium" id="forum-poll-results-label">
            Results
          </div>
          <Select
            onValueChange={(value) => onChange({ ...draft, resultsVisible: value as PollResultsVisibility })}
            value={draft.resultsVisible}
          >
            <SelectTrigger aria-labelledby="forum-poll-results-label" id="forum-poll-results">
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
          <Label htmlFor="forum-poll-closes-at">Closes at</Label>
          <Input
            id="forum-poll-closes-at"
            name="forum_poll_closes_at"
            onChange={(event) => onChange({ ...draft, closesAt: event.target.value })}
            placeholder="2026-06-30 18:00"
            value={draft.closesAt}
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium" id="forum-poll-anonymous-label">
            Anonymous poll
          </div>
          <Button
            aria-labelledby="forum-poll-anonymous-label"
            aria-pressed={draft.isAnonymous}
            className="w-full justify-start"
            id="forum-poll-anonymous"
            onClick={() => onChange({ ...draft, isAnonymous: !draft.isAnonymous })}
            type="button"
            variant={draft.isAnonymous ? 'secondary' : 'outline'}
          >
            {draft.isAnonymous ? <SquareCheck className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            Anonymous poll
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Options</div>
          <Button onClick={() => onChange({ ...draft, options: [...draft.options, ''] })} size="sm" type="button" variant="secondary">
            <Plus className="h-4 w-4" />
            Add option
          </Button>
        </div>
        <div className="space-y-2">
          {draft.options.map((option, index) => (
            <div className="flex gap-2" key={index}>
              <div className="min-w-0 flex-1">
                <Label className="sr-only" htmlFor={`forum-poll-option-${index + 1}`}>
                  Option {index + 1}
                </Label>
                <Input
                  id={`forum-poll-option-${index + 1}`}
                  name={`forum_poll_option_${index + 1}`}
                  onChange={(event) => updateOption(index, event.target.value)}
                  placeholder={`Option ${index + 1}`}
                  value={option}
                />
              </div>
              <Button
                aria-label={`Remove option ${index + 1}`}
                disabled={draft.options.length <= 2}
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
    </div>
  );
}

function TranslateButton({
  contentId,
  contentType,
  field,
  text,
}: {
  contentId: number;
  contentType: string;
  field: string;
  text: string;
}) {
  const [busy, setBusy] = useState(false);
  const [translated, setTranslated] = useState('');
  const [failed, setFailed] = useState(false);
  const locale = typeof window === 'undefined' ? 'en' : localStorage.getItem('wl_locale') || siteConfig.default_language || 'en';
  const defaultLanguage = siteConfig.default_language || 'en';

  if (!text || text.length < 10 || locale === defaultLanguage) return null;

  async function translate() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`${window.__KYCHON_API}/functions/v1/translate-text`, {
        body: JSON.stringify({
          text,
          target_lang: locale,
          content_type: contentType,
          content_id: contentId,
          field,
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.__KYCHON_ANON_KEY}`,
          apikey: window.__KYCHON_ANON_KEY,
        },
        method: 'POST',
      });
      const data = (await response.json()) as { translated?: string };
      if (!data.translated) throw new Error('Translation unavailable');
      setTranslated(data.translated);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (translated) {
    return (
      <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{translated}</p>
        <div className="mt-2 text-xs text-muted-foreground">Translated by AI</div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <Button disabled={busy} onClick={translate} size="sm" type="button" variant="outline">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {failed ? 'Translation unavailable' : busy ? 'Translating...' : 'Translate'}
      </Button>
    </div>
  );
}

function PostBody({ contentId, contentType, field, text }: { contentId: number; contentType: string; field: string; text: string }) {
  return (
    <div>
      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">{text}</p>
      <TranslateButton contentId={contentId} contentType={contentType} field={field} text={text} />
    </div>
  );
}

function CategoryList({
  categories,
  counts,
  onNavigate,
}: {
  categories: ForumCategory[];
  counts: Record<number, number>;
  onNavigate: (route: ForumRoute) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">Forum</h2>
        <p className="text-sm text-muted-foreground">Browse discussions by category.</p>
      </div>
      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No categories yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const count = counts[category.id] || 0;
            return (
              <Card className="h-full border-l-4 transition-colors hover:bg-accent/50" key={category.id} style={{ borderLeftColor: category.color }}>
                <a
                  className="block h-full text-left text-foreground no-underline"
                  href={routePath({ view: 'category', categoryId: String(category.id) })}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate({ view: 'category', categoryId: String(category.id) });
                  }}
                >
                  <CardHeader>
                    <CardTitle className="break-words text-lg tracking-normal">{category.name}</CardTitle>
                    {category.description ? <CardDescription className="break-words">{category.description}</CardDescription> : null}
                  </CardHeader>
                  <CardFooter>
                    <Badge variant="secondary">
                      <MessageSquare className="mr-1 h-3 w-3" />
                      {count} topic{count === 1 ? '' : 's'}
                    </Badge>
                  </CardFooter>
                </a>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopicList({
  authenticated,
  canCreatePoll,
  category,
  creating,
  form,
  onCreateTopic,
  onFormChange,
  onNavigate,
  pollsEnabled,
  topics,
}: {
  authenticated: boolean;
  canCreatePoll: boolean;
  category: ForumCategory | null;
  creating: boolean;
  form: TopicFormState;
  onCreateTopic: () => void;
  onFormChange: (form: TopicFormState) => void;
  onNavigate: (route: ForumRoute) => void;
  pollsEnabled: boolean;
  topics: TopicWithAuthor[];
}) {
  return (
    <div className="space-y-6">
      <ForumBreadcrumb onNavigate={onNavigate} />
      <div>
        <h2 className="break-words text-2xl font-semibold tracking-normal">{category?.name || 'Category'}</h2>
        {category?.description ? <p className="mt-1 break-words text-sm text-muted-foreground">{category.description}</p> : null}
      </div>

      {topics.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No topics yet. Be the first to start a discussion.</CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {topics.map((topic) => {
              const replyCount = topic.reply_count || 0;
              return (
                <a
                  className={`grid w-full gap-3 p-4 text-left transition-colors hover:bg-accent/50 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${
                    topic.hidden ? 'opacity-60' : ''
                  }`}
                  href={routePath({ view: 'topic', topicId: String(topic.id) })}
                  key={topic.id}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate({ view: 'topic', topicId: String(topic.id) });
                  }}
                >
                  <AuthorAvatar item={topic} />
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <TopicBadges topic={topic} />
                      <span className="min-w-0 break-words text-sm font-semibold text-foreground">{topic.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {topic.author_name || 'Anonymous'} · {timeAgo(topic.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground sm:flex-col sm:items-end">
                    <span className="font-medium text-foreground">
                      {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                    </span>
                    <span>{topic.last_reply_at ? timeAgo(topic.last_reply_at) : 'no replies'}</span>
                  </div>
                </a>
              );
            })}
          </div>
        </Card>
      )}

      {authenticated ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg tracking-normal">New Topic</CardTitle>
            <CardDescription>Start a discussion in this category.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forum-topic-title">Title</Label>
              <Input
                id="forum-topic-title"
                maxLength={200}
                name="forum_topic_title"
                onChange={(event) => onFormChange({ ...form, title: event.target.value })}
                required
                value={form.title}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forum-topic-body">Body</Label>
              <Textarea
                id="forum-topic-body"
                name="forum_topic_body"
                onChange={(event) => onFormChange({ ...form, body: event.target.value })}
                required
                value={form.body}
              />
            </div>
            {pollsEnabled && canCreatePoll ? <PollDraftEditor draft={form.poll} onChange={(poll) => onFormChange({ ...form, poll })} /> : null}
          </CardContent>
          <CardFooter className="justify-end">
            <Button disabled={creating} onClick={onCreateTopic} type="button">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Topic
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Sign in as a member to start a topic.</p>
            <Button onClick={() => openAuthModal({ mode: 'sign-in' })} type="button">
              Sign in
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TopicAdminActions({
  busy,
  onDelete,
  onToggleHidden,
  onToggleLocked,
  onTogglePinned,
  topic,
}: {
  busy: boolean;
  onDelete: () => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onTogglePinned: () => void;
  topic: TopicWithAuthor;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
      <Button disabled={busy} onClick={onTogglePinned} size="sm" type="button" variant="secondary">
        <Pin className="h-4 w-4" />
        {topic.is_pinned ? 'Unpin' : 'Pin'}
      </Button>
      <Button disabled={busy} onClick={onToggleLocked} size="sm" type="button" variant="secondary">
        <Lock className="h-4 w-4" />
        {topic.locked ? 'Unlock' : 'Lock'}
      </Button>
      <Button disabled={busy} onClick={onToggleHidden} size="sm" type="button" variant="secondary">
        {topic.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        {topic.hidden ? 'Unhide' : 'Hide'}
      </Button>
      <Button disabled={busy} onClick={onDelete} size="sm" type="button" variant="destructive">
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
    </div>
  );
}

function ReplyAdminActions({
  busy,
  onDelete,
  onToggleHidden,
  reply,
}: {
  busy: boolean;
  onDelete: () => void;
  onToggleHidden: () => void;
  reply: ReplyWithAuthor;
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-3">
      <Button disabled={busy} onClick={onToggleHidden} size="sm" type="button" variant="secondary">
        {reply.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        {reply.hidden ? 'Unhide' : 'Hide'}
      </Button>
      <Button disabled={busy} onClick={onDelete} size="sm" type="button" variant="destructive">
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
    </div>
  );
}

function TopicDetail({
  admin,
  adminBusy,
  attachedPoll,
  authenticated,
  onDeleteReply,
  onDeleteTopic,
  onNavigate,
  onPostReply,
  onToggleReplyHidden,
  onToggleTopicHidden,
  onToggleTopicLocked,
  onToggleTopicPinned,
  onVote,
  postingReply,
  replies,
  replyBody,
  setReplyBody,
  topic,
  votingKey,
}: {
  admin: boolean;
  adminBusy: boolean;
  attachedPoll: AttachedPoll | null;
  authenticated: boolean;
  onDeleteReply: (reply: ReplyWithAuthor) => void;
  onDeleteTopic: () => void;
  onNavigate: (route: ForumRoute) => void;
  onPostReply: () => void;
  onToggleReplyHidden: (reply: ReplyWithAuthor) => void;
  onToggleTopicHidden: () => void;
  onToggleTopicLocked: () => void;
  onToggleTopicPinned: () => void;
  onVote: (poll: Poll, option: PollOption) => void;
  postingReply: boolean;
  replies: ReplyWithAuthor[];
  replyBody: string;
  setReplyBody: (body: string) => void;
  topic: TopicWithAuthor;
  votingKey: string;
}) {
  return (
    <div className="space-y-6">
      <ForumBreadcrumb categoryId={topic.category_id} current={topic.title} onNavigate={onNavigate} />
      <Card className={topic.hidden ? 'opacity-70' : ''}>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap gap-2">
                <TopicBadges topic={topic} />
              </div>
              <CardTitle className="break-words text-2xl tracking-normal">{topic.title}</CardTitle>
              <CardDescription className="flex min-w-0 items-center gap-2">
                <AuthorAvatar item={topic} size="sm" />
                <span className="min-w-0 break-words">
                  {topic.author_name || 'Anonymous'} · {timeAgo(topic.created_at)}
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <PostBody contentId={topic.id} contentType="forum_topic" field="body" text={topic.body} />
          {attachedPoll ? <AttachedPollPanel data={attachedPoll} onVote={onVote} votingKey={votingKey} /> : null}
          {admin ? (
            <TopicAdminActions
              busy={adminBusy}
              onDelete={onDeleteTopic}
              onToggleHidden={onToggleTopicHidden}
              onToggleLocked={onToggleTopicLocked}
              onTogglePinned={onToggleTopicPinned}
              topic={topic}
            />
          ) : null}
        </CardContent>
      </Card>

      {replies.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {replies.map((reply) => (
              <article className={`space-y-3 p-4 sm:p-5 ${reply.hidden ? 'bg-destructive/5 opacity-70' : ''}`} key={reply.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <AuthorAvatar item={reply} size="sm" />
                    <span className="min-w-0 break-words text-sm font-semibold">{reply.author_name || 'Anonymous'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{timeAgo(reply.created_at)}</span>
                    {reply.hidden ? <Badge variant="destructive">Hidden</Badge> : null}
                  </div>
                </div>
                <PostBody contentId={reply.id} contentType="forum_reply" field="body" text={reply.body} />
                {admin ? (
                  <ReplyAdminActions
                    busy={adminBusy}
                    onDelete={() => onDeleteReply(reply)}
                    onToggleHidden={() => onToggleReplyHidden(reply)}
                    reply={reply}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No replies yet.</CardContent>
        </Card>
      )}

      {topic.locked ? (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>This topic is locked. No new replies can be posted.</AlertDescription>
        </Alert>
      ) : authenticated ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg tracking-normal">Reply</CardTitle>
          </CardHeader>
          <CardContent>
            <Label className="sr-only" htmlFor="forum-reply-body">
              Reply
            </Label>
            <Textarea
              id="forum-reply-body"
              name="forum_reply_body"
              onChange={(event) => setReplyBody(event.target.value)}
              placeholder="Write your reply..."
              required
              value={replyBody}
            />
          </CardContent>
          <CardFooter className="justify-end">
            <Button disabled={postingReply} onClick={onPostReply} type="button">
              {postingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Post Reply
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Sign in as a member to reply.</p>
            <Button onClick={() => openAuthModal({ mode: 'sign-in' })} type="button">
              Sign in
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeleteDialog({
  deleting,
  onConfirm,
  onOpenChange,
  target,
}: {
  deleting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  target: DeleteTarget;
}) {
  const isTopic = target?.kind === 'topic';
  return (
    <Dialog onOpenChange={onOpenChange} open={!!target}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {isTopic ? 'Topic' : 'Reply'}</DialogTitle>
          <DialogDescription>
            {isTopic ? 'This will delete the topic, its replies, and any attached poll.' : 'This will delete this reply.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={deleting} onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={deleting} onClick={onConfirm} type="button" variant="destructive">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ForumPageApp() {
  const [route, setRoute] = useState<ForumRoute>(() => currentForumRoute());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memberRequired, setMemberRequired] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [pollsEnabled, setPollsEnabled] = useState(false);
  const [canCreatePoll, setCanCreatePoll] = useState(false);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [topics, setTopics] = useState<TopicWithAuthor[]>([]);
  const [topic, setTopic] = useState<TopicWithAuthor | null>(null);
  const [replies, setReplies] = useState<ReplyWithAuthor[]>([]);
  const [attachedPoll, setAttachedPoll] = useState<AttachedPoll | null>(null);
  const [topicForm, setTopicForm] = useState<TopicFormState>(() => emptyTopicForm());
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [postingReply, setPostingReply] = useState(false);
  const [votingKey, setVotingKey] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  const loadForum = useCallback(async (activeRoute: ForumRoute) => {
    setLoading(true);
    setError('');
    setMemberRequired(false);
    setCategory(null);
    setTopics([]);
    setTopic(null);
    setReplies([]);
    setAttachedPoll(null);

    try {
      await ready;
      const nextAdmin = isAdmin();
      const nextAuthenticated = isAuthenticated();
      const nextPollsEnabled = isFeatureEnabled('feature_polls');
      setAdmin(nextAdmin);
      setAuthenticated(nextAuthenticated);
      setPollsEnabled(nextPollsEnabled);
      setCanCreatePoll(nextPollsEnabled && (nextAdmin || getConfig('polls_member_create') === true));

      if (activeRoute.view === 'categories') {
        const loadedCategories = (await get('forum_categories?order=position.asc')) as ForumCategory[];
        const translatedCategories = (await translateItems('forum_category', loadedCategories, ['name', 'description'])) as ForumCategory[];
        setCategories([...translatedCategories]);

        try {
          const loadedTopics = (await get('forum_topics?select=category_id')) as ForumTopic[];
          const nextCounts: Record<number, number> = {};
          for (const item of loadedTopics) {
            if (item.category_id == null) continue;
            nextCounts[item.category_id] = (nextCounts[item.category_id] || 0) + 1;
          }
          setCounts(nextCounts);
        } catch {
          setCounts({});
        }
        return;
      }

      if (activeRoute.view === 'category') {
        const loadedCategories = (await get(`forum_categories?id=eq.${activeRoute.categoryId}`)) as ForumCategory[];
        const translatedCategories = (await translateItems('forum_category', loadedCategories, ['name', 'description'])) as ForumCategory[];
        setCategory(translatedCategories[0] || null);

        let query = `forum_topics?category_id=eq.${activeRoute.categoryId}`;
        if (!nextAdmin) query += '&hidden=eq.false';
        query += '&order=is_pinned.desc,last_reply_at.desc.nullslast';
        const loadedTopics = (await get(query)) as ForumTopic[];
        setTopics(await enrichWithAvatars(loadedTopics));
        return;
      }

      const loadedTopics = (await get(`forum_topics?id=eq.${activeRoute.topicId}`)) as ForumTopic[];
      const foundTopic = loadedTopics[0] || null;
      if (!foundTopic || (foundTopic.hidden && !nextAdmin)) {
        setError('Topic not found.');
        return;
      }

      let replyQuery = `forum_replies?topic_id=eq.${activeRoute.topicId}`;
      if (!nextAdmin) replyQuery += '&hidden=eq.false';
      replyQuery += '&order=created_at.asc';
      const loadedReplies = (await get(replyQuery)) as ForumReply[];
      const enriched = await enrichWithAvatars([foundTopic, ...loadedReplies]);
      setTopic(enriched[0] as TopicWithAuthor);
      setReplies(enriched.slice(1) as ReplyWithAuthor[]);

      if (nextPollsEnabled) {
        setAttachedPoll(await fetchAttachedForumPoll(Number(activeRoute.topicId)));
      }
    } catch (loadError) {
      console.warn('Failed to load forum:', loadError);
      if (isPermissionDenied(loadError)) {
        setMemberRequired(true);
      } else {
        setError('Could not load the forum. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadForum(route);
  }, [loadForum, route]);

  useEffect(() => {
    function syncRoute() {
      setRoute(currentForumRoute());
    }

    window.addEventListener('popstate', syncRoute);
    document.addEventListener('astro:after-swap', syncRoute);
    document.addEventListener('wl-locale-changed', syncRoute);
    document.addEventListener('wl-auth-changed', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      document.removeEventListener('astro:after-swap', syncRoute);
      document.removeEventListener('wl-locale-changed', syncRoute);
      document.removeEventListener('wl-auth-changed', syncRoute);
    };
  }, []);

  const navigateTo = useCallback((nextRoute: ForumRoute) => {
    const path = routePath(nextRoute);
    window.history.pushState(null, '', path);
    setRoute(nextRoute);
  }, []);

  async function reloadCurrentRoute() {
    await loadForum(route);
  }

  async function createTopic() {
    if (route.view !== 'category') return;
    if (!getSession()) {
      showForumToast('Sign in as a member to continue.', 'warning');
      openAuthModal({ mode: 'sign-in' });
      return;
    }

    const title = topicForm.title.trim();
    const body = topicForm.body.trim();
    if (!title || !body) {
      showForumToast('Add a title and body before creating a topic.', 'warning');
      return;
    }

    setCreatingTopic(true);
    try {
      const pollData = pollPayloadFromDraft(topicForm.poll);
      await post('forum_topics', {
        title,
        body,
        category_id: route.categoryId,
        ...(pollData ? { poll: pollData } : {}),
      });
      setTopicForm(emptyTopicForm());
      showForumToast('Topic created', 'success');
      await reloadCurrentRoute();
    } catch (createError) {
      console.error('Failed to create topic:', createError);
      showForumToast(
        isPermissionDenied(createError) ? 'Active member access is required to create topics.' : (createError as Error).message || 'Failed to create topic. Please try again.',
        'error',
      );
    } finally {
      setCreatingTopic(false);
    }
  }

  async function postReply() {
    if (route.view !== 'topic') return;
    if (!getSession()) {
      showForumToast('Sign in as a member to continue.', 'warning');
      openAuthModal({ mode: 'sign-in' });
      return;
    }

    const body = replyBody.trim();
    const topicId = route.topicId;
    if (!body) return;

    setPostingReply(true);
    try {
      await post('forum_replies', {
        body,
        topic_id: topicId,
      });
      setReplyBody('');
      showForumToast('Reply posted', 'success');
      await reloadCurrentRoute();
    } catch (replyError) {
      console.error('Failed to post reply:', replyError);
      showForumToast(
        isPermissionDenied(replyError) ? 'Active member access is required to post replies.' : 'Failed to post reply. Please try again.',
        'error',
      );
    } finally {
      setPostingReply(false);
    }
  }

  async function toggleTopic(field: 'hidden' | 'is_pinned' | 'locked') {
    if (!topic) return;
    setAdminBusy(true);
    try {
      await patch(`forum_topics?id=eq.${topic.id}`, { [field]: !topic[field] });
      await reloadCurrentRoute();
    } catch (adminError) {
      console.error('Forum topic admin action failed:', adminError);
      showForumToast('Action failed. Please try again.', 'error');
    } finally {
      setAdminBusy(false);
    }
  }

  async function toggleReplyHidden(reply: ReplyWithAuthor) {
    setAdminBusy(true);
    try {
      await patch(`forum_replies?id=eq.${reply.id}`, { hidden: !reply.hidden });
      await reloadCurrentRoute();
    } catch (adminError) {
      console.error('Forum reply admin action failed:', adminError);
      showForumToast('Action failed. Please try again.', 'error');
    } finally {
      setAdminBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'topic') {
        const deletedTopic = deleteTarget.topic;
        for (const attachedTo of ['forum.topic', 'forum_topic']) {
          try {
            await del(`polls?attached_to=eq.${attachedTo}&attached_id=eq.${deletedTopic.id}`);
          } catch (pollDeleteError) {
            console.warn('Failed to delete attached poll:', pollDeleteError);
          }
        }
        await del(`forum_replies?topic_id=eq.${deletedTopic.id}`);
        await del(`forum_topics?id=eq.${deletedTopic.id}`);
        setDeleteTarget(null);
        showForumToast('Topic deleted', 'success');
        navigateTo({ view: 'category', categoryId: String(deletedTopic.category_id || '') });
        return;
      }

      await del(`forum_replies?id=eq.${deleteTarget.reply.id}`);
      setDeleteTarget(null);
      showForumToast('Reply deleted', 'success');
      await reloadCurrentRoute();
    } catch (deleteError) {
      console.error('Forum delete failed:', deleteError);
      showForumToast('Delete failed. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function voteOnPoll(poll: Poll, option: PollOption) {
    if (!getSession()) {
      showForumToast('Sign in as a member to vote.', 'warning');
      openAuthModal({ mode: 'sign-in' });
      return;
    }

    const key = `${poll.id}:${option.id}`;
    setVotingKey(key);
    try {
      await post('poll_votes', {
        poll_id: poll.id,
        option_id: option.id,
      });
      await reloadCurrentRoute();
    } catch (voteError) {
      console.error('Poll vote failed:', voteError);
      showForumToast(isPermissionDenied(voteError) ? 'Active member access is required to vote.' : 'Vote failed. Please try again.', 'error');
    } finally {
      setVotingKey('');
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading forum...
        </CardContent>
      </Card>
    );
  }

  if (memberRequired) {
    return <MemberRequired authenticated={authenticated} subject="the forum" />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {route.view !== 'categories' ? (
          <Button onClick={() => navigateTo({ view: 'categories' })} type="button" variant="outline">
            <ArrowLeft className="h-4 w-4" />
            Forum
          </Button>
        ) : null}
        {route.view === 'categories' ? (
          <CategoryList categories={categories} counts={counts} onNavigate={navigateTo} />
        ) : route.view === 'category' ? (
          <TopicList
            authenticated={authenticated}
            canCreatePoll={canCreatePoll}
            category={category}
            creating={creatingTopic}
            form={topicForm}
            onCreateTopic={createTopic}
            onFormChange={setTopicForm}
            onNavigate={navigateTo}
            pollsEnabled={pollsEnabled}
            topics={topics}
          />
        ) : topic ? (
          <TopicDetail
            admin={admin}
            adminBusy={adminBusy}
            attachedPoll={attachedPoll}
            authenticated={authenticated}
            onDeleteReply={(reply) => setDeleteTarget({ kind: 'reply', reply })}
            onDeleteTopic={() => setDeleteTarget({ kind: 'topic', topic })}
            onNavigate={navigateTo}
            onPostReply={postReply}
            onToggleReplyHidden={toggleReplyHidden}
            onToggleTopicHidden={() => toggleTopic('hidden')}
            onToggleTopicLocked={() => toggleTopic('locked')}
            onToggleTopicPinned={() => toggleTopic('is_pinned')}
            onVote={voteOnPoll}
            postingReply={postingReply}
            replies={replies}
            replyBody={replyBody}
            setReplyBody={setReplyBody}
            topic={topic}
            votingKey={votingKey}
          />
        ) : null}
      </div>
      <DeleteDialog deleting={deleting} onConfirm={confirmDelete} onOpenChange={(open) => !open && setDeleteTarget(null)} target={deleteTarget} />
    </>
  );
}
