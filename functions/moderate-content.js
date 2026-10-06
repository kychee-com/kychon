// prototype-schedule: "*/15 * * * *" (requires hobby tier — prototype allows only 1 scheduled fn)
import { adminDb, ai, auth } from '@run402/functions';

export default async (req) => {
  const admin = adminDb();

  // A run spends the project's AI moderation quota, hides posts, and on a large
  // backlog outlasts the function timeout, so anonymous callers must not start one.
  const denied = await authorizeRun(req, admin);
  if (denied) return denied;

  // Check if feature is enabled
  const flag = await admin.from('site_config').select('value').eq('key', 'feature_ai_moderation').limit(1);
  if (!flag.length || (flag[0].value !== true && flag[0].value !== 'true')) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'feature_ai_moderation disabled' }));
  }

  let moderated = 0;

  // Find last moderation timestamp
  const lastCheck = await admin.sql('SELECT max(created_at) as last_at FROM moderation_log');
  const lastAt = (lastCheck.rows || lastCheck)[0]?.last_at || '1970-01-01T00:00:00Z';

  // Get new forum topics since last check
  const newTopics = await admin
    .from('forum_topics')
    .select('id,title,body,author_id')
    .gt('created_at', lastAt)
    .eq('hidden', false);

  for (const topic of newTopics) {
    const result = await moderateContent(`${topic.title}\n\n${topic.body}`);
    if (result.confidence > 0.7 && result.flagged) {
      await admin.from('forum_topics').update({ hidden: true }).eq('id', topic.id);
    }
    await admin.from('moderation_log').insert({
      content_type: 'forum_topic',
      content_id: topic.id,
      action: result.action,
      reason: result.reason,
      confidence: result.confidence,
    });
    moderated++;
  }

  // Get new forum replies since last check
  const newReplies = await admin
    .from('forum_replies')
    .select('id,body,author_id')
    .gt('created_at', lastAt)
    .eq('hidden', false);

  for (const reply of newReplies) {
    const result = await moderateContent(reply.body);
    if (result.confidence > 0.7 && result.flagged) {
      await admin.from('forum_replies').update({ hidden: true }).eq('id', reply.id);
    }
    await admin.from('moderation_log').insert({
      content_type: 'forum_reply',
      content_id: reply.id,
      action: result.action,
      reason: result.reason,
      confidence: result.confidence,
    });
    moderated++;
  }

  return new Response(JSON.stringify({ status: 'ok', moderated }));
};

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
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!row && email) {
    const byEmail = await admin.from('members').select('role,status').eq('email', email).limit(1);
    row = byEmail?.[0];
  }
  if (!row) return null;
  return {
    role: String(row.role || 'member').toLowerCase(),
    status: String(row.status || 'pending').toLowerCase(),
  };
}

async function moderateContent(text) {
  try {
    const result = await ai.moderate(text.substring(0, 10000));
    const scores = result.category_scores || {};
    const entries = Object.entries(scores);
    const maxEntry = entries.reduce((a, b) => (b[1] > a[1] ? b : a), ['unknown', 0]);
    const confidence = maxEntry[1];
    const reason = maxEntry[0];

    if (!result.flagged) {
      return { action: 'approved', confidence, reason, flagged: false };
    }
    if (confidence > 0.7) {
      return { action: 'hidden', confidence, reason, flagged: true };
    }
    return { action: 'flagged', confidence, reason, flagged: true };
  } catch (e) {
    console.warn('ai.moderate() failed:', e.message);
    return { action: 'approved', confidence: 0, reason: 'moderation unavailable', flagged: false };
  }
}
