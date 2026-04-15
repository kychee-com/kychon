// schedule: none (triggered by client on resource upload)
import { db, getUser } from 'run402-functions';

export default async (req) => {
  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await req.json();
    const { file, metadata = {} } = body || {};

    if (!file || !file.data || !file.name) {
      return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
    }

    // Decode base64 file data
    const bin = atob(file.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    // Upload file to Run402 storage
    const path = `resources/${Date.now()}_${file.name}`;
    const uploadRes = await fetch(`https://api.run402.com/storage/v1/upload/${path}`, {
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

    const uploadResult = await uploadRes.json();
    const fileUrl = uploadResult.url || `/storage/${path}`;

    // Insert resource row
    const created = await db.from('resources').insert({
      title: metadata.title || file.name,
      description: metadata.description || null,
      category: metadata.category || null,
      file_url: fileUrl,
      file_type: metadata.file_type || 'pdf',
      is_members_only: metadata.is_members_only !== false,
      uploaded_by: metadata.uploaded_by || null,
    });

    return new Response(JSON.stringify({ status: 'ok', resource: created[0] }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
