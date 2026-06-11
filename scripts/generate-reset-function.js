#!/usr/bin/env node
// Generates reset-demo.js for a demo site by embedding its seed SQL
// Usage: node scripts/generate-reset-function.js demo/silver-pines/seed.sql > demo/silver-pines/reset-demo.js

import { readFileSync } from 'node:fs';

const seedPath = process.argv[2];
if (!seedPath) {
  console.error('Usage: node scripts/generate-reset-function.js <seed.sql> [cron-schedule]');
  process.exit(1);
}

// Optional per-demo cron schedule. The three demos are staggered across the
// hour (see scripts/deploy-demo.ts) so their hourly resets don't all fire at
// :00 and stack on the shared Aurora writer (run402-private#494). Defaults to
// top-of-hour for standalone / manual regeneration.
const schedule = process.argv[3] || '0 * * * *';

const seedSQL = readFileSync(seedPath, 'utf-8');

// Escape backticks and ${} for JS template literal
const escaped = seedSQL.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const output = `// schedule: "${schedule}"
// Reset demo site to seed state — auto-generated, do not edit manually
// Regenerate with: node scripts/generate-reset-function.js <seed.sql>
import { adminDb } from '@run402/functions';

const SEED_SQL = \`${escaped}\`;

const MUTABLE_TABLES = [
  'newsletter_drafts', 'member_insights', 'moderation_log',
  'content_translations', 'committee_members', 'committees',
  'forum_replies', 'forum_topics', 'forum_categories',
  'reactions', 'activity_log', 'poll_votes', 'poll_options',
  'polls', 'event_rsvps', 'events',
  'resources', 'announcements',
];

export default async (_req) => {
  // 1. Read demo account user_ids
  const configResult = await adminDb().sql("SELECT value FROM site_config WHERE key = 'demo_accounts'");
  const demoAccounts = configResult.rows?.[0]?.value || {};
  const adminUserId = demoAccounts.admin_user_id;
  const memberUserId = demoAccounts.member_user_id;

  // 2. Wipe mutable content tables in ONE multi-table TRUNCATE. A single
  //    statement is one transaction = one PostgREST schema-cache reload, vs
  //    one reload per table: 18 per-table TRUNCATEs x 3 demos all firing at
  //    :00 pegged the shared Aurora writer to 100% (run402-private#494).
  //    CASCADE + the FK-safe ordering of MUTABLE_TABLES preserve the prior
  //    semantics (multi-table TRUNCATE is order-independent anyway).
  await adminDb().sql(\`TRUNCATE \${MUTABLE_TABLES.join(', ')} CASCADE\`);

  // 3. Delete non-demo members (keep demo accounts by user_id)
  // First nullify tier_id on kept members to avoid FK constraint on membership_tiers
  if (adminUserId || memberUserId) {
    const keepIds = [adminUserId, memberUserId].filter(Boolean).map(id => \`'\${id}'\`).join(',');
    await adminDb().sql(\`UPDATE members SET tier_id = NULL WHERE user_id IN (\${keepIds})\`);
    await adminDb().sql(\`DELETE FROM members WHERE user_id IS NULL OR user_id NOT IN (\${keepIds})\`);
  } else {
    await adminDb().sql('DELETE FROM members');
  }

  // 4. Reset membership_tiers, pages, sections, custom_fields
  await adminDb().sql('DELETE FROM membership_tiers');
  await adminDb().sql('DELETE FROM sections');
  await adminDb().sql('DELETE FROM pages');
  await adminDb().sql('DELETE FROM member_custom_fields');

  // 5. Re-run seed SQL (idempotent INSERTs). Capture any error so reset still
  //    reports success for non-section work; the caller surfaces seed_error.
  let seedError = null;
  try {
    await adminDb().sql(SEED_SQL);
  } catch (e) {
    seedError = String(e?.message ?? e);
  }
  // Diagnostic: count sections by zone after seed.
  const zoneCounts = await adminDb().sql("SELECT zone, COUNT(*)::int AS n FROM sections GROUP BY zone");

  // 6. Re-link demo accounts to seed member records
  if (adminUserId) {
    // Link admin user_id to the first admin member record
    const adminMembers = await adminDb().sql("SELECT id FROM members WHERE role = 'admin' AND (user_id IS NULL OR user_id = '" + adminUserId + "') ORDER BY id LIMIT 1");
    if (adminMembers.rows?.length) {
      await adminDb().sql("UPDATE members SET user_id = '" + adminUserId + "', status = 'active' WHERE id = " + adminMembers.rows[0].id);
    }
  }
  if (memberUserId) {
    // Link member user_id to the first non-admin active member
    const memberRecords = await adminDb().sql("SELECT id FROM members WHERE role = 'member' AND (user_id IS NULL OR user_id = '" + memberUserId + "') ORDER BY id LIMIT 1");
    if (memberRecords.rows?.length) {
      await adminDb().sql("UPDATE members SET user_id = '" + memberUserId + "', status = 'active' WHERE id = " + memberRecords.rows[0].id);
    }
  }

  // 7. Write last_reset timestamp
  const now = new Date().toISOString();
  await adminDb().sql(\`INSERT INTO site_config (key, value, category) VALUES ('last_reset', '"\${now}"', 'features') ON CONFLICT (key) DO UPDATE SET value = '"\${now}"'\`);

  return new Response(JSON.stringify({
    status: 'ok',
    reset_at: now,
    seed_error: seedError,
    section_zones: zoneCounts.rows ?? zoneCounts,
  }));
};
`;

process.stdout.write(output);
