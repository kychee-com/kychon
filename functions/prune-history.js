// schedule: "23 3 * * *"
// Content-history retention (openspec content-history D8): daily, delete
// revisions older than site_config.history_retention_days (default 365),
// keeping the newest revision of every row, plus empty changesets.
import { adminDb } from '@run402/functions';

export default async (_req) => {
  const result = await adminDb().sql('SELECT kychon_prune_history() AS summary');
  const summary = (result?.rows ?? result)?.[0]?.summary ?? null;
  return new Response(JSON.stringify({ status: 'ok', summary }), {
    headers: { 'content-type': 'application/json' },
  });
};
