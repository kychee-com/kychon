// schedule: none — moderates one forum post per run. kychon-api queues a
// Run402 function run of this function for each topic or reply a member
// creates (event type forum.post_created); an admin may also call it with
// { content_type, content_id } to moderate a post by hand.
import { adminDb, ai, auth } from '@run402/functions';

const POSTS = new Map([
  ['forum_topic', { table: 'forum_topics', columns: 'id,title,body,hidden', text: (p) => `${p.title}\n\n${p.body}` }],
  ['forum_reply', { table: 'forum_replies', columns: 'id,body,hidden', text: (p) => p.body }],
]);

export default async (req) => {
  const admin = adminDb();

  // A run spends the project's AI moderation quota and hides posts, so
  // anonymous callers must not start one.
  const denied = await authorizeRun(req, admin);
  if (denied) return denied;

  const ref = await postReference(req);
  const post = POSTS.get(ref.contentType);
  if (!post || ref.contentId == null) {
    return json({ error: 'content_type (forum_topic or forum_reply) and content_id are required' }, 400);
  }

  // Check if feature is enabled
  const flag = await admin.from('site_config').select('value').eq('key', 'feature_ai_moderation').limit(1);
  if (!flag.length || (flag[0].value !== true && flag[0].value !== 'true')) {
    return json({ status: 'skipped', reason: 'feature_ai_moderation disabled' });
  }

  // A retried or repeated run moderates a post once.
  const logged = await admin
    .from('moderation_log')
    .select('id')
    .eq('content_type', ref.contentType)
    .eq('content_id', ref.contentId)
    .limit(1);
  if (logged.length) return json({ status: 'skipped', reason: 'already moderated' });

  const row = (await admin.from(post.table).select(post.columns).eq('id', ref.contentId).limit(1))[0];
  if (!row) return json({ status: 'skipped', reason: 'post not found' });
  if (row.hidden === true) return json({ status: 'skipped', reason: 'post already hidden' });

  const result = await moderateContent(post.text(row));
  if (result.confidence > 0.7 && result.flagged) {
    await admin.from(post.table).update({ hidden: true }).eq('id', row.id);
  }
  await admin.from('moderation_log').insert({
    content_type: ref.contentType,
    content_id: row.id,
    action: result.action,
    reason: result.reason,
    confidence: result.confidence,
  });

  return json({ status: 'ok', action: result.action });
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

// The post to moderate: a function run's payload, or an admin's request body.
async function postReference(req) {
  let body = null;
  try {
    body = await req.json();
  } catch {}
  const input = body?.trigger === 'function_run' && body.payload ? body.payload : body;
  const id = Number(input?.content_id);
  return {
    contentType: typeof input?.content_type === 'string' ? input.content_type : null,
    contentId: Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null,
  };
}

// Only the platform (a function run it starts, such as the ones kychon-api
// queues) or an admin may run this. The gateway sets x-run402-trigger on the
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
  return (member?.role === 'admin' || member?.role === 'owner') && member?.status === 'active';
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
