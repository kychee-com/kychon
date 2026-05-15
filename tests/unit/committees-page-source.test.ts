import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const page = readFileSync(join(root, 'src/pages/committees.astro'), 'utf8');
const app = readFileSync(join(root, 'src/components/kychon/CommitteesPageApp.tsx'), 'utf8');

describe('committees page source', () => {
  it('uses a shadcn React island instead of inline DOM scripting', () => {
    expect(page).toContain('<CommitteesPageApp client:load />');
    expect(page).not.toContain('<script>');
    expect(page).not.toContain('ky-container');
    expect(page).not.toContain('class="btn');
    expect(page).not.toContain('class="card');
    expect(page).not.toContain('class="form-');
  });

  it('keeps list, detail, create, member assignment, and delete workflows', () => {
    expect(app).toContain('getCommittees');
    expect(app).toContain('get(`committees?id=eq.');
    expect(app).toContain('get(`committee_members?committee_id=eq.');
    expect(app).toContain("post('committees'");
    expect(app).toContain("post('committee_members'");
    expect(app).toContain('onRemoveMember');
    expect(app).toContain('del(`committees?id=eq.');
    expect(app).toContain('Create Committee');
  });

  it('renders with shared shadcn primitives and no raw HTML rendering helpers', () => {
    expect(app).toContain('Card');
    expect(app).toContain('Dialog');
    expect(app).toContain('Input');
    expect(app).toContain('Textarea');
    expect(app).toContain('Select');
    expect(app).toContain('Button');
    expect(app).not.toContain('innerHTML =');
    expect(app).not.toContain('document.createElement');
    expect(app).not.toContain('dangerouslySetInnerHTML');
  });
});
