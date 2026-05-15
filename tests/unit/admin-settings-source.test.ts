import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const page = readFileSync(join(root, 'src/pages/admin-settings.astro'), 'utf8');
const app = readFileSync(join(root, 'src/components/kychon/AdminSettingsApp.tsx'), 'utf8');

describe('admin settings source', () => {
  it('uses a shadcn React island instead of inline DOM scripting', () => {
    expect(page).toContain('<AdminSettingsApp client:load />');
    expect(page).not.toContain('<script>');
    expect(page).not.toContain('class="btn');
    expect(page).not.toContain('class="form-');
    expect(page).not.toContain('ky-container');
  });

  it('renders theme color controls through the shared Input component', () => {
    expect(app).toContain('Input');
    expect(app).toContain('type="color"');
    expect(app).not.toContain('<input');
    expect(app).not.toContain('document.createElement');
    expect(app).not.toContain('innerHTML');
  });
});
