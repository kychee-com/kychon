import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const page = readFileSync(join(root, 'src/pages/profile.astro'), 'utf8');
const app = readFileSync(join(root, 'src/components/kychon/ProfilePageApp.tsx'), 'utf8');

describe('profile page source', () => {
  it('uses a shadcn React island instead of inline DOM scripting', () => {
    expect(page).toContain('<ProfilePageApp client:load />');
    expect(page).not.toContain('<script>');
    expect(page).not.toContain('class="btn');
    expect(page).not.toContain('class="form-');
    expect(page).not.toContain('class="card');
    expect(page).not.toContain('ky-container');
  });

  it('keeps member profile, custom field, save, and avatar behavior in the island', () => {
    expect(app).toContain("get('member_custom_fields?order=position.asc')");
    expect(app).toContain('uploadFileContentAddressed');
    expect(app).toContain('members?id=eq.');
    expect(app).toContain('writeMemberToSession');
    expect(app).toContain('Change avatar');
  });

  it('renders with shared shadcn primitives and no legacy auth gate injection', () => {
    expect(app).toContain('Card');
    expect(app).toContain('Input');
    expect(app).toContain('Textarea');
    expect(app).toContain('Select');
    expect(app).toContain('Button');
    expect(app).not.toContain('showAuthGate');
    expect(app).not.toContain('dangerouslySetInnerHTML');
  });
});
