// Lifecycle hook: called automatically by Run402 after first signup (fire-and-forget).
// Also supports direct invocation with auth token for backward compatibility.
import { adminDb, auth } from '@run402/functions';

export default async (req) => {
  // Determine user identity from lifecycle hook payload or auth token
  let userId, memberEmail;

  const isLifecycleHook = req.headers.get('x-run402-trigger') === 'signup';

  if (isLifecycleHook) {
    // Lifecycle hook: user info in request body, no auth token
    const body = await req.json();
    userId = body.user?.id;
    memberEmail = body.user?.email || '';
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing user.id in hook payload' }), { status: 400 });
    }
  } else {
    // Direct invocation: read actor from the platform's verified envelope.
    // Returns null for anonymous; we preserve the legacy `{ error: 'Unauthorized' }`
    // response shape rather than letting auth.requireUser() throw, because the
    // platform's 401 envelope shape differs and BC callers parse this body.
    const user = await auth.user();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    userId = user.id;
    memberEmail = user.email || '';
    // Fallback: try request body for email
    if (!memberEmail) {
      try {
        const body = await req.json();
        memberEmail = body.email || '';
      } catch {}
    }
  }

  // Check if user already has a member record
  const existing = await adminDb().from('members').select('id,role,status').eq('user_id', userId).limit(1);
  if (existing.length > 0) {
    return new Response(
      JSON.stringify({
        status: 'exists',
        member_id: existing[0].id,
        role: existing[0].role,
      }),
    );
  }

  // Get user details from auth endpoint (for display_name, avatar)
  let authUser = {};
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (token) {
    try {
      const authRes = await fetch('https://api.run402.com/auth/v1/user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (authRes.ok) authUser = await authRes.json();
    } catch {}
  }

  if (!memberEmail) memberEmail = authUser.email || '';
  const displayName = authUser.display_name || (memberEmail ? memberEmail.split('@')[0] : 'Member');
  const avatarUrl = authUser.avatar_url || null;

  // Check if this is the first user (becomes admin)
  const countResult = await adminDb().sql('SELECT count(*)::int as count FROM members');
  const isFirst = countResult.rows.length === 0 || countResult.rows[0].count === 0;

  const role = isFirst ? 'admin' : 'member';
  const memberStatus = isFirst ? 'active' : 'pending';

  // Get default tier
  const defaultTier = await adminDb().from('membership_tiers').select('id').eq('is_default', true).limit(1);
  const tierId = defaultTier.length > 0 ? defaultTier[0].id : null;

  // Create member record. adminDb().from(t).insert(row) returns the inserted
  // row(s); the platform doesn't support a `.select(...)` chain on insert, so
  // we read the first element directly.
  const created = await adminDb().from('members').insert({
    user_id: userId,
    email: memberEmail,
    display_name: displayName,
    avatar_url: avatarUrl,
    tier_id: tierId,
    role,
    status: memberStatus,
  });

  const member = Array.isArray(created) ? created[0] : created;
  if (!member?.id) {
    return new Response(JSON.stringify({ error: 'Failed to create member' }), { status: 500 });
  }

  // Log activity
  await adminDb()
    .from('activity_log')
    .insert({
      member_id: member.id,
      action: 'signup',
      metadata: { role, is_first: isFirst },
    });

  return new Response(
    JSON.stringify({
      status: 'created',
      member_id: member.id,
      role: member.role,
      member_status: member.status,
    }),
  );
};
