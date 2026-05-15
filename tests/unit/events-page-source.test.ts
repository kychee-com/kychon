import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const page = readFileSync(join(root, 'src/pages/events.astro'), 'utf8');
const app = readFileSync(join(root, 'src/components/kychon/EventsPageApp.tsx'), 'utf8');

describe('events page source', () => {
  it('uses a shadcn React island instead of inline DOM scripting', () => {
    expect(page).toContain('<EventsPageApp client:load />');
    expect(page).not.toContain('<script>');
    expect(page).not.toContain('class="btn');
    expect(page).not.toContain('class="form-');
    expect(page).not.toContain('class="card');
    expect(page).not.toContain('ky-container');
  });

  it('keeps event loading, translation, split sections, and create behavior in the island', () => {
    expect(app).toContain("getEvents('order=starts_at.asc')");
    expect(app).toContain("translateItems('event'");
    expect(app).toContain('upcoming');
    expect(app).toContain('Past Events');
    expect(app).toContain("post('events'");
    expect(app).toContain('Create Event');
  });

  it('renders with shared shadcn primitives and event date formatting', () => {
    expect(app).toContain('Card');
    expect(app).toContain('Dialog');
    expect(app).toContain('Input');
    expect(app).toContain('Textarea');
    expect(app).toContain('Button');
    expect(app).toContain('formatEventDateTime');
    expect(app).not.toContain('dangerouslySetInnerHTML');
  });
});
