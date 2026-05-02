// calendar-cache.ts — Stale-while-revalidate cache for calendar event windows.
//
// Each visible 6-week window keys against `wl_cache_events_{yyyy-mm}_window`.
// Idle prefetch warms ±1 month so navigation feels instant.

import type { Event } from '../schemas/event.js';
import { getEventWindow, getRsvpsForEvents, type RsvpAvatar } from './api.js';

const EVENTS_PREFIX = 'wl_cache_events_';
const RSVPS_PREFIX = 'wl_cache_rsvps_';
const TTL_MS = 5 * 60 * 1000;

interface CachedWindow<T> {
  data: T;
  ts: number;
}

function readCache<T>(prefix: string, key: string): T | null {
  try {
    const raw = localStorage.getItem(prefix + key);
    if (!raw) return null;
    const parsed: CachedWindow<T> = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function writeCache<T>(prefix: string, key: string, data: T): void {
  try {
    localStorage.setItem(prefix + key, JSON.stringify({ data, ts: Date.now() } satisfies CachedWindow<T>));
  } catch {}
}

function isFresh(prefix: string, key: string): boolean {
  try {
    const raw = localStorage.getItem(prefix + key);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return typeof ts === 'number' && ts + TTL_MS > Date.now();
  } catch {
    return false;
  }
}

export function windowKey(start: Date): string {
  // Anchor on the first day of the visible window so adjacent months key cleanly.
  const y = start.getUTCFullYear();
  const m = String(start.getUTCMonth() + 1).padStart(2, '0');
  const d = String(start.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function readEventWindow(key: string): Event[] | null {
  return readCache<Event[]>(EVENTS_PREFIX, key);
}

export function readRsvpsForWindow(key: string): RsvpAvatar[] | null {
  return readCache<RsvpAvatar[]>(RSVPS_PREFIX, key);
}

export interface FetchWindowOpts {
  startIso: string;
  endIso: string;
  key: string;
  withRsvps: boolean;
  onEvents?: (events: Event[]) => void;
  onRsvps?: (rsvps: RsvpAvatar[]) => void;
}

export async function fetchAndUpdateWindow(opts: FetchWindowOpts): Promise<{
  events: Event[];
  rsvps: RsvpAvatar[];
}> {
  const cachedEvents = readEventWindow(opts.key);
  let events: Event[] = [];
  try {
    events = await getEventWindow(opts.startIso, opts.endIso);
  } catch (e) {
    console.warn('events window fetch failed:', e);
    return { events: cachedEvents ?? [], rsvps: readRsvpsForWindow(opts.key) ?? [] };
  }
  writeCache(EVENTS_PREFIX, opts.key, events);
  if (
    opts.onEvents &&
    (!cachedEvents || JSON.stringify(cachedEvents) !== JSON.stringify(events))
  ) {
    opts.onEvents(events);
  }

  let rsvps: RsvpAvatar[] = readRsvpsForWindow(opts.key) ?? [];
  if (opts.withRsvps && events.length) {
    try {
      rsvps = await getRsvpsForEvents(events.map((e) => e.id));
      writeCache(RSVPS_PREFIX, opts.key, rsvps);
      opts.onRsvps?.(rsvps);
    } catch (e) {
      console.warn('rsvp window fetch failed:', e);
    }
  }
  return { events, rsvps };
}

export interface IdlePrefetchOpts {
  prevStart: Date;
  prevEnd: Date;
  nextStart: Date;
  nextEnd: Date;
  withRsvps: boolean;
}

const idleHandles = new Set<number>();

export function schedulePrefetch(opts: IdlePrefetchOpts): void {
  const cb = () => {
    const ranges = [
      { start: opts.prevStart, end: opts.prevEnd },
      { start: opts.nextStart, end: opts.nextEnd },
    ];
    for (const r of ranges) {
      const key = windowKey(r.start);
      if (isFresh(EVENTS_PREFIX, key)) continue;
      void fetchAndUpdateWindow({
        startIso: r.start.toISOString(),
        endIso: r.end.toISOString(),
        key,
        withRsvps: opts.withRsvps,
      });
    }
  };
  const w: any = typeof window !== 'undefined' ? window : null;
  if (!w) return;
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(cb, { timeout: 2500 }) as number;
    idleHandles.add(id);
  } else {
    const id = w.setTimeout(cb, 800) as number;
    idleHandles.add(id);
  }
}

export function cancelPendingPrefetches(): void {
  for (const id of idleHandles) {
    if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
      try {
        (window as any).cancelIdleCallback(id);
      } catch {}
    }
    try {
      window.clearTimeout(id);
    } catch {}
  }
  idleHandles.clear();
}

export function invalidateAllEventCaches(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(EVENTS_PREFIX) || k.startsWith(RSVPS_PREFIX))) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {}
}

export function invalidateWindow(key: string): void {
  try {
    localStorage.removeItem(EVENTS_PREFIX + key);
    localStorage.removeItem(RSVPS_PREFIX + key);
  } catch {}
}
