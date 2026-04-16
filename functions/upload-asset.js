// schedule: none (triggered by admin for asset upload/delete)
import { db, getUser } from 'run402-functions';

export default async (req) => {
  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check admin role
  const memberResult = await db.sql(`SELECT role FROM members WHERE user_id = '${user.id}' LIMIT 1`);
  if (!memberResult.rows?.length || memberResult.rows[0].role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
  }

  try {
    const body = await req.json();

    // Delete action
    if (body.action === 'delete' && body.path) {
      const delRes = await fetch(`https://api.run402.com/storage/v1/delete/assets/${body.path}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.RUN402_SERVICE_KEY}` },
      });
      if (!delRes.ok) {
        const err = await delRes.text();
        return new Response(JSON.stringify({ error: 'Delete failed', detail: err }), { status: 500 });
      }
      return new Response(JSON.stringify({ status: 'deleted', path: body.path }));
    }

    // Upload action
    const { file, path } = body;
    if (!file || !file.data || !file.name || !path) {
      return new Response(JSON.stringify({ error: 'Missing file or path' }), { status: 400 });
    }

    // Decode base64
    const bin = atob(file.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    // Upload to Run402 storage assets bucket
    const storagePath = `assets/${path}`;
    const uploadRes = await fetch(`https://api.run402.com/storage/v1/upload/${storagePath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RUN402_SERVICE_KEY}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: bytes,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return new Response(JSON.stringify({ error: 'Upload failed', detail: err }), { status: 500 });
    }

    const result = await uploadRes.json();
    const url = result.url || `/storage/${storagePath}`;

    return new Response(JSON.stringify({ status: 'uploaded', url, path }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
