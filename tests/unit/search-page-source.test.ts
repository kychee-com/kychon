import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const page = readFileSync(join(root, 'src/pages/search.astro'), 'utf8');
const css = readFileSync(join(root, 'public/css/styles.css'), 'utf8');

describe('search results page source', () => {
  it('defines the native route with robots metadata and URL state', () => {
    expect(page).toContain('<Portal title="Search" robots="noindex,follow">');
    expect(page).toContain('id="search-page-q"');
    expect(page).toContain('id="search-page-type-input"');
    expect(page).toContain("params.get('q')");
    expect(page).toContain("params.get('type')");
    expect(page).toContain("params.get('page')");
  });

  it('renders result filters, states, snippets, and pagination', () => {
    expect(page).toContain("['all', 'pages', 'resources', 'events']");
    expect(page).toContain('No visible results matched your search.');
    expect(page).toContain('Enter a search term to find pages, resources, and events.');
    expect(page).toContain('search-result__snippet');
    expect(page).toContain('search-page-pagination');
  });

  it('has mobile-safe styles for filters and results', () => {
    expect(css).toContain('.search-page__filters');
    expect(css).toContain('.search-result__snippet mark');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('.search-page__bar');
  });
});
