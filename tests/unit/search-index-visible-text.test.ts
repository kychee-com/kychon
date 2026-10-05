import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// #194: page search text is built in SQL by kychon_search_jsonb_text(config),
// which walks a section's JSONB config and skips keys matching an exclusion
// regex. These tests pull that regex out of schema.sql and replay the same
// traversal in JS so the indexed text for a real section config can be asserted.

const schema = readFileSync(join(import.meta.dirname, '../../schema.sql'), 'utf8');

function extractExcludedKeyPattern(): RegExp {
  const start = schema.indexOf('CREATE OR REPLACE FUNCTION kychon_search_jsonb_text');
  const end = schema.indexOf('$$;', start);
  const fn = schema.slice(start, end);
  const match = fn.match(/item\.key !~\* '([^']+)'/);
  if (!match) throw new Error('kychon_search_jsonb_text key exclusion regex not found');
  // Postgres `~*` is a case-insensitive POSIX match.
  return new RegExp(match[1], 'i');
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jsonbText(value: unknown, excluded: RegExp): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return stripHtml(value);
  if (Array.isArray(value)) {
    return value
      .map((elem) => jsonbText(elem, excluded))
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !excluded.test(key))
      .map(([, val]) => jsonbText(val, excluded))
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  return '';
}

describe('search index text uses visible copy only (#194)', () => {
  const excluded = extractExcludedKeyPattern();

  it('excludes slideshow image alt text and fit/position settings, keeps copy and captions', () => {
    const config = {
      heading: 'Welcome to the Riverside Garden Club',
      body: '<p>We grow heirloom tomatoes together every Saturday.</p>',
      fit: 'cover',
      items: Array.from({ length: 8 }, (_, i) => ({
        src: `/assets/slide-${i + 1}.jpg`,
        alt: `slide ${i + 1}`,
        caption: i === 0 ? 'Spring planting day' : undefined,
        fit: 'cover',
        object_position: 'center',
        href: '',
      })),
    };

    const text = jsonbText(config, excluded);

    expect(text).toContain('Welcome to the Riverside Garden Club');
    expect(text).toContain('We grow heirloom tomatoes together every Saturday.');
    expect(text).toContain('Spring planting day');
    expect(text).not.toMatch(/slide \d/);
    expect(text).not.toContain('cover');
    expect(text).not.toContain('center');
  });

  it('excludes image_alt on image-bearing blocks', () => {
    const config = {
      heading: 'Our programs',
      panels: [{ image_url: '/a.jpg', image_alt: 'photo of a panel', title: 'Mentoring', fit: 'contain' }],
    };

    const text = jsonbText(config, excluded);

    expect(text).toContain('Our programs');
    expect(text).toContain('Mentoring');
    expect(text).not.toContain('photo of a panel');
    expect(text).not.toContain('contain');
  });
});
