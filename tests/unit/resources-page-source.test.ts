import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const page = readFileSync(join(root, 'src/pages/resources.astro'), 'utf8');
const app = readFileSync(join(root, 'src/components/kychon/ResourcesPageApp.tsx'), 'utf8');

describe('resources page source', () => {
  it('uses a shadcn React island instead of inline DOM scripting', () => {
    expect(page).toContain('<ResourcesPageApp client:load />');
    expect(page).not.toContain('<script>');
    expect(page).not.toContain('class="btn');
    expect(page).not.toContain('class="form-');
    expect(page).not.toContain('class="card');
    expect(page).not.toContain('auth-modal');
  });

  it('keeps resource filtering, member gating, upload, and delete behavior in the island', () => {
    expect(app).toContain('resource_category_filter');
    expect(app).toContain('Sign in to view resources');
    expect(app).toContain('Upload Resource');
    expect(app).toContain('uploadFileContentAddressed');
    expect(app).toContain('Delete resource?');
    expect(app).toContain('resources?id=eq.');
  });

  it('renders with shared shadcn primitives', () => {
    expect(app).toContain('Card');
    expect(app).toContain('Dialog');
    expect(app).toContain('Select');
    expect(app).toContain('Checkbox');
    expect(app).toContain('Button');
  });
});
