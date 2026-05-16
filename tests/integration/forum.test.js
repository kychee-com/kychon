import { describe, expect, it } from 'vitest';

describe('forum rendering', () => {
  const categories = [
    { id: 1, name: 'General', description: 'General discussion', position: 1, color: '#6366f1' },
    { id: 2, name: 'Announcements', description: 'Official updates', position: 2, color: '#22c55e' },
  ];

  const topics = [
    {
      id: 1,
      category_id: 1,
      title: 'Welcome',
      body: '<p>Welcome!</p>',
      is_pinned: true,
      hidden: false,
      locked: false,
      reply_count: 3,
    },
    {
      id: 2,
      category_id: 1,
      title: 'Question',
      body: '<p>How?</p>',
      is_pinned: false,
      hidden: false,
      locked: false,
      reply_count: 1,
    },
    {
      id: 3,
      category_id: 1,
      title: 'Hidden',
      body: '<p>Spam</p>',
      is_pinned: false,
      hidden: true,
      locked: false,
      reply_count: 0,
    },
  ];

  function renderCategoryList(categories, topicCounts) {
    const list = document.createElement('div');
    for (const cat of categories) {
      const card = document.createElement('div');
      card.dataset.forumCategoryCard = String(cat.id);
      card.innerHTML = `
        <div data-forum-category-color style="background:${cat.color}"></div>
        <h3>${cat.name}</h3>
        <p>${cat.description}</p>
        <span data-forum-topic-count>${topicCounts[cat.id] || 0} topics</span>
      `;
      list.appendChild(card);
    }
    return list;
  }

  function renderTopicList(topics, isAdmin) {
    const visible = topics.filter((t) => isAdmin || !t.hidden);
    const sorted = [...visible].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
      return 0;
    });
    const list = document.createElement('div');
    for (const t of sorted) {
      const row = document.createElement('div');
      row.dataset.forumTopicRow = String(t.id);
      row.innerHTML = `
        <span data-forum-topic-title>${t.title}</span>
        ${t.is_pinned ? '<span data-forum-topic-pinned>Pinned</span>' : ''}
        ${t.hidden ? '<span data-forum-topic-hidden>Hidden</span>' : ''}
        <span data-forum-reply-count>${t.reply_count} replies</span>
      `;
      list.appendChild(row);
    }
    return list;
  }

  it('renders category list with topic counts', () => {
    const list = renderCategoryList(categories, { 1: 2, 2: 0 });
    const cards = list.querySelectorAll('[data-forum-category-card]');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('[data-forum-topic-count]').textContent).toContain('2');
  });

  it('renders category color bar', () => {
    const list = renderCategoryList(categories, {});
    const color = list.querySelector('[data-forum-category-color]');
    expect(color.style.background).toContain('6366f1');
  });

  it('shows visible topics sorted by pinned first', () => {
    const list = renderTopicList(topics, false);
    const rows = list.querySelectorAll('[data-forum-topic-row]');
    expect(rows.length).toBe(2); // hidden excluded
    expect(rows[0].querySelector('[data-forum-topic-title]').textContent).toBe('Welcome');
    expect(rows[0].querySelector('[data-forum-topic-pinned]')).toBeTruthy();
  });

  it('shows hidden topics to admins', () => {
    const list = renderTopicList(topics, true);
    const rows = list.querySelectorAll('[data-forum-topic-row]');
    expect(rows.length).toBe(3);
    const hiddenRow = [...rows].find((r) => r.querySelector('[data-forum-topic-title]').textContent === 'Hidden');
    expect(hiddenRow.querySelector('[data-forum-topic-hidden]')).toBeTruthy();
  });

  it('shows reply count on topics', () => {
    const list = renderTopicList(topics, false);
    const firstReplyCount = list.querySelector('[data-forum-reply-count]');
    expect(firstReplyCount.textContent).toContain('3');
  });
});
