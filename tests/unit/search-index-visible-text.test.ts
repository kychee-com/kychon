import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractSearchableTextFromBlockConfig,
  SEARCH_COPY_KEY_PATTERN,
  SEARCH_SKIP_KEY_PATTERN,
} from '../../src/lib/search.ts';

// #194: page search text is built in SQL by kychon_search_jsonb_copy(config, key),
// which walks a section's JSONB config and indexes only strings under visible-copy
// keys. These tests pull its two key patterns out of schema.sql, check they match
// the JS helper's, and replay the same traversal so indexed text can be asserted.

const schema = readFileSync(join(import.meta.dirname, '../../schema.sql'), 'utf8');

function sqlFunction(name: string): string {
  const start = schema.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  if (start < 0) throw new Error(`${name} not found in schema.sql`);
  return schema.slice(start, schema.indexOf('$$;', start));
}

function sqlPattern(fn: string, operator: '~*' | '!~*', variable: string): string {
  const match = fn.match(new RegExp(`${variable.replace('.', '\\.')} ${operator.replace('*', '\\*')} '([^']+)'`));
  if (!match) throw new Error(`pattern for ${variable} ${operator} not found`);
  return match[1];
}

const copyFn = sqlFunction('kychon_search_jsonb_copy');
const sqlCopy = new RegExp(sqlPattern(copyFn, '~*', 'key_hint'), 'i');
const sqlSkip = new RegExp(sqlPattern(copyFn, '!~*', 'item.key'), 'i');

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mirror of kychon_search_jsonb_copy.
function jsonbCopy(value: unknown, keyHint = ''): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return keyHint === '' || sqlCopy.test(keyHint) ? stripHtml(value) : '';
  if (Array.isArray(value)) {
    return value
      .map((elem) => jsonbCopy(elem, keyHint))
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sqlSkip.test(key))
      .map(([key, val]) => jsonbCopy(val, key))
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  return '';
}

describe('search index text uses visible copy only (#194)', () => {
  it('SQL and JS share the same copy / skip key patterns', () => {
    expect(sqlPattern(copyFn, '~*', 'key_hint')).toBe(SEARCH_COPY_KEY_PATTERN);
    expect(sqlPattern(copyFn, '!~*', 'item.key')).toBe(SEARCH_SKIP_KEY_PATTERN);
    expect(sqlFunction('kychon_search_jsonb_text')).toContain('kychon_search_jsonb_copy(value');
  });

  it('excludes slideshow image alt text and fit/position settings, keeps copy and captions', () => {
    const config = {
      heading: 'Welcome to the Riverside Garden Club',
      body: '<p>We grow heirloom tomatoes together every Saturday.</p>',
      fit: 'cover',
      transition: 'fade',
      aspect_ratio: '16/9',
      items: Array.from({ length: 8 }, (_, i) => ({
        src: `/assets/slide-${i + 1}.jpg`,
        alt: `slide ${i + 1}`,
        caption: i === 0 ? 'Spring planting day' : undefined,
        fit: 'cover',
        object_position: 'center',
        href: '',
      })),
    };

    const text = jsonbCopy(config);

    expect(text).toContain('Welcome to the Riverside Garden Club');
    expect(text).toContain('We grow heirloom tomatoes together every Saturday.');
    expect(text).toContain('Spring planting day');
    expect(text).not.toMatch(/slide \d/);
    expect(text).not.toMatch(/cover|center|fade|16\/9/);
  });

  it('drops style and layout tokens (size, alignment, color_scheme, layout, mode)', () => {
    const config = {
      text: 'Every block on this page is a row in the sections table',
      size: 'large',
      alignment: 'center',
      color_scheme: 'primary',
      layout: 'sidebar',
      filter: 'upcoming',
      mode: 'foreground',
      text_position: 'over_image',
      caption_position: 'bottom-left',
    };

    expect(jsonbCopy(config)).toBe('Every block on this page is a row in the sections table');
  });

  it('keeps visible copy stored under labels, subtitles, badges, categories, prices and stat values', () => {
    const config = {
      panels: [{ title: 'Tai chi', cta_label: 'See the schedule', image_alt: 'Members practicing tai chi' }],
      subtitle: 'Sign in to register for classes',
      submit_label: 'Sign in',
      items: [{ badge: 'NEW', category: 'Guías Legales', price: '$4', value: '2,400+', label: 'Volunteers' }],
    };

    const text = jsonbCopy(config);
    for (const copy of [
      'Tai chi',
      'See the schedule',
      'Sign in to register for classes',
      'Sign in',
      'NEW',
      'Guías Legales',
      '$4',
      '2,400+',
      'Volunteers',
    ]) {
      expect(text).toContain(copy);
    }
    expect(text).not.toContain('Members practicing tai chi');
  });

  it('the JS helper indexes the same text as the SQL walk', () => {
    const config = {
      heading: 'Programs',
      size: 'large',
      alignment: 'center',
      items: [{ title: 'Mentoring', cta_label: 'Learn more', image_alt: 'photo', fit: 'contain', value: '120' }],
    };
    expect(extractSearchableTextFromBlockConfig('promo_cards', config)).toBe(jsonbCopy(config));
  });
});
