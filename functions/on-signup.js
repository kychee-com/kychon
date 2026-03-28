// schedule: none (triggered by client after auth callback)
import { db, getUser } from '@run402/functions';

function esc(s) {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// db.sql returns { rows: [...], rowCount: N } or a plain array depending on Run402 version.
// This helper normalizes the result to always be an array.
function rows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

export default async (req) => {
  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check if user already has a member record
  const existing = rows(await db.sql(
    `SELECT id, role, status FROM members WHERE user_id = ${esc(user.id)} LIMIT 1`
  ));
  if (existing.length > 0) {
    return new Response(JSON.stringify({
      status: 'exists', member_id: existing[0].id, role: existing[0].role,
    }));
  }

  // Get request body (client may pass email)
  let body = {};
  try { body = await req.json(); } catch (e) { /* no body */ }

  // Get user details from auth endpoint
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  let authUser = {};
  try {
    const authRes = await fetch('https://api.run402.com/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (authRes.ok) authUser = await authRes.json();
  } catch (e) { /* fall back */ }

  const email = authUser.email || body.email || user.email || '';
  const displayName = authUser.display_name || (email ? email.split('@')[0] : 'Member');
  const avatarUrl = authUser.avatar_url || null;

  // Check if this is the first user (becomes admin)
  const countResult = rows(await db.sql('SELECT count(*)::int as count FROM members'));
  const isFirst = countResult.length === 0 || countResult[0].count === 0;

  const role = isFirst ? 'admin' : 'member';
  const memberStatus = isFirst ? 'active' : 'pending';

  // Get default tier
  const tierResult = rows(await db.sql(
    "SELECT id FROM membership_tiers WHERE is_default = true LIMIT 1"
  ));
  const tierId = tierResult.length > 0 ? tierResult[0].id : 'NULL';

  // Create member record
  await db.sql(
    `INSERT INTO members (user_id, email, display_name, avatar_url, tier_id, role, status)
     VALUES (${esc(user.id)}, ${esc(email)}, ${esc(displayName)}, ${esc(avatarUrl)}, ${tierId}, ${esc(role)}, ${esc(memberStatus)})`
  );

  // Get the created member
  const created = rows(await db.sql(
    `SELECT id, role, status FROM members WHERE user_id = ${esc(user.id)} LIMIT 1`
  ));

  if (created.length === 0) {
    return new Response(JSON.stringify({ error: 'Failed to create member' }), { status: 500 });
  }

  const member = created[0];

  // Log activity
  await db.sql(
    `INSERT INTO activity_log (member_id, action, metadata)
     VALUES (${member.id}, 'signup', ${esc(JSON.stringify({ role, is_first: isFirst }))})`
  );

  return new Response(JSON.stringify({
    status: 'created',
    member_id: member.id,
    role: member.role,
    member_status: member.status,
  }));
};
