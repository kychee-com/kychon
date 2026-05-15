import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const page = readFileSync(join(root, 'src/pages/event.astro'), 'utf8');
const app = readFileSync(join(root, 'src/components/kychon/EventDetailPageApp.tsx'), 'utf8');

describe('event detail page source', () => {
  it('uses a shadcn React island instead of inline DOM rendering', () => {
    expect(page).toContain('<EventDetailPageApp client:load />');
    expect(page).not.toContain('<script>');
    expect(page).not.toContain('class="btn');
    expect(page).not.toContain('class="form-');
    expect(page).not.toContain('class="card');
    expect(page).not.toContain('ky-container');
  });

  it('keeps event loading, RSVP, timezone, and registration option workflows', () => {
    expect(app).toContain('get(`events?id=eq.');
    expect(app).toContain('get(`event_rsvps?event_id=eq.');
    expect(app).toContain('getEventRegistrationOptions');
    expect(app).toContain("post('event_rsvps'");
    expect(app).toContain('patch(`event_rsvps?id=eq.');
    expect(app).toContain('updateEventTimezone');
    expect(app).toContain('createEventRegistrationOption');
    expect(app).toContain('updateEventRegistrationOption');
    expect(app).toContain('del(`events?id=eq.');
  });

  it('renders with shared shadcn primitives and sanitized rich content', () => {
    expect(app).toContain('Card');
    expect(app).toContain('Dialog');
    expect(app).toContain('Input');
    expect(app).toContain('Textarea');
    expect(app).toContain('Select');
    expect(app).toContain('Checkbox');
    expect(app).toContain('Button');
    expect(app).toContain('sanitizeRichHtml');
    expect(app).not.toContain('innerHTML =');
    expect(app).not.toContain('document.createElement');
  });
});
