import { describe, expect, it } from 'vitest';
import {
  buildEventResultUrl,
  buildPageResultUrl,
  buildResourceResultUrl,
  clampPageSize,
  extractSearchableTextFromBlockConfig,
  makeSafeSnippet,
  normalizeSearchType,
  safeResourceFileLabel,
} from '../../src/lib/search.ts';

describe('search helpers', () => {
  it('extracts visible text from schema-driven block configs', () => {
    const text = extractSearchableTextFromBlockConfig('promo_cards', {
      heading: 'Programs',
      items: [
        { title: 'Volunteer induction', desc: '<p>Training for new helpers</p>', cta_href: '/join' },
        { image_url: '/photo.jpg', image_alt: 'decorative' },
      ],
    });
    expect(text).toContain('Programs');
    expect(text).toContain('Volunteer induction');
    expect(text).toContain('Training for new helpers');
    expect(text).not.toContain('/join');
    expect(text).not.toContain('/photo.jpg');
  });

  it('excludes search and chrome utility configs from page document text', () => {
    expect(extractSearchableTextFromBlockConfig('site_search', { placeholder: 'Find it' })).toBe('');
    expect(extractSearchableTextFromBlockConfig('nav', { items: [{ label: 'About' }] })).toBe('');
  });

  it('derives safe resource labels from the final path segment only', () => {
    expect(safeResourceFileLabel('/files/bylaws-2025.pdf?token=secret-renewal')).toBe('bylaws 2025.pdf');
    expect(safeResourceFileLabel('https://cdn.example.com/a/Annual%20Report.pdf#signed')).toBe('Annual Report.pdf');
  });

  it('builds stable native result URLs', () => {
    expect(buildPageResultUrl('index')).toBe('/');
    expect(buildPageResultUrl('about us')).toBe('/page.html?slug=about%20us');
    expect(buildResourceResultUrl(42)).toBe('/resources.html#resource-42');
    expect(buildEventResultUrl(7)).toBe('/event.html?id=7');
  });

  it('normalizes type and page size inputs', () => {
    expect(normalizeSearchType('resources')).toBe('resources');
    expect(normalizeSearchType('nonsense')).toBe('all');
    expect(clampPageSize(999)).toBe(50);
    expect(clampPageSize('0')).toBe(10);
  });

  it('escapes snippets while allowing controlled mark tags', () => {
    const snippet = makeSafeSnippet('<script>alert(1)</script><p>Membership renewal guide</p>', 'renewal');
    expect(snippet).not.toContain('<script>');
    expect(snippet).toContain('<mark>renewal</mark>');
    expect(snippet).toContain('Membership');
  });
});
