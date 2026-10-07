// schedule: "23 3 * * *"
// Content-history retention: daily, delete
// revisions older than site_config.history_retention_days (default 365),
// keeping the newest revision of every row, plus empty changesets.
import { adminDb, auth } from '@run402/functions';

export default async (req) => {
  const admin = adminDb();

  // Pruning deletes history rows in bulk, so anonymous callers must not be
  // able to run it on demand.
  const denied = await authorizeRun(req, admin);
  if (denied) return denied;

  const result = await admin.sql('SELECT kychon_prune_history() AS summary');
  const summary = (result?.rows ?? result)?.[0]?.summary ?? null;
  return new Response(JSON.stringify({ status: 'ok', summary }), {
    headers: { 'content-type': 'application/json' },
  });
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
