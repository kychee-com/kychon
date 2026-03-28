// schedule: none (triggered by client after auth callback)
import { db, getUser } from '@run402/functions';

export default async (req) => {
  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check if user already has a member record
  const existing = await db.from('members').select('id,role,status').eq('user_id', user.id).limit(1);
  if (existing.length > 0) {
    return new Response(JSON.stringify({
      status: 'exists', member_id: existing[0].id, role: existing[0].role,
    }));
  }

  // Get request body (client passes email as fallback since getUser doesn't include it)
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
  const countResult = await db.sql('SELECT count(*)::int as count FROM members');
  const isFirst = countResult.rows.length === 0 || countResult.rows[0].count === 0;

  const role = isFirst ? 'admin' : 'member';
  const memberStatus = isFirst ? 'active' : 'pending';

  // Get default tier
  const defaultTier = await db.from('membership_tiers').select('id').eq('is_default', true).limit(1);
  const tierId = defaultTier.length > 0 ? defaultTier[0].id : null;

  // Create member record
  const created = await db.from('members').insert({
    user_id: user.id,
    email,
    display_name: displayName,
    avatar_url: avatarUrl,
    tier_id: tierId,
    role,
    status: memberStatus,
  }).select('id,role,status');

  if (created.length === 0) {
    return new Response(JSON.stringify({ error: 'Failed to create member' }), { status: 500 });
  }

  const member = created[0];

  // Log activity
  await db.from('activity_log').insert({
    member_id: member.id,
    action: 'signup',
    metadata: { role, is_first: isFirst },
  });

  // AI Personalized Onboarding (if enabled)
  if (process.env.AI_API_KEY) {
    try {
      const aiFlag = await db.from('site_config').select('value').eq('key', 'feature_ai_onboarding').limit(1);
      if (aiFlag.length > 0 && (aiFlag[0].value === true || aiFlag[0].value === 'true')) {
        const provider = process.env.AI_PROVIDER || 'openai';
        const tierName = tierId ? (await db.from('membership_tiers').select('name').eq('id', tierId).limit(1))[0]?.name : 'Member';
        const prompt = `Write a warm, personalized welcome message for a new community member. Name: ${displayName}. Tier: ${tierName}. Keep it under 450 characters, friendly and concise. Include 1-2 suggestions for what to explore first.`;

        let welcomeMsg = null;
        try {
          if (provider === 'anthropic') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': process.env.AI_API_KEY, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 256, messages: [{ role: 'user', content: prompt }] }),
            });
            const data = await res.json();
            welcomeMsg = data.content?.[0]?.text;
          } else {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + process.env.AI_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 256 }),
            });
            const data = await res.json();
            welcomeMsg = data.choices?.[0]?.message?.content;
          }
        } catch (e) { console.warn('AI onboarding failed:', e.message); }

        // Send welcome email if mailbox configured
        if (welcomeMsg && process.env.MAILBOX_ID && email) {
          try {
            await fetch(`https://api.run402.com/mailboxes/v1/${process.env.MAILBOX_ID}/messages`, {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + process.env.RUN402_SERVICE_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ template: 'notification', to: email, variables: { project_name: 'Wild Lychee Community', message: welcomeMsg.substring(0, 500) } }),
            });
          } catch (e) { console.warn('Welcome email failed:', e.message); }
        }
      }
    } catch (e) { console.warn('AI onboarding check failed:', e.message); }
  }

  return new Response(JSON.stringify({
    status: 'created',
    member_id: member.id,
    role: member.role,
    member_status: member.status,
  }));
};
