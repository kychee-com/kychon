import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const page = readFileSync(join(root, 'src/pages/search.astro'), 'utf8');
const app = readFileSync(join(root, 'src/components/kychon/SearchPageApp.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/styles/public.css'), 'utf8');

describe('search results page source', () => {
  it('defines the native route with robots metadata and URL state', () => {
    expect(page).toContain('<Portal title="Search" robots="noindex,follow">');
    expect(page).toContain('<SearchPageApp client:load />');
    expect(app).toContain('id="search-page-q"');
    expect(app).toContain('id="search-page-type-input"');
    expect(app).toContain("params.get('q')");
    expect(app).toContain("params.get('type')");
    expect(app).toContain("params.get('page')");
  });

  it('renders result filters, states, snippets, and pagination', () => {
    expect(app).toContain("['all', 'pages', 'resources', 'events']");
    expect(app).toContain('No visible results matched your search.');
    expect(app).toContain('Enter a search term to find pages, resources, and events.');
    expect(app).toContain('dangerouslySetInnerHTML');
    expect(app).toContain('Search pagination');
    expect(app).toContain('Card');
    expect(app).toContain('Button');
    expect(app).toContain('Badge');
    expect(app).toContain('[&_mark]:bg-primary/20');
  });

  it('keeps retired search-page CSS primitives out of source', () => {
    expect(app).toContain('flex flex-col gap-2 sm:flex-row');
    expect(app).toContain('flex flex-wrap gap-2');
    expect(app).not.toContain('search-page__');
    expect(app).not.toContain('search-result__');
    expect(css).not.toContain('.search-page__');
    expect(css).not.toContain('.search-result');
    expect(css).not.toContain('.search-filter');
    expect(css).not.toContain('.search-state');
  });
});
