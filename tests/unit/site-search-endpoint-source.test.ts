import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(import.meta.dirname, '../../functions/site-search.js'), 'utf8');

describe('site-search function source', () => {
  it('uses the native search table through a function endpoint', () => {
    expect(source).toContain('FROM search_documents');
    expect(source).toContain("websearch_to_tsquery('simple'");
    expect(source).toContain('title_vector');
    expect(source).toContain('search_vector');
  });

  it('enforces active-member visibility and private cache headers', () => {
    expect(source).toContain("member?.status === 'active'");
    expect(source).toContain('is_members_only = false');
    expect(source).toContain("'Cache-Control': 'no-store'");
    expect(source).toContain("Vary: 'Authorization'");
  });

  it('has safe snippets and stable native URLs', () => {
    expect(source).toContain('makeSnippet');
    expect(source).toContain('escapeHtml');
    expect(source).toContain('/resources.html#resource-');
    expect(source).toContain('/event.html?id=');
  });
});
