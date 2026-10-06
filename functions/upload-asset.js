// schedule: none (triggered by admin for asset upload/delete/list)
// The Run402 platform manages all media metadata (filename, uploader,
// dimensions, blurhash, variants, exif policy) via `internal.blobs.metadata`
// + intrinsic image columns; Kychon keeps no shadow `media_assets` table.
// See `openspec/changes/admin-content-management/design.md` Decision 3.
import { adminDb, assets, auth } from '@run402/functions';

// Aspect-ratio heuristic for the brand_icon_url upload target. Per
// brand-identity-fields/design.md §3, when an icon upload's intrinsic width
// exceeds 1.5× its height we tag the response with `warning: 'looks_like_wordmark'`
// so the admin UI can offer a one-click reroute to brand_wordmark_url. Reads
// from the AssetRef the platform returns (the gateway populates `width_px` /
// `height_px` server-side; no client-side image decode needed).
const WORDMARK_ASPECT_THRESHOLD = 1.5;

// Asset paths are passed by the admin UI; the storage call runs with the
// project service key, so an unvalidated `body.path` is a privileged delete
// primitive across the entire storage API. Constrain the shape strictly:
// safe ASCII characters only, no traversal, no leading slash, no double
// slashes, no NUL.
const SAFE_ASSET_PATH = /^[A-Za-z0-9_.\-/]+$/;
function isSafeAssetPath(value) {
  if (typeof value !== 'string' || !value) return false;
  if (!SAFE_ASSET_PATH.test(value)) return false;
  if (value.startsWith('/')) return false;
  if (value.includes('//')) return false;
  if (value.split('/').some((seg) => seg === '..' || seg === '.')) return false;
  return true;
}

// Storage prefix for admin uploads. Every uploaded asset lives under
// `assets/<path>`; the picker's media.list lists with this prefix.
const STORAGE_PREFIX = 'assets/';

// Pagination cap for the picker grid. 40 thumbnails per page balances
// network cost with the picker UX (4-col grid × 10 rows visible).
const MEDIA_LIST_LIMIT = 40;

export default async (req) => {
  const user = await auth.user();
  if (!user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // A pending or suspended admin must not upload or delete assets: require an
  // active admin or a project admin.
  if (!(await isActiveAdmin(adminDb(), user))) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
  }

  try {
    const body = await req.json();

    // -- List action --------------------------------------------------------
    // Thin wrapper over `assets.ls`. Returns the BlobLsResult reshaped
    // as `{ assets, nextCursor }` for the MediaPicker's expected shape.
    // Optional filter passthrough lets future "filter by uploader" / "show
    // only photos" views work without API churn.
    if (body.action === 'list') {
      const cursor = typeof body.cursor === 'string' && body.cursor.length > 0 ? body.cursor : undefined;
      const filter = body.filter && typeof body.filter === 'object' ? body.filter : undefined;
      try {
        const lsResult = await assets.ls({
          prefix: STORAGE_PREFIX,
          sort: 'createdAt:desc',
          limit: MEDIA_LIST_LIMIT,
          cursor,
          filter,
        });
        return new Response(
          JSON.stringify({
            assets: lsResult.blobs ?? [],
            nextCursor: lsResult.next_cursor ?? null,
          }),
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: 'List failed', detail: String(err?.message || err) }), {
          status: 500,
        });
      }
    }

    // -- Delete action ------------------------------------------------------
    // Platform handles variant revocation, immutable-URL retention, and CDN
    // invalidation. NO local DB delete — there's no shadow table.
    if (body.action === 'delete' && body.path) {
      if (!isSafeAssetPath(body.path)) {
        return new Response(
          JSON.stringify({ error: 'Invalid path', detail: 'Asset path must be a relative ASCII segment chain.' }),
          { status: 400 },
        );
      }
      const storageKey = `${STORAGE_PREFIX}${body.path}`;
      try {
        await assets.rm(storageKey);
      } catch (err) {
        // 404 (already-deleted / never-existed) is benign — return 'deleted'
        // so the UI is idempotent. Other errors propagate as 500.
        const msg = String(err?.message || err);
        if (!/404|not.?found/i.test(msg)) {
          return new Response(JSON.stringify({ error: 'Delete failed', detail: msg }), { status: 500 });
        }
      }
      return new Response(JSON.stringify({ status: 'deleted', path: body.path }));
    }

    // -- Upload action ------------------------------------------------------
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

    // Decode base64. The wire format is a base64-encoded JSON-friendly string
    // because @run402/functions' apply substrate doesn't accept multipart.
    const bin = atob(file.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const storagePath = `${STORAGE_PREFIX}${path}`;

    // Caller-provided metadata: filename for the admin UI label, uploaded_by
    // for attribution / "filter by uploader" views. Both are opaque to the
    // platform; the 4KB metadata cap fits comfortably.
    const metadata = {
      filename: String(file.name).slice(0, 255),
      uploaded_by: String(user.id),
    };

    let ref;
    try {
      // `assets.put` from @run402/functions routes through the unified-apply
      // substrate. The runtime injects service-key auth and the SDK hashes +
      // uploads + commits. The gateway runs the variant encoder server-side
      // (WebP ladder + blurhash + intrinsic dims) and applies the EXIF policy.
      ref = await assets.put(storagePath, bytes, {
        contentType: file.type || 'application/octet-stream',
        visibility: 'public',
        immutable: true,
        metadata,
        // exifPolicy: 'strip' is Kychon's default for admin-uploaded photos.
        // End-user photos may carry GPS / camera serial / owner identifiers
        // — the original bytes still serve through cdn_url unchanged (we
        // never mutate CAS), but the queryable `image_exif` index is
        // sanitized to an allowlist. Admins who need full EXIF on a specific
        // upload can pass `exifPolicy: 'keep'` via `body.exifPolicy`.
        exifPolicy: body.exifPolicy === 'keep' ? 'keep' : 'strip',
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Upload failed', detail: String(err?.message || err) }), {
        status: 500,
      });
    }

    const url = ref?.cdn_immutable_url || ref?.immutable_url || ref?.cdn_url || ref?.url || `/storage/${storagePath}`;

    // brand_icon_url aspect-ratio hint. The caller passes `target` to opt in;
    // when the target slot is the square icon and the image is much wider
    // than tall, surface a warning so the UI can offer a reroute. The upload
    // still succeeds — this is a hint, not a hard block. The gateway returns
    // intrinsic dims server-side; no client decode needed.
    const response = { status: 'uploaded', url, path, ref };
    if (body.target === 'brand_icon_url' && ref?.width_px && ref?.height_px) {
      if (ref.width_px > WORDMARK_ASPECT_THRESHOLD * ref.height_px) {
        console.warn(`[upload-asset] looks_like_wordmark: ${path} is ${ref.width_px}×${ref.height_px}`);
        response.warning = 'looks_like_wordmark';
        response.dimensions = { width: ref.width_px, height: ref.height_px };
      }
    }
    return new Response(JSON.stringify(response));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

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
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!row && email) {
    const byEmail = await admin.from('members').select('role,status').eq('email', email).limit(1);
    row = byEmail?.[0];
  }
  if (!row) return null;
  return {
    role: String(row.role || 'member').toLowerCase(),
    status: String(row.status || 'pending').toLowerCase(),
  };
}
