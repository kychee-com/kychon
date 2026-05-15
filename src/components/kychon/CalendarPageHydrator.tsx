'use client';

import { useCallback, useEffect } from 'react';
import { getRole, getSession } from '@/lib/auth';
import { BLOCK_TYPES, type BlockRenderContext, type Section } from '@/lib/blocks';
import { isFeatureEnabled, ready } from '@/lib/config';
import { getLocale } from '@/lib/i18n';

const CALENDAR_CONFIG = {
  density: 'rich',
  filter: 'all',
  first_day_of_week: 0,
  heading: 'Calendar',
  show_filter_chips: true,
  view: 'month',
};

const CALENDAR_SECTION: Section = {
  config: CALENDAR_CONFIG,
  page_slug: 'calendar',
  position: 1,
  scope: 'page',
  section_type: 'events_calendar',
  zone: 'main',
};

export default function CalendarPageHydrator() {
  const hydrateCalendar = useCallback(async () => {
    await ready;
    const host = document.querySelector<HTMLElement>('[data-block-hydrate="events_calendar"]');
    if (!host || host.dataset.hydrated === 'true') return;

    const wrapper = host.closest('section') as HTMLElement | null;
    if (!wrapper) return;

    const block = BLOCK_TYPES.events_calendar;
    if (!block?.hydrate) return;

    const session = getSession();
    const role = getRole();
    const ctx: BlockRenderContext = {
      admin: role === 'admin',
      authenticated: !!session,
      currentPath: window.location.pathname,
      isFeatureEnabled,
      locale: getLocale(),
      role: (role as BlockRenderContext['role']) ?? null,
      session,
    };

    await block.hydrate(wrapper, CALENDAR_SECTION, ctx);
  }, []);

  useEffect(() => {
    void hydrateCalendar();
    document.addEventListener('astro:after-swap', hydrateCalendar);
    document.addEventListener('wl-locale-changed', hydrateCalendar);
    return () => {
      document.removeEventListener('astro:after-swap', hydrateCalendar);
      document.removeEventListener('wl-locale-changed', hydrateCalendar);
    };
  }, [hydrateCalendar]);

  return null;
}
