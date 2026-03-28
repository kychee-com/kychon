import { describe, it, expect } from 'vitest';

describe('resources rendering', () => {
  const resources = [
    { id: 1, title: 'User Guide', category: 'Guides', file_type: 'pdf', file_url: '/storage/guide.pdf', is_members_only: true },
    { id: 2, title: 'Intro Video', category: 'Videos', file_type: 'video', file_url: 'https://example.com/video', is_members_only: false },
    { id: 3, title: 'Logo Pack', category: 'Guides', file_type: 'image', file_url: '/storage/logo.zip', is_members_only: true },
  ];

  function fileTypeIcon(type) {
    const icons = { pdf: '📄', video: '🎬', link: '🔗', image: '🖼️' };
    return icons[type] || '📁';
  }

  function filterByCategory(resources, category) {
    return category ? resources.filter(r => r.category === category) : resources;
  }

  function getCategories(resources) {
    return [...new Set(resources.map(r => r.category).filter(Boolean))];
  }

  it('returns correct file type icons', () => {
    expect(fileTypeIcon('pdf')).toBe('📄');
    expect(fileTypeIcon('video')).toBe('🎬');
    expect(fileTypeIcon('link')).toBe('🔗');
    expect(fileTypeIcon('image')).toBe('🖼️');
    expect(fileTypeIcon('other')).toBe('📁');
  });

  it('extracts unique categories', () => {
    const cats = getCategories(resources);
    expect(cats).toEqual(['Guides', 'Videos']);
  });

  it('filters by category', () => {
    const guides = filterByCategory(resources, 'Guides');
    expect(guides.length).toBe(2);
    expect(guides.every(r => r.category === 'Guides')).toBe(true);
  });

  it('returns all when no category filter', () => {
    const all = filterByCategory(resources, '');
    expect(all.length).toBe(3);
  });

  it('renders resource card with icon and title', () => {
    const card = document.createElement('div');
    const r = resources[0];
    card.innerHTML = `<span class="icon">${fileTypeIcon(r.file_type)}</span><h4>${r.title}</h4>`;
    expect(card.querySelector('.icon').textContent).toBe('📄');
    expect(card.querySelector('h4').textContent).toBe('User Guide');
  });

  it('shows members-only badge', () => {
    const card = document.createElement('div');
    const r = resources[0];
    if (r.is_members_only) card.innerHTML += '<span class="badge">Members Only</span>';
    expect(card.querySelector('.badge')).toBeTruthy();
  });
});
