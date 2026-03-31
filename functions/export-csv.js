// schedule: none (triggered manually from admin UI)
import { db, getUser } from '@run402/functions';

export default async (req) => {
  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'members';

  let csv = '';

  if (type === 'members') {
    const result = await db.sql(`
      SELECT m.display_name, m.email, m.status, m.role, t.name as tier, m.joined_at, m.custom_fields
      FROM members m
      LEFT JOIN membership_tiers t ON t.id = m.tier_id
      ORDER BY m.created_at DESC
    `);
    const rows = result.rows || result;
    const headers = ['display_name', 'email', 'status', 'role', 'tier', 'joined_at', 'custom_fields'];
    csv = `${headers.join(',')}\n`;
    csv += rows
      .map((r) =>
        headers
          .map((h) => {
            const val = h === 'custom_fields' ? JSON.stringify(r[h] || {}) : String(r[h] || '');
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(','),
      )
      .join('\n');
  } else if (type === 'events') {
    const result = await db.sql(`
      SELECT e.title, e.starts_at, e.ends_at, e.location, e.capacity,
        (SELECT count(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') as rsvp_count
      FROM events e
      ORDER BY e.starts_at DESC
    `);
    const rows = result.rows || result;
    const headers = ['title', 'starts_at', 'ends_at', 'location', 'capacity', 'rsvp_count'];
    csv = `${headers.join(',')}\n`;
    csv += rows.map((r) => headers.map((h) => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  } else {
    return new Response(JSON.stringify({ error: 'Invalid type. Use members or events.' }), { status: 400 });
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${type}-export.csv"`,
    },
  });
};
