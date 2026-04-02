// poll-ui.ts — Shared poll rendering and creation functions
import { del, get, patch, post } from './api';

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}

interface PollData {
  id: number;
  question: string;
  description: string | null;
  poll_type: string;
  is_anonymous: boolean;
  results_visible: string;
  is_open: boolean;
  closes_at: string | null;
  created_by: number | null;
  created_at: string;
}

interface PollOptionData {
  id: number;
  poll_id: number;
  label: string;
  position: number;
}

interface PollVoteData {
  id: number;
  poll_id: number;
  option_id: number;
  member_id: number | null;
}

interface SessionData {
  user?: { member?: { id: number } };
}

// --- Auto-close check ---
export async function checkAutoClose(poll: PollData): Promise<boolean> {
  if (!poll.is_open || !poll.closes_at) return false;
  if (new Date(poll.closes_at) > new Date()) return false;
  try {
    await patch(`polls?id=eq.${poll.id}`, { is_open: false });
  } catch {}
  return true;
}

// --- Render poll widget ---
export function renderPoll(
  poll: PollData,
  options: PollOptionData[],
  votes: PollVoteData[],
  session: SessionData | null,
): string {
  const memberId = session?.user?.member?.id ?? null;
  const isAuthenticated = memberId !== null;
  const expired = poll.closes_at ? new Date(poll.closes_at) <= new Date() : false;
  const isClosed = !poll.is_open || expired;
  const myVotes = isAuthenticated ? votes.filter((v) => v.member_id === memberId) : [];
  const hasVoted = myVotes.length > 0;
  const totalVotes = votes.length;

  // Determine if we show results
  const showResults =
    poll.results_visible === 'always' ||
    (poll.results_visible === 'after_vote' && hasVoted) ||
    (poll.results_visible === 'after_close' && isClosed);

  // Count votes per option
  const voteCounts: Record<number, number> = {};
  for (const opt of options) voteCounts[opt.id] = 0;
  for (const v of votes) voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;

  let optionsHtml = '';
  for (const opt of options) {
    const count = voteCounts[opt.id] || 0;
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const isMyVote = myVotes.some((v) => v.option_id === opt.id);

    if (showResults) {
      // Results mode: show bars + counts
      optionsHtml += `
        <div class="poll-option ${isMyVote ? 'poll-option-voted' : ''}" data-poll-vote="${opt.id}" data-poll-id="${poll.id}">
          <div class="poll-bar">
            <div class="poll-bar-fill" style="width:${pct}%"></div>
            <span class="poll-bar-label">${esc(opt.label)}</span>
            <span class="poll-bar-pct">${pct}%${isMyVote ? ' \u2713' : ''}</span>
          </div>
          <span class="poll-bar-count">${count}</span>
        </div>`;
    } else if (isAuthenticated && !isClosed) {
      // Voting mode: clickable options
      const selectedClass = isMyVote ? ' poll-option-selected' : '';
      const indicator = poll.poll_type === 'multiple' ? (isMyVote ? '\u2611' : '\u2610') : isMyVote ? '\u25C9' : '\u25CB';
      optionsHtml += `
        <button class="poll-vote-btn${selectedClass}" data-poll-vote="${opt.id}" data-poll-id="${poll.id}">
          <span class="poll-vote-indicator">${indicator}</span>
          <span>${esc(opt.label)}</span>
        </button>`;
    } else {
      // Read-only mode (not authenticated or closed without results)
      optionsHtml += `
        <div class="poll-option poll-option-readonly">
          <span>${esc(opt.label)}</span>
        </div>`;
    }
  }

  // Meta line
  const metaParts: string[] = [];
  metaParts.push(`${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`);
  if (poll.closes_at && !isClosed) {
    const closesDate = new Date(poll.closes_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    metaParts.push(`Closes ${closesDate}`);
  }
  if (isClosed) metaParts.push('Closed');
  if (poll.is_anonymous) metaParts.push('Anonymous');
  if (poll.poll_type === 'multiple') metaParts.push('Select multiple');
  if (poll.results_visible === 'after_close' && !isClosed && !showResults) {
    metaParts.push('Results after close');
  }

  return `
    <div class="poll-widget${isClosed ? ' poll-closed' : ''}" data-poll-widget="${poll.id}" data-poll-type="${poll.poll_type}">
      <div class="poll-question">${esc(poll.question)}</div>
      ${poll.description ? `<div class="poll-description">${esc(poll.description)}</div>` : ''}
      <div class="poll-options">${optionsHtml}</div>
      <div class="poll-meta">${metaParts.join(' \u00B7 ')}</div>
    </div>`;
}

// --- Vote handlers ---
export async function handleSingleVote(
  pollId: number,
  optionId: number,
  memberId: number,
): Promise<void> {
  // Delete any existing votes for this member on this poll
  await del(`poll_votes?poll_id=eq.${pollId}&member_id=eq.${memberId}`);
  // Insert new vote
  await post('poll_votes', { poll_id: pollId, option_id: optionId, member_id: memberId });
  await post('activity_log', {
    member_id: memberId,
    action: 'poll_vote',
    metadata: { poll_id: pollId },
  });
}

export async function handleMultiVote(
  pollId: number,
  optionId: number,
  memberId: number,
  currentVotes: PollVoteData[],
): Promise<void> {
  const existing = currentVotes.find(
    (v) => v.option_id === optionId && v.member_id === memberId,
  );
  if (existing) {
    await del(`poll_votes?id=eq.${existing.id}`);
  } else {
    await post('poll_votes', { poll_id: pollId, option_id: optionId, member_id: memberId });
  }
  await post('activity_log', {
    member_id: memberId,
    action: 'poll_vote',
    metadata: { poll_id: pollId },
  });
}

// --- Bind vote event listeners ---
export function bindPollVoteListeners(
  container: HTMLElement,
  poll: PollData,
  votes: PollVoteData[],
  memberId: number | null,
  onVote: () => void,
): void {
  if (!memberId || !poll.is_open) return;
  const expired = poll.closes_at ? new Date(poll.closes_at) <= new Date() : false;
  if (expired) return;

  container.querySelectorAll('[data-poll-vote]').forEach((el) => {
    el.addEventListener('click', async () => {
      const optionId = parseInt((el as HTMLElement).dataset.pollVote!, 10);
      try {
        if (poll.poll_type === 'multiple') {
          await handleMultiVote(poll.id, optionId, memberId, votes);
        } else {
          await handleSingleVote(poll.id, optionId, memberId);
        }
        onVote();
      } catch (e) {
        console.error('Vote failed:', e);
      }
    });
  });
}

// --- Fetch and render a poll by ID ---
export async function fetchAndRenderPoll(
  pollId: number,
  session: SessionData | null,
): Promise<{ html: string; poll: PollData; options: PollOptionData[]; votes: PollVoteData[] }> {
  const polls = await get(`polls?id=eq.${pollId}`);
  const poll = polls[0];
  if (!poll) throw new Error('Poll not found');
  await checkAutoClose(poll);
  const options = await get(`poll_options?poll_id=eq.${pollId}&order=position.asc`);
  const votes = await get(`poll_votes?poll_id=eq.${pollId}`);
  const html = renderPoll(poll, options, votes, session);
  return { html, poll, options, votes };
}

// --- Fetch and render attached poll ---
export async function fetchAttachedPoll(
  attachedTo: string,
  attachedId: number,
  session: SessionData | null,
): Promise<{ html: string; poll: PollData; options: PollOptionData[]; votes: PollVoteData[] } | null> {
  const polls = await get(`polls?attached_to=eq.${attachedTo}&attached_id=eq.${attachedId}`);
  if (!polls || polls.length === 0) return null;
  const poll = polls[0];
  await checkAutoClose(poll);
  const options = await get(`poll_options?poll_id=eq.${poll.id}&order=position.asc`);
  const votes = await get(`poll_votes?poll_id=eq.${poll.id}`);
  const html = renderPoll(poll, options, votes, session);
  return { html, poll, options, votes };
}

// --- Poll creation form ---
export interface AttachConfig {
  type: string;
  id: number | null;
}

export function createPollForm(
  container: HTMLElement,
  _attachConfig?: AttachConfig | null,
): { getPollData: () => { question: string; options: string[]; poll_type: string; is_anonymous: boolean; results_visible: string; closes_at: string | null } | null; remove: () => void } {
  container.innerHTML = `
    <div class="poll-form card">
      <div class="flex justify-between items-center mb-1">
        <h4>Add Poll</h4>
        <button class="btn btn-sm btn-secondary poll-form-remove" type="button">\u2715 Remove</button>
      </div>
      <div class="form-group">
        <label class="form-label">Question</label>
        <input class="form-input poll-form-question" required placeholder="What do you want to ask?">
      </div>
      <div class="poll-form-options">
        <label class="form-label">Options (minimum 2)</label>
        <div class="poll-form-option-list">
          <div class="poll-form-option-row flex gap-1 mb-half">
            <input class="form-input poll-form-option-input" placeholder="Option 1" required>
            <button class="btn btn-sm btn-secondary poll-form-option-remove" type="button">\u2715</button>
          </div>
          <div class="poll-form-option-row flex gap-1 mb-half">
            <input class="form-input poll-form-option-input" placeholder="Option 2" required>
            <button class="btn btn-sm btn-secondary poll-form-option-remove" type="button">\u2715</button>
          </div>
        </div>
        <button class="btn btn-sm btn-secondary mt-half poll-form-add-option" type="button">+ Add option</button>
      </div>
      <div class="poll-form-settings mt-1">
        <div class="flex gap-2 flex-wrap">
          <label class="form-label" style="display:flex;align-items:center;gap:0.5rem">
            Type:
            <select class="form-input poll-form-type" style="width:auto">
              <option value="single">Single choice</option>
              <option value="multiple">Multiple choice</option>
            </select>
          </label>
          <label class="form-label" style="display:flex;align-items:center;gap:0.5rem">
            Results:
            <select class="form-input poll-form-visibility" style="width:auto">
              <option value="after_vote">After voting</option>
              <option value="always">Always visible</option>
              <option value="after_close">After close</option>
            </select>
          </label>
          <label class="form-label" style="display:flex;align-items:center;gap:0.5rem">
            <input type="checkbox" class="poll-form-anonymous"> Anonymous
          </label>
        </div>
        <div class="form-group mt-1">
          <label class="form-label">Closes at (optional)</label>
          <input type="datetime-local" class="form-input poll-form-closes" style="width:auto">
        </div>
      </div>
    </div>`;

  // Add option handler
  const optionList = container.querySelector('.poll-form-option-list')!;
  container.querySelector('.poll-form-add-option')!.addEventListener('click', () => {
    const count = optionList.querySelectorAll('.poll-form-option-row').length;
    const row = document.createElement('div');
    row.className = 'poll-form-option-row flex gap-1 mb-half';
    row.innerHTML = `
      <input class="form-input poll-form-option-input" placeholder="Option ${count + 1}" required>
      <button class="btn btn-sm btn-secondary poll-form-option-remove" type="button">\u2715</button>`;
    optionList.appendChild(row);
    bindOptionRemove(row);
  });

  // Remove option handler
  function bindOptionRemove(row: Element) {
    row.querySelector('.poll-form-option-remove')!.addEventListener('click', () => {
      if (optionList.querySelectorAll('.poll-form-option-row').length <= 2) return;
      row.remove();
    });
  }
  container.querySelectorAll('.poll-form-option-row').forEach(bindOptionRemove);

  // Remove form handler
  const removeBtn = container.querySelector('.poll-form-remove')!;
  const remove = () => {
    container.innerHTML = '';
  };
  removeBtn.addEventListener('click', remove);

  // Get data
  function getPollData() {
    const question = (container.querySelector('.poll-form-question') as HTMLInputElement)?.value.trim();
    if (!question) return null;
    const optionInputs = container.querySelectorAll('.poll-form-option-input') as NodeListOf<HTMLInputElement>;
    const options = Array.from(optionInputs)
      .map((i) => i.value.trim())
      .filter(Boolean);
    if (options.length < 2) return null;
    const poll_type = (container.querySelector('.poll-form-type') as HTMLSelectElement).value;
    const is_anonymous = (container.querySelector('.poll-form-anonymous') as HTMLInputElement).checked;
    const results_visible = (container.querySelector('.poll-form-visibility') as HTMLSelectElement).value;
    const closesInput = (container.querySelector('.poll-form-closes') as HTMLInputElement).value;
    const closes_at = closesInput ? new Date(closesInput).toISOString() : null;
    return { question, options, poll_type, is_anonymous, results_visible, closes_at };
  }

  return { getPollData, remove };
}

// --- Submit poll to API ---
export async function submitPoll(
  data: { question: string; options: string[]; poll_type: string; is_anonymous: boolean; results_visible: string; closes_at: string | null },
  memberId: number,
  attachConfig?: AttachConfig | null,
): Promise<number> {
  const pollBody: Record<string, any> = {
    question: data.question,
    poll_type: data.poll_type,
    is_anonymous: data.is_anonymous,
    results_visible: data.results_visible,
    closes_at: data.closes_at,
    created_by: memberId,
  };
  if (attachConfig?.type && attachConfig.id) {
    pollBody.attached_to = attachConfig.type;
    pollBody.attached_id = attachConfig.id;
  }
  const [created] = await post('polls', pollBody);
  const pollId = created.id;

  for (let i = 0; i < data.options.length; i++) {
    await post('poll_options', { poll_id: pollId, label: data.options[i], position: i });
  }

  await post('activity_log', {
    member_id: memberId,
    action: 'poll_create',
    metadata: { poll_id: pollId, question: data.question },
  });

  return pollId;
}
