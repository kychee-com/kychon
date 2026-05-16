import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ADMIN_EDITOR = resolve(process.cwd(), 'src/components/AdminEditor.astro');
const ADMIN_ACTION_CONTROLS = resolve(process.cwd(), 'src/lib/admin-action-controls.tsx');
const STYLES = resolve(process.cwd(), 'src/styles/public.css');

describe('legacy button primitives', () => {
  it('keeps product source off the old global btn classes', async () => {
    const adminEditor = await readFile(ADMIN_EDITOR, 'utf8');
    const adminActionControls = await readFile(ADMIN_ACTION_CONTROLS, 'utf8');
    const styles = await readFile(STYLES, 'utf8');

    expect(adminActionControls).toContain('Button');
    expect(adminActionControls).not.toContain('<button');
    expect(adminActionControls).not.toContain('buttonVariants');
    expect(adminEditor).not.toContain('loadAdminCSS');
    expect(adminEditor).not.toContain("document.createElement('link')");
    expect(adminEditor).not.toContain('class="btn');
    expect(styles).not.toMatch(/\.btn(?:[.{:#\s-]|$)/);
    expect(styles).not.toContain('.btn-google');
  });
});
