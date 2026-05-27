import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const page = readFileSync(join(root, 'src/pages/directory.astro'), 'utf8');
const app = readFileSync(join(root, 'src/components/kychon/DirectoryPageApp.tsx'), 'utf8');

describe('directory page source', () => {
  it('uses a shadcn React island instead of inline DOM scripting', () => {
    // The `<DirectoryPageApp ... client:load />` directive may now
    // carry `initialMembers` / `initialTiers` props wired from the
    // build-time SSR fetch (`ensureBuildMembersLoaded`), so we match
    // the directive surface independently rather than pinning to one
    // exact form.
    expect(page).toMatch(/<DirectoryPageApp\b[\s\S]*?client:load\b[\s\S]*?\/>/);
    expect(page).not.toContain('<script>');
    expect(page).not.toContain('class="btn');
    expect(page).not.toContain('class="form-');
    expect(page).not.toContain('class="card');
    expect(page).not.toContain('ky-container');
  });

  it('renders member card actions through the shared Button component', () => {
    expect(app).toContain('Button');
    expect(app).toContain('Badge');
    expect(app).toMatch(/aria-label=\{`View \$\{member\.display_name\}`\}/);
    expect(app).not.toContain('badgeVariants');
    expect(app).not.toContain('role="button"');
    expect(app).not.toContain('tabIndex={0}');
    expect(app).not.toContain('onKeyDown');
  });
});
