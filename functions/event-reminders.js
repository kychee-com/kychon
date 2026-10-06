// schedule: none — reminds one event's going and maybe RSVPs that it starts
// within the hour. kychon-api queues a Run402 function run of this function for
// each event start time (event type event.reminder), due an hour before the
// event and expiring when it starts; an admin may also call it with
// { event_id } to send due reminders by hand.
import { adminDb, auth, email } from '@run402/functions';

// Set at deploy time (scripts/_lib.ts): 'true' on the demo portals, whose
// members are seeded with real-looking addresses and must never be emailed.
const DEMO_PORTAL = '__KYCHON_DEMO_PORTAL__';

// A reminder is due once the event starts within this long. The run is queued
// an hour ahead; the slack covers a run that starts a few minutes late.
const DUE_WINDOW_MS = 70 * 60 * 1000;

// RSVPs claimed and emailed at a time.
const BATCH_SIZE = 5;

export default async (req) => {
  const admin = adminDb();

  // A run emails members, so anonymous callers must not start one.
  const denied = await authorizeRun(req, admin);
  if (denied) return denied;

  const eventId = await eventReference(req);
  if (eventId == null) return json({ error: 'event_id is required' }, 400);

  const config = await readConfig(admin);
  if (DEMO_PORTAL === 'true' || config.get('demo_mode') === true) {
    return json({ status: 'skipped', reason: 'demo portal' });
  }

  const event = (
    await admin
      .from('events')
      .select('id,title,starts_at,location,source_timezone,source_timezone_label')
      .eq('id', eventId)
      .limit(1)
  )[0];
  if (!event) return json({ status: 'skipped', reason: 'event not found' });
  // A run queued for an earlier start time, an event moved later, or one that already started.
  const untilStart = new Date(event.starts_at).getTime() - Date.now();
  if (!(untilStart > 0 && untilStart <= DUE_WINDOW_MS)) return json({ status: 'skipped', reason: 'not due' });

  const startsAt = startTimeLabel(event, config.get('event_source_timezone'));
  let sent = 0;
  let attendees = await claimRsvps(admin, event.id);
  while (attendees.length) {
    const results = await Promise.allSettled(
      attendees.map((attendee) =>
        email.send({
          to: attendee.email,
          subject: `Reminder: ${event.title} starts soon`,
          html: reminderHtml(event, attendee, startsAt),
          from_name: 'Kychon Community',
        }),
      ),
    );
    for (const result of results) {
      if (result.status === 'fulfilled') sent++;
      else console.warn('Reminder email failed:', result.reason?.message);
    }
    attendees = await claimRsvps(admin, event.id);
  }

  return json({ status: 'ok', reminders_sent: sent });
};

// Claims the next going/maybe RSVPs that have not had a reminder, before they
// are emailed: each RSVP gets at most one reminder however often this runs (a
// retried run, a repeated run, an admin running it by hand), and a run that
// times out leaves the rest to its retry.
async function claimRsvps(admin, eventId) {
  const claimed = await admin.sql(
    `UPDATE event_rsvps r SET reminder_sent_at = now()
       FROM members m
      WHERE m.id = r.member_id
        AND r.id IN (
          SELECT d.id FROM event_rsvps d JOIN members dm ON dm.id = d.member_id
           WHERE d.event_id = $1 AND d.status IN ('going', 'maybe')
             AND d.reminder_sent_at IS NULL AND dm.email <> ''
           ORDER BY d.id LIMIT $2
             FOR UPDATE OF d SKIP LOCKED)
      RETURNING m.email, m.display_name`,
    [eventId, BATCH_SIZE],
  );
  return claimed.rows || claimed;
}

function reminderHtml(event, attendee, startsAt) {
  const where = event.location ? ` at ${escapeHtml(event.location)}` : '';
  return `<p>Hi ${escapeHtml(attendee.display_name)},</p><p><strong>${escapeHtml(event.title)}</strong> starts at ${escapeHtml(startsAt)}${where}.</p><p>See you there!</p>`;
}

// An email has no reader time zone, so give the start time in the event's own
// time zone (or the portal's default for events), else in UTC, and name it.
function startTimeLabel(event, portalTimezone) {
  const start = new Date(event.starts_at);
  const own = isTimeZone(event.source_timezone);
  const timeZone = own ? event.source_timezone.trim() : isTimeZone(portalTimezone) ? portalTimezone.trim() : 'UTC';
  const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone }).format(start);
  const zone =
    (own && event.source_timezone_label) ||
    new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'short' })
      .formatToParts(start)
      .find((part) => part.type === 'timeZoneName')?.value ||
    timeZone;
  return `${time} ${zone}`;
}

function isTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

// The event to remind about: a function run's payload, or an admin's request body.
async function eventReference(req) {
  let body = null;
  try {
    body = await req.json();
  } catch {}
  const input = body?.trigger === 'function_run' && body.payload ? body.payload : body;
  const id = Number(input?.event_id);
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

async function readConfig(admin) {
  const rows = await admin.from('site_config').select('key,value');
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [row.key, parseConfigValue(row.value)]));
}

// site_config values are JSONB; some rows hold JSON-encoded text ('"UTC"', 'true').
function parseConfigValue(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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
