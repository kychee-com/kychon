import { useSyncExternalStore } from 'react';
import { siteConfig } from './config';
import {
  type EventDateTimeFormatOptions,
  type EventDateTimeLabels,
  type EventTimeSource,
  formatEventDateTime,
  formatEventDateTimeStable,
} from './event-display';

const subscribeNever = () => () => {};

/**
 * False for the server render and the browser's hydration pass, true from the
 * re-render React schedules right after hydration (and immediately for trees
 * that mount client-side without server HTML).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

/**
 * Event date/time labels for React islands whose events are server-rendered.
 * The first pass uses `formatEventDateTimeStable` so server HTML and hydration
 * agree; after hydration the labels switch to the visitor's zone and the
 * site's display settings, as `formatEventDateTime` always rendered them.
 */
export function useEventDateTime(event: EventTimeSource, opts: EventDateTimeFormatOptions = {}): EventDateTimeLabels {
  const hydrated = useHydrated();
  return hydrated ? formatEventDateTime(event, undefined, siteConfig, opts) : formatEventDateTimeStable(event, undefined, opts);
}
