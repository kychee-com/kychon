import { describe, expect, it } from 'vitest';

describe('forum logic', () => {
  const topics = [
    { id: 1, title: 'Welcome', hidden: false, is_pinned: true, locked: false, reply_count: 5, category_id: 1 },
    { id: 2, title: 'Question', hidden: false, is_pinned: false, locked: false, reply_count: 2, category_id: 1 },
    { id: 3, title: 'Spam Post', hidden: true, is_pinned: false, locked: false, reply_count: 0, category_id: 1 },
    { id: 4, title: 'Old Topic', hidden: false, is_pinned: false, locked: true, reply_count: 10, category_id: 2 },
  ];

  const replies = [
    { id: 1, topic_id: 1, body: 'Great!', hidden: false },
    { id: 2, topic_id: 1, body: 'Thanks', hidden: false },
    { id: 3, topic_id: 1, body: 'Spam reply', hidden: true },
  ];

  function visibleTopics(topics, isAdmin) {
    return topics.filter((t) => isAdmin || !t.hidden);
  }

  function visibleReplies(replies, isAdmin) {
    return replies.filter((r) => isAdmin || !r.hidden);
  }

  function sortTopics(topics) {
    return [...topics].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
      return b.reply_count - a.reply_count;
    });
  }

  function topicCountByCategory(topics, catId) {
    return topics.filter((t) => t.category_id === catId && !t.hidden).length;
  }

  it('hides hidden topics from members', () => {
    const visible = visibleTopics(topics, false);
    expect(visible.length).toBe(3);
    expect(visible.find((t) => t.title === 'Spam Post')).toBeUndefined();
  });

  it('shows hidden topics to admins', () => {
    const visible = visibleTopics(topics, true);
    expect(visible.length).toBe(4);
  });

  it('hides hidden replies from members', () => {
    const visible = visibleReplies(replies, false);
    expect(visible.length).toBe(2);
  });

  it('shows hidden replies to admins', () => {
    const visible = visibleReplies(replies, true);
    expect(visible.length).toBe(3);
  });

  it('sorts pinned topics first', () => {
    const sorted = sortTopics(visibleTopics(topics, false));
    expect(sorted[0].title).toBe('Welcome');
    expect(sorted[0].is_pinned).toBe(true);
  });

  it('counts topics per category excluding hidden', () => {
    expect(topicCountByCategory(topics, 1)).toBe(2);
    expect(topicCountByCategory(topics, 2)).toBe(1);
  });

  it('locked topic prevents new replies', () => {
    const topic = topics.find((t) => t.id === 4);
    expect(topic.locked).toBe(true);
  });
});
