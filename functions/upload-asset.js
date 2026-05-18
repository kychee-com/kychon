// schedule: none (triggered by admin for asset upload/delete)
import { adminDb, assets, getUser } from '@run402/functions';

const RUN402_API = 'https://api.run402.com';

// Read intrinsic dimensions from raw image bytes for the formats we expect
// (PNG, JPEG, SVG). Returns null when the format is unknown — callers
// downgrade to "no warning" rather than rejecting the upload.
function readImageDimensions(bytes, mime) {
  // PNG: IHDR chunk at byte 16 (signature 8 + chunk-len 4 + chunk-type 4)
  // contains width (4) + height (4), big-endian.
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  // JPEG: walk SOFn markers (0xC0..0xCF, excluding 0xC4/0xC8/0xCC).
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length - 8) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      i += 2;
      if (marker === 0xd8 || marker === 0xd9) continue; // SOI/EOI: no length
      const segLen = (bytes[i] << 8) | bytes[i + 1];
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) {
        const h = (bytes[i + 3] << 8) | bytes[i + 4];
        const w = (bytes[i + 5] << 8) | bytes[i + 6];
        if (w > 0 && h > 0) return { width: w, height: h };
        return null;
      }
      i += segLen;
    }
  }
  // SVG: parse viewBox or width/height attributes from the first ~2KB.
  if (mime?.includes('svg') || (bytes.length >= 5 && bytes[0] === 0x3c)) {
    const head = new TextDecoder().decode(bytes.slice(0, Math.min(2048, bytes.length)));
    const vb = head.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
    if (vb) {
      const w = parseFloat(vb[1]);
      const h = parseFloat(vb[2]);
      if (w > 0 && h > 0) return { width: w, height: h };
    }
    const wAttr = head.match(/<svg[^>]*\bwidth\s*=\s*["']?([\d.]+)/i);
    const hAttr = head.match(/<svg[^>]*\bheight\s*=\s*["']?([\d.]+)/i);
    if (wAttr && hAttr) {
      const w = parseFloat(wAttr[1]);
      const h = parseFloat(hAttr[1]);
      if (w > 0 && h > 0) return { width: w, height: h };
    }
  }
  return null;
}

// Aspect-ratio heuristic for the brand_icon_url upload target. Per
// brand-identity-fields/design.md §3, when an icon upload's intrinsic width
// exceeds 1.5× its height we tag the response with `warning: 'looks_like_wordmark'`
// so the admin UI can offer a one-click reroute to brand_wordmark_url.
const WORDMARK_ASPECT_THRESHOLD = 1.5;

// Asset paths are passed by the admin UI; the storage call runs with the
// project service key, so an unvalidated `body.path` is a privileged delete
// primitive across the entire storage API. Constrain the shape strictly:
// safe ASCII characters only, no traversal, no leading slash, no double
// slashes, no NUL. (#25)
const SAFE_ASSET_PATH = /^[A-Za-z0-9_.\-/]+$/;
function isSafeAssetPath(value) {
  if (typeof value !== 'string' || !value) return false;
  if (!SAFE_ASSET_PATH.test(value)) return false;
  if (value.startsWith('/')) return false;
  if (value.includes('//')) return false;
  if (value.split('/').some((seg) => seg === '..' || seg === '.')) return false;
  return true;
}

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

  // Check admin role using a parameterized query — concatenating user.id is
  // safe today because Run402 issues UUIDs, but a future auth path that
  // produces a different `sub` shape could turn this into SQL injection. (#25)
  const memberResult = await adminDb().sql('SELECT role FROM members WHERE user_id = $1 LIMIT 1', [user.id]);
  if (!memberResult.rows?.length || memberResult.rows[0].role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
  }

  try {
    const body = await req.json();

    // Delete action — `/storage/v1/blob/{key}` is still alive in 2.2 (the
    // SDK uses this path in `r.assets.rm`). Uploads moved to the apply
    // substrate but per-key DELETE on existing blobs is unaffected.
    if (body.action === 'delete' && body.path) {
      if (!isSafeAssetPath(body.path)) {
        return new Response(
          JSON.stringify({ error: 'Invalid path', detail: 'Asset path must be a relative ASCII segment chain.' }),
          { status: 400 },
        );
      }
      const storageKey = `assets/${body.path}`;
      const delRes = await fetch(`${RUN402_API}/storage/v1/blob/${storageKey}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.RUN402_SERVICE_KEY}` },
      });
      if (!delRes.ok && delRes.status !== 404) {
        const err = await delRes.text();
        return new Response(JSON.stringify({ error: 'Delete failed', detail: err }), { status: 500 });
      }
      return new Response(JSON.stringify({ status: 'deleted', path: body.path }));
    }

    // Upload action
    const { file, path } = body;
    if (!file?.data || !file.name || !path) {
      return new Response(JSON.stringify({ error: 'Missing file or path' }), { status: 400 });
    }
    if (!isSafeAssetPath(path)) {
      return new Response(
        JSON.stringify({ error: 'Invalid path', detail: 'Asset path must be a relative ASCII segment chain.' }),
        { status: 400 },
      );
    }

    // Decode base64
    const bin = atob(file.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const storagePath = `assets/${path}`;
    let url;
    try {
      // `assets.put` from @run402/functions@2.2.0 routes through the
      // unified-apply substrate (`/apply/v1/service-asset-put`). The runtime
      // injects service-key auth and the SDK hashes + uploads + commits.
      const ref = await assets.put(storagePath, bytes, {
        contentType: file.type || 'application/octet-stream',
        visibility: 'public',
        immutable: true,
      });
      url = pickAssetUrl(ref, storagePath);
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Upload failed', detail: String(err?.message || err) }), {
        status: 500,
      });
    }

    // brand_icon_url aspect-ratio hint. The caller passes `target` to opt in;
    // when the target slot is the square icon and the image is much wider
    // than tall, surface a warning so the UI can offer a reroute. The upload
    // still succeeds — this is a hint, not a hard block.
    const response = { status: 'uploaded', url, path };
    if (body.target === 'brand_icon_url') {
      const dims = readImageDimensions(bytes, file.type);
      if (dims && dims.width > WORDMARK_ASPECT_THRESHOLD * dims.height) {
        console.warn(`[upload-asset] looks_like_wordmark: ${path} is ${dims.width}×${dims.height}`);
        response.warning = 'looks_like_wordmark';
        response.dimensions = { width: dims.width, height: dims.height };
      }
    }
    return new Response(JSON.stringify(response));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
