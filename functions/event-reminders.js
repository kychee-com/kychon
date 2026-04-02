// prototype-schedule: "0 * * * *" (requires hobby tier — prototype allows only 1 scheduled fn)
import { db, email } from 'run402-functions';

export default async (_req) => {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  let sent = 0;

  // Find events starting within the next hour
  const events = await db
    .from('events')
    .select('id,title,starts_at,location')
    .gte('starts_at', now.toISOString())
    .lt('starts_at', oneHourFromNow.toISOString());

  for (const event of events) {
    // Get RSVPd members (going or maybe)
    const rsvps = await db.sql(`
      SELECT m.email, m.display_name FROM event_rsvps r
      JOIN members m ON m.id = r.member_id
      WHERE r.event_id = ${event.id} AND r.status IN ('going', 'maybe') AND m.email != ''
    `);
    const attendees = rsvps.rows || rsvps;

    for (const attendee of attendees) {
      if (!attendee.email) continue;
      try {
        const time = new Date(event.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await email.send({
          to: attendee.email,
          subject: `Reminder: ${event.title} starts soon`,
          html: `<p>Hi ${attendee.display_name},</p><p><strong>${event.title}</strong> starts at ${time}${event.location ? ` at ${event.location}` : ''}.</p><p>See you there!</p>`,
          from_name: 'Wild Lychee Community',
        });
        sent++;
      } catch (e) {
        console.warn('Reminder email failed:', e.message);
      }
    }
  }

  return new Response(JSON.stringify({ status: 'ok', events_checked: events.length, reminders_sent: sent }));
};
