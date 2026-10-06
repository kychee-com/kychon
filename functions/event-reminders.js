// prototype-schedule: "0 * * * *" (requires hobby tier — prototype allows only 1 scheduled fn)
import { adminDb, auth, email } from '@run402/functions';

export default async (req) => {
  const admin = adminDb();

  // A run emails members, so anonymous callers must not start one.
  const denied = await authorizeRun(req, admin);
  if (denied) return denied;

  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  let sent = 0;

  // Find events starting within the next hour
  const events = await admin
    .from('events')
    .select('id,title,starts_at,location')
    .gte('starts_at', now.toISOString())
    .lt('starts_at', oneHourFromNow.toISOString());

  for (const event of events) {
    // Claim the going/maybe RSVPs that have not had a reminder yet before
    // emailing them, so each RSVP gets at most one reminder however often this
    // runs (a retried run, overlapping runs, an admin running it by hand).
    const claimed = await admin.sql(
      `UPDATE event_rsvps r SET reminder_sent_at = now()
         FROM members m
        WHERE r.event_id = $1 AND m.id = r.member_id
          AND r.status IN ('going', 'maybe') AND r.reminder_sent_at IS NULL AND m.email <> ''
        RETURNING m.email, m.display_name`,
      [event.id],
    );
    const attendees = claimed.rows || claimed;

    for (const attendee of attendees) {
      if (!attendee.email) continue;
      try {
        const time = new Date(event.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const where = event.location ? ` at ${escapeHtml(event.location)}` : '';
        await email.send({
          to: attendee.email,
          subject: `Reminder: ${event.title} starts soon`,
          html: `<p>Hi ${escapeHtml(attendee.display_name)},</p><p><strong>${escapeHtml(event.title)}</strong> starts at ${time}${where}.</p><p>See you there!</p>`,
          from_name: 'Kychon Community',
        });
        sent++;
      } catch (e) {
        console.warn('Reminder email failed:', e.message);
      }
    }
  }

  return new Response(JSON.stringify({ status: 'ok', events_checked: events.length, reminders_sent: sent }));
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
