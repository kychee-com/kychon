// schedule: none (triggered by client on resource upload)
import { adminDb, getUser } from '@run402/functions';

// File names that flow into the storage path must be limited to safe ASCII
// segments — `..`, `/`, NUL, and other surprises would let a caller place
// files outside `resources/`. (#25)
const SAFE_FILE_NAME = /^[A-Za-z0-9._-]+$/;
const MAX_BASE64_LEN = 50 * 1024 * 1024; // ~37 MB raw — Run402's per-blob upload limit.

const RUN402_API = 'https://api.run402.com';

async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Run402 went content-addressed post-v1.32. Three-step flow:
//   1. POST /storage/v1/uploads        — init with sha256 + size + key
//   2. PUT  <part.url>                 — upload each part
//   3. POST /storage/v1/uploads/{id}/complete — finalize, returns cdn url
// (#28)
async function uploadBytesContentAddressed(bytes, { key, contentType, visibility = 'public', immutable = true }) {
  const initRes = await fetch(`${RUN402_API}/storage/v1/uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RUN402_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      key,
      size_bytes: bytes.byteLength,
      content_type: contentType,
      visibility,
      immutable,
      sha256: await sha256Hex(bytes),
    }),
  });
  if (!initRes.ok) throw new Error(`init: ${await initRes.text()}`);
  const init = await initRes.json();

  const parts = [];
  for (const part of init.parts || []) {
    const slice = bytes.slice(part.byte_start, part.byte_end + 1);
    const putRes = await fetch(part.url, { method: 'PUT', body: slice });
    if (!putRes.ok) throw new Error(`part ${part.part_number}: ${putRes.status}`);
    parts.push({ part_number: part.part_number, etag: putRes.headers.get('etag') || '' });
  }

  const completeRes = await fetch(`${RUN402_API}/storage/v1/uploads/${encodeURIComponent(init.upload_id)}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RUN402_SERVICE_KEY}`,
    },
    body: JSON.stringify(init.mode === 'multipart' ? { parts } : {}),
  });
  if (!completeRes.ok) throw new Error(`complete: ${await completeRes.text()}`);
  const completed = await completeRes.json();
  return (
    completed.cdn_immutable_url || completed.immutable_url || completed.cdn_url || completed.url || `/storage/${key}`
  );
}

export default async (req) => {
  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Admin-only — mirror the role check in upload-asset.js. The legacy "any
  // authenticated user can upload" surface let arbitrary signed-in Run402
  // users write to the project's resources bucket. (#25)
  const memberResult = await adminDb().sql('SELECT role FROM members WHERE user_id = $1 LIMIT 1', [user.id]);
  const role = memberResult?.rows?.[0]?.role;
  if (role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
  }

  try {
    const body = await req.json();
    const { file, metadata = {} } = body || {};

    if (!file?.data || !file.name) {
      return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
    }

    if (!SAFE_FILE_NAME.test(file.name)) {
      return new Response(JSON.stringify({ error: 'Invalid file name', detail: 'expected [A-Za-z0-9._-]+' }), {
        status: 400,
      });
    }

    if (typeof file.data !== 'string' || file.data.length > MAX_BASE64_LEN) {
      return new Response(JSON.stringify({ error: 'File too large' }), { status: 413 });
    }

    // Decode base64 file data
    const bin = atob(file.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const key = `resources/${Date.now()}_${file.name}`;
    let fileUrl;
    try {
      fileUrl = await uploadBytesContentAddressed(bytes, {
        key,
        contentType: file.type || 'application/octet-stream',
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Upload failed', detail: String(err?.message || err) }), {
        status: 500,
      });
    }

    // Insert resource row. uploaded_by is bound to the authenticated admin —
    // never honored from input. (#24/#25)
    const memberRow = await adminDb().sql('SELECT id FROM members WHERE user_id = $1 LIMIT 1', [user.id]);
    const uploadedBy = memberRow?.rows?.[0]?.id ?? null;
    const created = await adminDb()
      .from('resources')
      .insert({
        title: metadata.title || file.name,
        description: metadata.description || null,
        category: metadata.category || null,
        file_url: fileUrl,
        file_type: metadata.file_type || 'pdf',
        is_members_only: metadata.is_members_only !== false,
        uploaded_by: uploadedBy,
      });

    const row = Array.isArray(created) ? created[0] : created;
    return new Response(JSON.stringify({ status: 'ok', resource: row }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
