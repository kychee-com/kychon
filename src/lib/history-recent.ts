// The content-history changesets the most recent admin action recorded
// (for Undo). api.ts records them from each mutation's
// ActionResult.history; the save toast takes them to offer Undo. Kept
// dependency-free so api.ts can import it without a cycle.

const UNDO_WINDOW_MS = 5000;

let recent: { ids: string[]; at: number } | null = null;

/** Record the changesets an action result reports (no-op when it has none). */
export function rememberChangesets(result: unknown): void {
  const ids = (result as { history?: { changesetIds?: unknown } } | null)?.history?.changesetIds;
  if (!Array.isArray(ids) || ids.length === 0) return;
  const clean = ids.map(String);
  recent = recent && Date.now() - recent.at < UNDO_WINDOW_MS ? { ids: [...recent.ids, ...clean], at: Date.now() } : { ids: clean, at: Date.now() };
}

/** Take (and clear) the changesets recorded in the last few seconds. */
export function takeRecentChangesets(now: number = Date.now()): string[] {
  const taken = recent && now - recent.at < UNDO_WINDOW_MS ? recent.ids : [];
  recent = null;
  return taken;
}
