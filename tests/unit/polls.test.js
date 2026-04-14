// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

// renderPoll uses document.createElement for XSS escaping, needs DOM environment
const { renderPoll } = await import('../../src/lib/poll-ui.ts');

const basePoll = {
  id: 1,
  question: 'What should our next event be?',
  description: null,
  poll_type: 'single',
  is_anonymous: false,
  results_visible: 'after_vote',
  is_open: true,
  closes_at: null,
  created_by: 1,
  created_at: '2026-04-01T00:00:00Z',
};

const baseOptions = [
  { id: 10, poll_id: 1, label: 'Workshop', position: 0 },
  { id: 11, poll_id: 1, label: 'Social', position: 1 },
  { id: 12, poll_id: 1, label: 'Talk', position: 2 },
];

describe('renderPoll', () => {
  describe('results_visible = always', () => {
    const poll = { ...basePoll, results_visible: 'always' };

    it('shows bars and counts for unauthenticated users', () => {
      const votes = [
        { id: 1, poll_id: 1, option_id: 10, member_id: 2 },
        { id: 2, poll_id: 1, option_id: 10, member_id: 3 },
        { id: 3, poll_id: 1, option_id: 11, member_id: 4 },
      ];
      const html = renderPoll(poll, baseOptions, votes, null);
      expect(html).toContain('poll-bar-fill');
      expect(html).toContain('67%');
      expect(html).toContain('33%');
      expect(html).toContain('3 votes');
    });

    it('highlights user vote when authenticated', () => {
      const votes = [{ id: 1, poll_id: 1, option_id: 10, member_id: 42 }];
      const session = { user: { member: { id: 42 } } };
      const html = renderPoll(poll, baseOptions, votes, session);
      expect(html).toContain('poll-option-voted');
      expect(html).toContain('\u2713');
    });
  });

  describe('results_visible = after_vote', () => {
    const poll = { ...basePoll, results_visible: 'after_vote' };

    it('shows vote buttons before voting', () => {
      const session = { user: { member: { id: 42 } } };
      const html = renderPoll(poll, baseOptions, [], session);
      expect(html).toContain('poll-vote-btn');
      expect(html).not.toContain('poll-bar-fill');
      expect(html).toContain('0 votes');
    });

    it('shows results after voting', () => {
      const votes = [
        { id: 1, poll_id: 1, option_id: 10, member_id: 42 },
        { id: 2, poll_id: 1, option_id: 11, member_id: 5 },
      ];
      const session = { user: { member: { id: 42 } } };
      const html = renderPoll(poll, baseOptions, votes, session);
      expect(html).toContain('poll-bar-fill');
      expect(html).toContain('50%');
      expect(html).toContain('poll-option-voted');
    });

    it('shows readonly options for unauthenticated', () => {
      const html = renderPoll(poll, baseOptions, [], null);
      expect(html).toContain('poll-option-readonly');
      expect(html).not.toContain('poll-vote-btn');
    });
  });

  describe('results_visible = after_close', () => {
    const poll = { ...basePoll, results_visible: 'after_close' };

    it('hides results while open even after voting', () => {
      const votes = [{ id: 1, poll_id: 1, option_id: 10, member_id: 42 }];
      const session = { user: { member: { id: 42 } } };
      const html = renderPoll(poll, baseOptions, votes, session);
      expect(html).not.toContain('poll-bar-fill');
      expect(html).toContain('Results after close');
    });

    it('shows results when closed', () => {
      const closedPoll = { ...poll, is_open: false };
      const votes = [{ id: 1, poll_id: 1, option_id: 10, member_id: 42 }];
      const html = renderPoll(closedPoll, baseOptions, votes, null);
      expect(html).toContain('poll-bar-fill');
      expect(html).toContain('Closed');
    });
  });

  describe('closed poll', () => {
    it('does not show vote buttons', () => {
      const closedPoll = { ...basePoll, is_open: false };
      const session = { user: { member: { id: 42 } } };
      const html = renderPoll(closedPoll, baseOptions, [], session);
      expect(html).not.toContain('poll-vote-btn');
      expect(html).toContain('poll-closed');
      expect(html).toContain('Closed');
    });
  });

  describe('anonymous poll', () => {
    it('shows Anonymous label in meta', () => {
      const anonPoll = { ...basePoll, is_anonymous: true, results_visible: 'always' };
      const html = renderPoll(anonPoll, baseOptions, [], null);
      expect(html).toContain('Anonymous');
    });
  });

  describe('multiple choice poll', () => {
    it('shows checkbox indicators', () => {
      const multiPoll = { ...basePoll, poll_type: 'multiple' };
      const session = { user: { member: { id: 42 } } };
      const html = renderPoll(multiPoll, baseOptions, [], session);
      expect(html).toContain('\u2610');
      expect(html).toContain('Select multiple');
    });

    it('shows checked indicator for voted options', () => {
      const multiPoll = { ...basePoll, poll_type: 'multiple' };
      const votes = [{ id: 1, poll_id: 1, option_id: 10, member_id: 42 }];
      const session = { user: { member: { id: 42 } } };
      const html = renderPoll(multiPoll, baseOptions, votes, session);
      // after_vote shows results since member voted
      expect(html).toContain('poll-bar-fill');
    });
  });

  describe('poll with closes_at', () => {
    it('shows closes date for open poll', () => {
      const poll = { ...basePoll, closes_at: '2026-12-31T23:59:59Z' };
      const html = renderPoll(poll, baseOptions, [], null);
      expect(html).toContain('Closes');
    });

    it('treats expired closes_at as closed', () => {
      const poll = { ...basePoll, closes_at: '2020-01-01T00:00:00Z' };
      const session = { user: { member: { id: 42 } } };
      const html = renderPoll(poll, baseOptions, [], session);
      expect(html).toContain('poll-closed');
      expect(html).not.toContain('poll-vote-btn');
    });
  });

  describe('question and description', () => {
    it('renders question', () => {
      const html = renderPoll(basePoll, baseOptions, [], null);
      expect(html).toContain('What should our next event be?');
    });

    it('renders description when present', () => {
      const poll = { ...basePoll, description: 'Choose wisely' };
      const html = renderPoll(poll, baseOptions, [], null);
      expect(html).toContain('Choose wisely');
      expect(html).toContain('poll-description');
    });

    it('omits description when null', () => {
      const html = renderPoll(basePoll, baseOptions, [], null);
      expect(html).not.toContain('poll-description');
    });
  });
});
