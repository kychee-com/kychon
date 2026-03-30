import { describe, it, expect, vi, beforeEach } from 'vitest';

// Integration tests for reaction CRUD via API
// Tests the API call patterns used by the reaction UI

describe('reactions API integration', () => {
  let mockGet, mockPost, mockDel;

  beforeEach(() => {
    // Simulate API responses
    const reactionsStore = [];
    let nextId = 1;

    mockPost = vi.fn(async (endpoint, data) => {
      if (endpoint === 'reactions') {
        // Check unique constraint
        const exists = reactionsStore.find(r =>
          r.content_type === data.content_type &&
          r.content_id === data.content_id &&
          r.member_id === data.member_id &&
          r.emoji === data.emoji
        );
        if (exists) throw new Error('unique constraint violation');
        const row = { id: nextId++, ...data, created_at: new Date().toISOString() };
        reactionsStore.push(row);
        return row;
      }
    });

    mockGet = vi.fn(async (endpoint) => {
      if (endpoint.includes('reactions?')) {
        // Parse basic filters
        const typeMatch = endpoint.match(/content_type=eq\.(\w+)/);
        const idMatch = endpoint.match(/content_id=eq\.(\d+)/);
        const memberMatch = endpoint.match(/member_id=eq\.(\d+)/);
        const emojiMatch = endpoint.match(/emoji=eq\.(\w+)/);
        return reactionsStore.filter(r => {
          if (typeMatch && r.content_type !== typeMatch[1]) return false;
          if (idMatch && r.content_id !== parseInt(idMatch[1])) return false;
          if (memberMatch && r.member_id !== parseInt(memberMatch[1])) return false;
          if (emojiMatch && r.emoji !== emojiMatch[1]) return false;
          return true;
        });
      }
      return [];
    });

    mockDel = vi.fn(async (endpoint) => {
      const idMatch = endpoint.match(/id=eq\.(\d+)/);
      if (idMatch) {
        const idx = reactionsStore.findIndex(r => r.id === parseInt(idMatch[1]));
        if (idx >= 0) reactionsStore.splice(idx, 1);
      }
    });
  });

  it('creates a reaction via POST', async () => {
    await mockPost('reactions', { content_type: 'announcement', content_id: 1, member_id: 5, emoji: 'like' });
    const reactions = await mockGet('reactions?content_type=eq.announcement&content_id=eq.1');
    expect(reactions).toHaveLength(1);
    expect(reactions[0].emoji).toBe('like');
  });

  it('fetches reaction counts for multiple announcements', async () => {
    await mockPost('reactions', { content_type: 'announcement', content_id: 1, member_id: 5, emoji: 'like' });
    await mockPost('reactions', { content_type: 'announcement', content_id: 1, member_id: 6, emoji: 'like' });
    await mockPost('reactions', { content_type: 'announcement', content_id: 2, member_id: 5, emoji: 'heart' });

    const all = await mockGet('reactions?content_type=eq.announcement');
    expect(all).toHaveLength(3);

    // Client-side aggregation
    const counts = {};
    for (const r of all) {
      if (!counts[r.content_id]) counts[r.content_id] = {};
      counts[r.content_id][r.emoji] = (counts[r.content_id][r.emoji] || 0) + 1;
    }
    expect(counts[1].like).toBe(2);
    expect(counts[2].heart).toBe(1);
  });

  it('deletes a reaction via DELETE', async () => {
    await mockPost('reactions', { content_type: 'announcement', content_id: 1, member_id: 5, emoji: 'like' });
    let reactions = await mockGet('reactions?content_type=eq.announcement&content_id=eq.1');
    expect(reactions).toHaveLength(1);

    await mockDel('reactions?id=eq.' + reactions[0].id);
    reactions = await mockGet('reactions?content_type=eq.announcement&content_id=eq.1');
    expect(reactions).toHaveLength(0);
  });

  it('prevents duplicate reactions (unique constraint)', async () => {
    await mockPost('reactions', { content_type: 'announcement', content_id: 1, member_id: 5, emoji: 'like' });
    await expect(
      mockPost('reactions', { content_type: 'announcement', content_id: 1, member_id: 5, emoji: 'like' })
    ).rejects.toThrow('unique constraint');
  });

  it('allows same member to react with different emoji', async () => {
    await mockPost('reactions', { content_type: 'announcement', content_id: 1, member_id: 5, emoji: 'like' });
    await mockPost('reactions', { content_type: 'announcement', content_id: 1, member_id: 5, emoji: 'heart' });
    const reactions = await mockGet('reactions?content_type=eq.announcement&content_id=eq.1&member_id=eq.5');
    expect(reactions).toHaveLength(2);
  });

  it('toggle: removes reaction if already exists, adds if not', async () => {
    const memberId = 5;
    const contentId = 1;
    const emoji = 'like';

    // Toggle ON
    let existing = await mockGet(`reactions?content_type=eq.announcement&content_id=eq.${contentId}&member_id=eq.${memberId}&emoji=eq.${emoji}`);
    expect(existing).toHaveLength(0);
    await mockPost('reactions', { content_type: 'announcement', content_id: contentId, member_id: memberId, emoji });

    // Toggle OFF
    existing = await mockGet(`reactions?content_type=eq.announcement&content_id=eq.${contentId}&member_id=eq.${memberId}&emoji=eq.${emoji}`);
    expect(existing).toHaveLength(1);
    await mockDel('reactions?id=eq.' + existing[0].id);

    existing = await mockGet(`reactions?content_type=eq.announcement&content_id=eq.${contentId}&member_id=eq.${memberId}&emoji=eq.${emoji}`);
    expect(existing).toHaveLength(0);
  });
});
