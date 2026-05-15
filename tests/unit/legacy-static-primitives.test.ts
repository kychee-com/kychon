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
const A11Y_STYLES = resolve(process.cwd(), 'src/styles/a11y.css');
const PUBLIC_A11Y_STYLES = resolve(process.cwd(), 'public/css/a11y.css');
const ADMIN_DASHBOARD = resolve(process.cwd(), 'src/components/kychon/AdminDashboardApp.tsx');
const CONFIG = resolve(process.cwd(), 'src/lib/config.ts');
const PORTAL = resolve(process.cwd(), 'src/layouts/Portal.astro');
const TOAST_ISLAND = resolve(process.cwd(), 'src/components/kychon/ToastIsland.tsx');
const SONNER = resolve(process.cwd(), 'src/components/ui/sonner.tsx');
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
    expect(html).toContain('data-events-calendar-controls-host');
    expect(html).toContain('data-events-calendar-viewport');
    expect(html).toContain('data-events-calendar-peek-host');
    expect(html).toContain('data-events-calendar-download');
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
    const a11yStyles = await readFile(A11Y_STYLES, 'utf8');
    const publicA11yStyles = await readFile(PUBLIC_A11Y_STYLES, 'utf8');
    const adminDashboard = await readFile(ADMIN_DASHBOARD, 'utf8');
    const config = await readFile(CONFIG, 'utf8');
    const portal = await readFile(PORTAL, 'utf8');
    const toastIsland = await readFile(TOAST_ISLAND, 'utf8');
    const sonner = await readFile(SONNER, 'utf8');

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
    expect(styles).not.toMatch(/\.toast(?:[.{:#\s-]|$)/);
    expect(styles).not.toContain('.toast-container');
    expect(styles).not.toContain('toast-success');
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
    expect(eventCalendarRuntime).not.toContain('document.createElement');
    expect(eventCalendarRuntime).not.toContain('innerHTML');
    expect(eventCalendarRuntime).not.toContain('insertAdjacentHTML');
    expect(eventCalendarRuntime).not.toContain('appendChild');
    expect(eventCalendarRuntime).toContain('createRoot');
    expect(eventCalendarRuntime).toContain('EventsCalendarControls');
    expect(eventCalendarView).toContain('@/components/kychon/ui');
    expect(eventCalendarView).toContain('data-events-calendar-controls-host');
    expect(eventCalendarView).toContain('data-events-calendar-peek-host');
    expect(eventCalendarView).not.toContain('block-events-calendar__');
    expect(globalStyles).not.toContain('block-events-calendar.css');
    expect(globalStyles).not.toContain('nav-dropdown.css');
    expect(adminStyles).not.toContain('block-embed');
    expect(adminStyles).not.toContain('.admin-drop-indicator');
    expect(adminStyles).not.toContain('admin-nav-edit-btn');
    expect(adminStyles).not.toContain('admin-toast');
    expect(adminStyles).not.toContain('admin-section-actions');
    expect(adminStyles).not.toContain('admin-save-success');
    expect(adminStyles).not.toContain('admin-save-error');
    expect(adminStyles).not.toContain('admin-save-pulse');
    expect(adminStyles).not.toContain('.tiptap-active');
    expect(adminStyles).not.toContain('.uploading');
    expect(adminStyles).not.toContain('.dragging');
    expect(adminStyles).not.toContain('body.admin-dragging');
    for (const stylesheet of [a11yStyles, publicA11yStyles]) {
      expect(stylesheet).toContain('.wl-skip-nav');
      expect(stylesheet).toContain('.wl-high-contrast');
      expect(stylesheet).toContain('.wl-reduced-motion');
      expect(stylesheet).toContain('.wl-sr-live');
      expect(stylesheet).not.toContain('wl-a11y');
      expect(stylesheet).not.toContain('.wl-toggle');
    }
    expect(adminDashboard).toContain('@/components/kychon/ui');
    expect(adminDashboard).not.toContain('admin-account-security');
    expect(adminDashboard).not.toContain('admin-checklist');
    expect(portal).toContain('id="wl-theme-vars"');
    expect(config).not.toContain('document.createElement');
    expect(config).not.toContain('appendChild');
    expect(toastIsland).toContain('Toaster');
    expect(toastIsland).toContain('toast.success');
    expect(sonner).toContain('sonner');
    expect(sonner).toContain('ky-toast');
  });
});
