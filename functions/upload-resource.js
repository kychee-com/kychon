// schedule: none (triggered by client on resource upload)
import { adminDb, assets, getUser } from '@run402/functions';

// File names that flow into the storage path must be limited to safe ASCII
// segments — `..`, `/`, NUL, and other surprises would let a caller place
// files outside `resources/`. (#25)
const SAFE_FILE_NAME = /^[A-Za-z0-9._-]+$/;
const MAX_BASE64_LEN = 50 * 1024 * 1024; // ~37 MB raw — Run402's per-blob upload limit.

function pickAssetUrl(ref, fallbackKey) {
  return (
    ref?.cdn_immutable_url ||
    ref?.immutable_url ||
    ref?.cdn_url ||
    ref?.url ||
    `/storage/${fallbackKey}`
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
      // `assets.put` from @run402/functions@2.2.0 routes through the
      // unified-apply substrate. The runtime injects service-key auth and
      // the SDK hashes + uploads + commits in one shot.
      const ref = await assets.put(key, bytes, {
        contentType: file.type || 'application/octet-stream',
        visibility: 'public',
        immutable: true,
      });
      fileUrl = pickAssetUrl(ref, key);
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
