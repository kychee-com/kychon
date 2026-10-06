/**
 * Event tags (kychon#187): free-form labels on `events.tags` (TEXT[]) that an
 * `events_list` block filters on through `config.tags`, so an activity page
 * can list only its own events (a Wild Apricot "Upcoming events" gadget is
 * tag-filtered the same way).
 *
 * Tags are compared in one normalized form: trimmed, inner whitespace
 * collapsed, lowercased, de-duplicated. The `kychon_normalize_event_tags`
 * trigger in schema.sql stores them that way whatever the writer (admin UI,
 * capability API, an agent's SQL, a seed), and the filter side normalizes the
 * block config the same way, so "Paddling" in a config matches a stored
 * "paddling". Mirrored in functions/kychon-api.js (`normalizeEventTags`),
 * which deploys as one file and cannot import this module.
 */

/** Longest tag kept; longer input is cut, matching the schema trigger. */
export const EVENT_TAG_MAX_LENGTH = 64;

export function normalizeEventTag(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, EVENT_TAG_MAX_LENGTH)
    .trim();
}

/**
 * Normalize a tag list. Accepts an array or a comma-separated string (what an
 * admin types into a tags field); anything else is no tags.
 */
export function normalizeEventTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' && typeof item !== 'number') continue;
    const tag = normalizeEventTag(item);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/** The tags an `events_list` block filters on (`config.tags`); empty = no tag filter. */
export function eventsListTagFilter(config: Record<string, unknown> | null | undefined): string[] {
  return normalizeEventTags(config?.tags);
}

/** True when the event carries any of `filterTags`, or when there is no tag filter. */
export function eventMatchesTags(eventTags: unknown, filterTags: readonly string[]): boolean {
  if (filterTags.length === 0) return true;
  const tags = normalizeEventTags(eventTags);
  return tags.some((tag) => filterTags.includes(tag));
}

/** Display form for a tags input field. */
export function formatEventTags(value: unknown): string {
  return normalizeEventTags(value).join(', ');
}
