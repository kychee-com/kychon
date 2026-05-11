import { describe, expect, it } from 'vitest';
import {
  buildSiteSearchSectionFromWildApricot,
  extractWildApricotSearchConfig,
  hasWildApricotSearch,
  mapWildApricotSearchTypes,
  rewriteWildApricotSearchHtml,
} from '../../src/lib/wild-apricot-search.ts';

describe('Wild Apricot search mapping', () => {
  const html = `
    <form action="https://aage.com.au/Sys/Search" method="post" target="_blank">
      <input type="search" name="q" placeholder="Enter search string">
      <input type="hidden" name="types" value="7">
      <button type="submit">Find</button>
    </form>
  `;

  it('detects absolute and relative Wild Apricot search forms', () => {
    expect(hasWildApricotSearch(html)).toBe(true);
    expect(hasWildApricotSearch('<form action="/Sys/Search/DoSearch"></form>')).toBe(true);
  });

  it('maps supported and unknown type bitmasks', () => {
    expect(mapWildApricotSearchTypes('1')).toEqual({ default_type: 'pages' });
    expect(mapWildApricotSearchTypes('2')).toEqual({ default_type: 'resources' });
    expect(mapWildApricotSearchTypes('4')).toEqual({ default_type: 'events' });
    expect(mapWildApricotSearchTypes('7')).toEqual({ default_type: 'all' });
    expect(mapWildApricotSearchTypes('999').default_type).toBe('all');
    expect(mapWildApricotSearchTypes('999').warning).toContain('Unsupported');
  });

  it('extracts native site search config', () => {
    const cfg = extractWildApricotSearchConfig(html);
    expect(cfg).toMatchObject({
      placeholder: 'Enter search string',
      submit_label: 'Find',
      default_type: 'all',
      compact: true,
    });
  });

  it('emits a native site_search section', () => {
    const section = buildSiteSearchSectionFromWildApricot(html, { position: 3 });
    expect(section?.section_type).toBe('site_search');
    expect(section?.position).toBe(3);
    expect(section?.config).toMatchObject({
      placeholder: 'Enter search string',
      submit_label: 'Find',
      destination: '/search',
      default_type: 'all',
    });
  });

  it('rewrites source search actions and removes hidden Wild Apricot params', () => {
    const rewritten = rewriteWildApricotSearchHtml(html);
    expect(rewritten).toContain('/search');
    expect(rewritten).not.toContain('/Sys/Search');
    expect(rewritten).not.toContain('target="_blank"');
    expect(rewritten).not.toContain('name="types"');
    expect(rewritten).toContain('method="get"');
  });
});
