import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CALENDAR_PAGE = resolve(process.cwd(), 'src/pages/calendar.astro');
const CALENDAR_APP = resolve(process.cwd(), 'src/components/kychon/CalendarPageApp.tsx');

describe('calendar page source', () => {
  it('uses the React calendar app directly without a DOM hydrator island', async () => {
    const page = await readFile(CALENDAR_PAGE, 'utf8');

    expect(page).toContain('CalendarPageApp');
    expect(page).toContain('client:load');
    expect(page).not.toContain('CalendarPageHydrator');
    expect(page).not.toContain('<script>');
    expect(page).not.toContain('data-block-hydrate');
    expect(page).not.toContain('ky-container');
    expect(page).not.toContain('class="card');
    expect(page).not.toContain('class="btn');
  });

  it('keeps calendar behavior in shadcn React state instead of block DOM hydration', async () => {
    const app = await readFile(CALENDAR_APP, 'utf8');

    expect(app).toContain('@/components/kychon/ui');
    expect(app).toContain('getEvents');
    expect(app).toContain('CalendarGrid');
    expect(app).toContain('AgendaEvent');
    expect(app).not.toContain('data-block-hydrate');
    expect(app).not.toContain('hydrateEventsCalendar');
    expect(app).not.toContain('querySelector');
    expect(app).not.toContain('innerHTML');
    expect(app).not.toContain('document.createElement');
    expect(app).not.toContain('block-events-calendar');
  });
});
