import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const schema = readFileSync(join(root, 'schema.sql'), 'utf8');
const deployLib = readFileSync(join(root, 'scripts/_lib.ts'), 'utf8');
const seedGenerator = readFileSync(join(root, 'scripts/generate-seed-sql.ts'), 'utf8');

describe('native site search schema', () => {
  it('defines search_documents with stable source tuple and visibility fields', () => {
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS search_documents');
    expect(schema).toContain("source_type TEXT NOT NULL CHECK (source_type IN ('page', 'resource', 'event'))");
    expect(schema).toContain('source_key TEXT NOT NULL');
    expect(schema).toContain('UNIQUE(source_type, source_key)');
    expect(schema).toContain('is_members_only BOOLEAN NOT NULL DEFAULT false');
    expect(schema).toContain('published BOOLEAN NOT NULL DEFAULT true');
  });

  it('adds vectors, indexes, and RLS protection', () => {
    expect(schema).toContain('title_vector TSVECTOR');
    expect(schema).toContain('search_vector TSVECTOR');
    expect(schema).toContain('ALTER TABLE search_documents ENABLE ROW LEVEL SECURITY');
    expect(schema).toContain('idx_search_documents_title_vector');
    expect(schema).toContain('idx_search_documents_search_vector');
    expect(schema).toContain('idx_search_documents_visibility');
    expect(schema).toContain('idx_search_documents_updated');
  });

  it('defines sync functions and triggers for searchable sources', () => {
    expect(schema).toContain('CREATE OR REPLACE FUNCTION kychon_upsert_search_page');
    expect(schema).toContain('CREATE OR REPLACE FUNCTION kychon_upsert_search_resource');
    expect(schema).toContain('CREATE OR REPLACE FUNCTION kychon_upsert_search_event');
    expect(schema).toContain('CREATE OR REPLACE FUNCTION kychon_reindex_search');
    expect(schema).toContain('trg_search_pages_sync');
    expect(schema).toContain('trg_search_sections_sync');
    expect(schema).toContain('trg_search_resources_sync');
    expect(schema).toContain('trg_search_events_sync');
  });

  it('runs search sync functions as definer with a fixed search path', () => {
    for (const name of [
      'kychon_upsert_search_page',
      'kychon_upsert_search_resource',
      'kychon_upsert_search_event',
      'kychon_reindex_search',
      'kychon_search_page_row_trigger',
      'kychon_search_section_row_trigger',
      'kychon_search_resource_row_trigger',
      'kychon_search_event_row_trigger',
    ]) {
      const start = schema.indexOf(`CREATE OR REPLACE FUNCTION ${name}`);
      const end = schema.indexOf('AS $$', start);
      const definitionHead = schema.slice(start, end);
      expect(definitionHead).toContain('SECURITY DEFINER');
      expect(definitionHead).toContain('SET search_path FROM CURRENT');
    }
  });

  it('does not expose product tables through the low-level REST deploy config', () => {
    const exposeDeclaration = deployLib.slice(
      deployLib.indexOf('export const EXPOSE_TABLES'),
      deployLib.indexOf('export interface CollectFunctionsOptions'),
    );
    expect(exposeDeclaration).toContain('[]');
    expect(exposeDeclaration).not.toContain('"search_documents"');
    expect(deployLib).toContain('Product data is intentionally not published');
  });

  it('runs a reindex pass after generated seed/import SQL', () => {
    expect(seedGenerator).toContain('SELECT kychon_reindex_search();');
  });

  it('normalizes non-breaking space entities before indexing search text', () => {
    expect(schema).toContain('kychon_search_strip_html');
    expect(schema).toContain('&amp;nbsp;');
    expect(schema).toContain('&nbsp;');
    expect(schema).toContain('&#160;');
    expect(schema).toContain('&#xA0;');
    expect(schema).toContain('chr(160)');
  });
});
