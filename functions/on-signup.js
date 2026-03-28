// schedule: none (triggered by client after auth callback)
import { db, getUser } from '@run402/functions';

export default async (req) => {
  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check if user already has a member record
  const existing = await db.from('members').select('id').eq('user_id', user.id).limit(1);
  if (existing.length > 0) {
    return new Response(JSON.stringify({ status: 'exists', member_id: existing[0].id }));
  }

  // Get user details from auth
  const authRes = await fetch(process.env.RUN402_API_BASE + '/auth/v1/user', {
    headers: { Authorization: 'Bearer ' + req.headers.get('Authorization')?.replace('Bearer ', '') },
  });
  const authUser = authRes.ok ? await authRes.json() : {};

  const displayName = authUser.display_name || authUser.email?.split('@')[0] || 'Member';
  const avatarUrl = authUser.avatar_url || null;
  const email = authUser.email || user.email || '';

  // Check if this is the first user (becomes admin)
  const memberCount = await db.sql('SELECT count(*)::int as count FROM members');
  const isFirst = memberCount[0]?.count === 0;

  const role = isFirst ? 'admin' : 'member';
  const status = isFirst ? 'active' : 'pending';

  // Get default tier
  const defaultTier = await db.from('membership_tiers').select('id').eq('is_default', true).limit(1);
  const tierId = defaultTier.length > 0 ? defaultTier[0].id : null;

  // Create member record
  const member = await db.sql(`
    INSERT INTO members (user_id, email, display_name, avatar_url, tier_id, role, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, role, status
  `, [user.id, email, displayName, avatarUrl, tierId, role, status]);

  // Log activity
  await db.sql(`
    INSERT INTO activity_log (member_id, action, metadata)
    VALUES ($1, 'signup', $2)
  `, [member[0].id, JSON.stringify({ role, is_first: isFirst })]);

  return new Response(JSON.stringify({
    status: 'created',
    member_id: member[0].id,
    role: member[0].role,
    member_status: member[0].status,
  }));
};
