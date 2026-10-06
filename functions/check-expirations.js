// schedule: "0 8 * * *"
import { adminDb, auth, email } from '@run402/functions';

export default async (req) => {
  // A run emails members and can spend the portal's AI key, so anonymous
  // callers must not start one.
  const denied = await authorizeRun(req, adminDb());
  if (denied) return denied;

  const _now = new Date().toISOString();
  const results = { reminders_sent: 0, insights_generated: 0 };

  // Find members expiring in 7, 14, 30 days
  for (const days of [7, 14, 30]) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const nextDay = new Date(cutoff);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    const expiring = await adminDb()
      .from('members')
      .select('id,email,display_name')
      .eq('status', 'active')
      .gte('expires_at', cutoffStr)
      .lt('expires_at', nextDayStr);

    for (const member of expiring) {
      if (member.email) {
        try {
          await email.send({
            to: member.email,
            subject: `Membership Renewal Reminder — ${days} days left`,
            html: `<p>Hi ${escapeHtml(member.display_name)},</p><p>Your membership expires in <strong>${days} days</strong>. Please renew to keep your access to the community.</p>`,
            from_name: 'Kychon Community',
          });
          results.reminders_sent++;
        } catch (e) {
          console.warn('Email failed for member', member.id, e.message);
        }
      }
    }
  }

  // AI Insights (if enabled)
  if (process.env.AI_API_KEY) {
    try {
      // Check if feature is enabled
      const flag = await adminDb().from('site_config').select('value').eq('key', 'feature_ai_insights').limit(1);
      if (flag.length > 0 && (flag[0].value === true || flag[0].value === 'true')) {
        results.insights_generated = await generateInsights();
      }
    } catch (e) {
      console.warn('AI insights failed:', e.message);
    }
  }

  return new Response(JSON.stringify({ status: 'ok', ...results }));
};

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Only the platform (a schedule trigger, or the owner's `run402 functions runs
// create`) or an admin may run this. The gateway sets x-run402-trigger on the
// runs it starts and never forwards a caller's x-run402-* headers to a function.
async function authorizeRun(req, admin) {
  if (req.headers.get('x-run402-trigger')) return null;
  const user = await auth.user();
  if (!user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  if (!(await isActiveAdmin(admin, user))) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
  }
  return null;
}

// An active member with role admin (matched by user id, then email, as
// kychon-api resolves actors) or a project admin.
async function isActiveAdmin(admin, user) {
  if (isProjectAdmin(user)) return true;
  const member = await findMember(admin, user);
  return member?.role === 'admin' && member?.status === 'active';
}

function isProjectAdmin(user) {
  return (
    user.is_admin === true ||
    user.role === 'project_admin' ||
    user.app_metadata?.role === 'project_admin' ||
    user.app_metadata?.is_admin === true
  );
}

async function findMember(admin, user) {
  // run402-allow-user-filter: adminDb() bypasses RLS to map the actor to its member row
  const byUserId = await admin.from('members').select('role,status').eq('user_id', user.id).limit(1);
  let row = byUserId?.[0];
  const address = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!row && address) {
    const byEmail = await admin.from('members').select('role,status').eq('email', address).limit(1);
    row = byEmail?.[0];
  }
  if (!row) return null;
  return {
    role: String(row.role || 'member').toLowerCase(),
    status: String(row.status || 'pending').toLowerCase(),
  };
}

async function generateInsights() {
  let count = 0;
  const provider = process.env.AI_PROVIDER || 'openai';

  // Expiring members (7 days)
  const sevenDays = new Date();
  sevenDays.setDate(sevenDays.getDate() + 7);
  const expiring = await adminDb()
    .from('members')
    .select('id,display_name,email,expires_at')
    .eq('status', 'active')
    .lt('expires_at', sevenDays.toISOString());

  for (const m of expiring) {
    // Skip if recent insight exists
    const existing = await adminDb()
      .from('member_insights')
      .select('id')
      .eq('member_id', m.id)
      .eq('insight_type', 'expiring')
      .eq('status', 'pending')
      .limit(1);
    if (existing.length > 0) continue;

    const message = await callAI(
      provider,
      `Generate a brief, friendly outreach suggestion for a community admin. The member "${m.display_name}" has their membership expiring on ${m.expires_at}. Suggest what to say to encourage renewal. Keep it under 200 characters.`,
    );

    await adminDb()
      .from('member_insights')
      .insert({
        member_id: m.id,
        insight_type: 'expiring',
        message:
          message || `${m.display_name}'s membership is expiring soon. Consider reaching out to encourage renewal.`,
        priority: 'high',
      });
    count++;
  }

  // Inactive members (30+ days no activity)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const result = await adminDb().sql(`
    SELECT m.id, m.display_name FROM members m
    WHERE m.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM activity_log a WHERE a.member_id = m.id AND a.created_at > '${thirtyDaysAgo.toISOString()}'
    )
    LIMIT 20
  `);
  const inactive = result.rows || result;

  for (const m of inactive) {
    const existing = await adminDb()
      .from('member_insights')
      .select('id')
      .eq('member_id', m.id)
      .eq('insight_type', 'inactive')
      .eq('status', 'pending')
      .limit(1);
    if (existing.length > 0) continue;

    const message = await callAI(
      provider,
      `Generate a brief re-engagement suggestion for community admin. Member "${m.display_name}" has been inactive for 30+ days. Suggest how to bring them back. Under 200 characters.`,
    );

    await adminDb()
      .from('member_insights')
      .insert({
        member_id: m.id,
        insight_type: 'inactive',
        message: message || `${m.display_name} hasn't been active in 30+ days. Consider a personal check-in.`,
        priority: 'medium',
      });
    count++;
  }

  return count;
}

async function callAI(provider, prompt) {
  try {
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.AI_API_KEY,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      return data.content?.[0]?.text || null;
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 256,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    }
  } catch (e) {
    console.warn('AI call failed:', e.message);
    return null;
  }
}
