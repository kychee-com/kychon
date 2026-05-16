// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appendBodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

const { PollCard } = await import('../../src/components/kychon/PollsBlockIsland.tsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const roots = [];

const basePoll = {
  id: 1,
  question: 'What should our next event be?',
  description: null,
  poll_type: 'single',
  is_anonymous: false,
  results_visible: 'after_vote',
  is_open: true,
  closes_at: null,
  attached_to: null,
  attached_id: null,
  created_by: 1,
  created_at: '2026-04-01T00:00:00Z',
};

const baseOptions = [
  { id: 10, poll_id: 1, label: 'Workshop', position: 0 },
  { id: 11, poll_id: 1, label: 'Social', position: 1 },
  { id: 12, poll_id: 1, label: 'Talk', position: 2 },
];

function setSession(session) {
  if (session) localStorage.setItem('wl_session', JSON.stringify(session));
  else localStorage.removeItem('wl_session');
}

async function renderPollCard({
  poll = basePoll,
  options = baseOptions,
  votes = [],
  session = null,
  onVote = vi.fn(),
} = {}) {
  setSession(session);
  const [host] = appendBodyFixture('<div></div>');
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(React.createElement(PollCard, { data: { poll, options, votes }, votingKey: '', onVote }));
  });
  return { host, onVote };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  clearBodyFixture();
  localStorage.clear();
});

describe('PollCard', () => {
  it('shows results and counts when results are always visible', async () => {
    const votes = [
      { id: 1, poll_id: 1, option_id: 10, member_id: 2, created_at: '2026-04-01T00:00:00Z' },
      { id: 2, poll_id: 1, option_id: 10, member_id: 3, created_at: '2026-04-01T00:00:00Z' },
      { id: 3, poll_id: 1, option_id: 11, member_id: 4, created_at: '2026-04-01T00:00:00Z' },
    ];
    const { host } = await renderPollCard({ poll: { ...basePoll, results_visible: 'always' }, votes });

    expect(host.textContent).toContain('67%');
    expect(host.textContent).toContain('33%');
    expect(host.textContent).toContain('3 votes');
    expect(host.querySelector('[role="progressbar"]')).toBeTruthy();
    expect(host.querySelector('.poll-widget')).toBeNull();
    expect(host.querySelector('.poll-vote-btn')).toBeNull();
  });

  it('renders vote buttons for signed-in members before voting', async () => {
    const session = { user: { member: { id: 42 } } };
    const onVote = vi.fn();
    const { host } = await renderPollCard({ session, onVote });
    const buttons = Array.from(host.querySelectorAll('button'));

    expect(buttons.map((button) => button.textContent)).toEqual(expect.arrayContaining(['Workshop', 'Social', 'Talk']));
    expect(host.querySelector('[role="progressbar"]')).toBeNull();

    await act(async () => {
      buttons[0].click();
    });
    expect(onVote).toHaveBeenCalledWith(basePoll, baseOptions[0]);
  });

  it('shows readonly options when signed out and results are not visible yet', async () => {
    const { host } = await renderPollCard();

    expect(host.textContent).toContain('Workshop');
    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('reveals results after the current member has voted', async () => {
    const votes = [
      { id: 1, poll_id: 1, option_id: 10, member_id: 42, created_at: '2026-04-01T00:00:00Z' },
      { id: 2, poll_id: 1, option_id: 11, member_id: 5, created_at: '2026-04-01T00:00:00Z' },
    ];
    const session = { user: { member: { id: '42' } } };
    const { host } = await renderPollCard({ votes, session });

    expect(host.textContent).toContain('50%');
    expect(host.querySelector('[role="progressbar"]')).toBeTruthy();
  });

  it('hides after-close results while open and shows them after close', async () => {
    const poll = { ...basePoll, results_visible: 'after_close' };
    const session = { user: { member: { id: 42 } } };
    const votes = [{ id: 1, poll_id: 1, option_id: 10, member_id: 42, created_at: '2026-04-01T00:00:00Z' }];
    const open = await renderPollCard({ poll, votes, session });
    expect(open.host.textContent).toContain('Results after close');
    expect(open.host.querySelector('[role="progressbar"]')).toBeNull();

    const closed = await renderPollCard({ poll: { ...poll, is_open: false }, votes, session });
    expect(closed.host.textContent).toContain('Closed');
    expect(closed.host.querySelector('[role="progressbar"]')).toBeTruthy();
  });

  it('supports multiple-choice state and safely renders labels as text', async () => {
    const options = [
      { id: 10, poll_id: 1, label: '<img src=x onerror=alert(1)>', position: 0 },
      { id: 11, poll_id: 1, label: 'Social', position: 1 },
    ];
    const session = { access_token: 'token', user: { id: 'user-1' } };
    const { host } = await renderPollCard({ poll: { ...basePoll, poll_type: 'multiple' }, options, session });

    expect(host.textContent).toContain('Select multiple');
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelectorAll('button')).toHaveLength(2);
  });
});
