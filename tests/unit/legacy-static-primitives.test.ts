import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';

const BLOCKS = resolve(process.cwd(), 'src/lib/blocks.ts');
const EMBED = resolve(process.cwd(), 'src/lib/blocks/embed.ts');
const STYLES = resolve(process.cwd(), 'src/styles/public.css');
const EVENT_CALENDAR_RUNTIME = resolve(process.cwd(), 'src/lib/blocks/events-calendar.ts');
const EVENT_CALENDAR_VIEW = resolve(process.cwd(), 'src/components/kychon/EventsCalendarBlockView.tsx');
const GLOBAL_STYLES = resolve(process.cwd(), 'src/styles/globals.css');
const ADMIN_STYLES = resolve(process.cwd(), 'public/css/admin-editing.css');
const ADMIN_DASHBOARD = resolve(process.cwd(), 'src/components/kychon/AdminDashboardApp.tsx');
const ctx: BlockRenderContext = { admin: true, locale: 'en', isFeatureEnabled: () => true };

function section(sectionType: string, config: Record<string, unknown>): Section {
  return {
    id: 91,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: sectionType,
    position: 1,
    config,
  };
}

describe('legacy static UI primitives', () => {
  it('renders empty placeholders with token classes instead of ky-text-muted', () => {
    const accordion = renderBlock(section('image_accordion', { panels: [] }), ctx);
    const slideshow = renderBlock(section('slideshow', { items: [] }), ctx);

    expect(accordion).toContain('text-muted-foreground');
    expect(slideshow).toContain('text-muted-foreground');
    expect(accordion).not.toContain('ky-text-muted');
    expect(slideshow).not.toContain('ky-text-muted');
  });

  it('renders the event calendar placeholder without the old skeleton primitive class', () => {
    const html = renderBlock(section('events_calendar', {}), ctx);

    expect(html).toContain('data-events-calendar-skeleton');
    expect(html).toContain('animate-pulse');
    expect(html).not.toContain('block-events-calendar');
    expect(html).not.toContain('block-events-calendar__skeleton');
    expect(html).not.toContain('event-skeleton-card');
    expect(html).not.toContain(' skeleton');
  });

  it('keeps retired primitive CSS out of source', async () => {
    const blocks = await readFile(BLOCKS, 'utf8');
    const embed = await readFile(EMBED, 'utf8');
    const styles = await readFile(STYLES, 'utf8');
    const eventCalendarRuntime = await readFile(EVENT_CALENDAR_RUNTIME, 'utf8');
    const eventCalendarView = await readFile(EVENT_CALENDAR_VIEW, 'utf8');
    const globalStyles = await readFile(GLOBAL_STYLES, 'utf8');
    const adminStyles = await readFile(ADMIN_STYLES, 'utf8');
    const adminDashboard = await readFile(ADMIN_DASHBOARD, 'utf8');

    expect(blocks).not.toContain('ky-text-muted');
    expect(blocks).not.toContain('event-skeleton-card');
    expect(blocks).not.toContain('block-events-calendar__skeleton');
    expect(blocks).not.toContain(' skeleton"></div>');
    expect(embed).not.toContain('block-embed');
    expect(styles).not.toMatch(/\.ky-text-muted\b/);
    expect(styles).not.toMatch(/\.skeleton(?:[.{:#\s-]|$)/);
    expect(styles).not.toContain('skeleton-pulse');
    expect(styles).not.toContain('block-events-calendar__skeleton');
    expect(styles).not.toContain('section-shape-divider');
    expect(styles).not.toContain('shape-divider__');
    expect(styles).not.toContain('admin-account-security');
    expect(styles).not.toContain('admin-checklist');
    expect(eventCalendarRuntime).not.toContain('block-events-calendar__controls');
    expect(eventCalendarRuntime).not.toContain('block-events-calendar__seg-btn');
    expect(eventCalendarRuntime).not.toContain('block-events-calendar__filter-chip');
    expect(eventCalendarRuntime).not.toContain('block-events-calendar__peek');
    expect(eventCalendarRuntime).not.toContain('block-events-calendar__empty');
    expect(eventCalendarRuntime).not.toContain('block-events-calendar__chip');
    expect(eventCalendarRuntime).not.toContain('block-events-calendar__avatar');
    expect(eventCalendarRuntime).not.toContain('block-events-calendar__badge');
    expect(eventCalendarRuntime).not.toContain('block-events-calendar__more');
    expect(eventCalendarRuntime).not.toContain('block-events-calendar__');
    expect(eventCalendarView).toContain('@/components/kychon/ui');
    expect(eventCalendarView).not.toContain('block-events-calendar__');
    expect(globalStyles).not.toContain('block-events-calendar.css');
    expect(globalStyles).not.toContain('nav-dropdown.css');
    expect(adminStyles).not.toContain('block-embed');
    expect(adminStyles).not.toContain('.admin-drop-indicator');
    expect(adminDashboard).toContain('@/components/kychon/ui');
    expect(adminDashboard).not.toContain('admin-account-security');
    expect(adminDashboard).not.toContain('admin-checklist');
  });
});
