import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const page = readFileSync(join(root, 'src/pages/event.astro'), 'utf8');
const app = readFileSync(join(root, 'src/components/kychon/EventDetailPageApp.tsx'), 'utf8');

describe('event detail page source', () => {
  it('uses a shadcn React island instead of inline DOM rendering', () => {
    expect(page).toMatch(/<EventDetailPageApp\b[\s\S]*?client:load\b[\s\S]*?\/>/);
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

  it('does not request member-only RSVPs for anonymous visitors (403 on every public event page)', () => {
    expect(app).toMatch(/authenticated\s*\?\s*get\(`event_rsvps\?event_id=eq\./);
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

  it('renders the requested event per request instead of embedding every event', () => {
    expect(page).toContain('export const prerender = false');
    expect(page).toContain('ssrEventGet');
    expect(page).toContain('initialEvent={event}');
    expect(page).not.toContain('getAllBuildEvents');
    expect(page).not.toContain('eventsById');
    expect(app).not.toContain('eventsById');
    expect(app).toContain('useState<Event | null>(initialEvent ?? null)');
    expect(app).toContain('useState(!initialEvent)');
  });

  it('answers missing ids with a noindex 404 and gives link previews per-event head metadata', () => {
    expect(page).toMatch(/lookup\.status === 'missing'\) Astro\.response\.status = 404/);
    expect(page).toContain("robots={lookup.status === 'missing' ? 'noindex' : undefined}");
    expect(page).toContain('title={event?.title');
    expect(page).toContain('eventMetaDescription');
    expect(page).toContain('eventOgImageUrl');
  });
});
