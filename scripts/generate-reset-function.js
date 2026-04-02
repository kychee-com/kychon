#!/usr/bin/env node
// Generates reset-demo.js for a demo site by embedding its seed SQL
// Usage: node scripts/generate-reset-function.js demo/silver-pines/seed.sql > demo/silver-pines/reset-demo.js

import { readFileSync } from 'node:fs';

const seedPath = process.argv[2];
if (!seedPath) {
  console.error('Usage: node scripts/generate-reset-function.js <seed.sql>');
  process.exit(1);
}

const seedSQL = readFileSync(seedPath, 'utf-8');

// Escape backticks and ${} for JS template literal
const escaped = seedSQL.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const output = `// schedule: "0 * * * *"
// Reset demo site to seed state — auto-generated, do not edit manually
// Regenerate with: node scripts/generate-reset-function.js <seed.sql>
import { db } from 'run402-functions';

const SEED_SQL = \`${escaped}\`;

const MUTABLE_TABLES = [
  'newsletter_drafts', 'member_insights', 'moderation_log',
  'content_translations', 'committee_members', 'committees',
  'forum_replies', 'forum_topics', 'forum_categories',
  'reactions', 'activity_log', 'event_rsvps', 'events',
  'resources', 'announcements',
];

export default async (_req) => {
  // 1. Read demo account user_ids
  const configResult = await db.sql("SELECT value FROM site_config WHERE key = 'demo_accounts'");
  const demoAccounts = configResult.rows?.[0]?.value || {};
  const adminUserId = demoAccounts.admin_user_id;
  const memberUserId = demoAccounts.member_user_id;

  // 2. TRUNCATE mutable content tables (order matters for FK constraints)
  for (const table of MUTABLE_TABLES) {
    await db.sql(\`TRUNCATE \${table} CASCADE\`);
  }

  // 3. Delete non-demo members (keep demo accounts by user_id)
  // First nullify tier_id on kept members to avoid FK constraint on membership_tiers
  if (adminUserId || memberUserId) {
    const keepIds = [adminUserId, memberUserId].filter(Boolean).map(id => \`'\${id}'\`).join(',');
    await db.sql(\`UPDATE members SET tier_id = NULL WHERE user_id IN (\${keepIds})\`);
    await db.sql(\`DELETE FROM members WHERE user_id IS NULL OR user_id NOT IN (\${keepIds})\`);
  } else {
    await db.sql('DELETE FROM members');
  }

  // 4. Reset membership_tiers, pages, sections, custom_fields
  await db.sql('DELETE FROM membership_tiers');
  await db.sql('DELETE FROM sections');
  await db.sql('DELETE FROM pages');
  await db.sql('DELETE FROM member_custom_fields');

  // 5. Re-run seed SQL (idempotent INSERTs)
  await db.sql(SEED_SQL);

  // 6. Re-link demo accounts to seed member records
  if (adminUserId) {
    // Link admin user_id to the first admin member record
    const adminMembers = await db.sql("SELECT id FROM members WHERE role = 'admin' AND (user_id IS NULL OR user_id = '" + adminUserId + "') ORDER BY id LIMIT 1");
    if (adminMembers.rows?.length) {
      await db.sql("UPDATE members SET user_id = '" + adminUserId + "', status = 'active' WHERE id = " + adminMembers.rows[0].id);
    }
  }
  if (memberUserId) {
    // Link member user_id to the first non-admin active member
    const memberRecords = await db.sql("SELECT id FROM members WHERE role = 'member' AND (user_id IS NULL OR user_id = '" + memberUserId + "') ORDER BY id LIMIT 1");
    if (memberRecords.rows?.length) {
      await db.sql("UPDATE members SET user_id = '" + memberUserId + "', status = 'active' WHERE id = " + memberRecords.rows[0].id);
    }
  }

  // 7. Write last_reset timestamp
  const now = new Date().toISOString();
  await db.sql(\`INSERT INTO site_config (key, value, category) VALUES ('last_reset', '"\${now}"', 'features') ON CONFLICT (key) DO UPDATE SET value = '"\${now}"'\`);

  return new Response(JSON.stringify({ status: 'ok', reset_at: now }));
};
`;

process.stdout.write(output);
