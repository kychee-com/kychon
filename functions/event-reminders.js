// schedule: "0 * * * *"
import { db } from '@run402/functions';

export default async (req) => {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  let sent = 0;

  // Find events starting within the next hour
  const events = await db.from('events')
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
      if (!attendee.email || !process.env.MAILBOX_ID) continue;
      try {
        const time = new Date(event.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await fetch(`https://api.run402.com/mailboxes/v1/${process.env.MAILBOX_ID}/messages`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + process.env.RUN402_SERVICE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template: 'notification',
            to: attendee.email,
            variables: {
              project_name: 'Wild Lychee Community',
              message: `Reminder: "${event.title}" starts at ${time}${event.location ? ' at ' + event.location : ''}. See you there!`,
            },
          }),
        });
        sent++;
      } catch (e) {
        console.warn('Reminder email failed:', e.message);
      }
    }
  }

  return new Response(JSON.stringify({ status: 'ok', events_checked: events.length, reminders_sent: sent }));
};
