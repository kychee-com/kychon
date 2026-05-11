// Browser-side wrapper around Run402's content-addressed storage upload flow.
//
// Run402 retired the legacy `POST /storage/v1/upload/{key}` route post-v1.32
// in favor of a three-step content-addressed flow:
//   1. `POST /storage/v1/uploads`       — init with sha256 + size + key
//   2. `PUT  <part.url>`                — upload each part to its presigned URL
//   3. `POST /storage/v1/uploads/{id}/complete` — finalize and receive cdn url
//
// Every call site that previously hit the single-shot endpoint must route
// through here. (issue #28)

declare global {
  interface Window {
    __KYCHON_API: string;
    __KYCHON_ANON_KEY: string;
  }
}

export interface UploadFileOpts {
  /** Path prefix the file lands under, e.g. `resources`, `avatars/123`, `assets`. */
  keyPrefix: string;
  /** Optional filename override; defaults to `safeStorageName(file.name)`. */
  keyName?: string;
  /** Storage visibility — public by default to match prior behavior. */
  visibility?: 'public' | 'private';
  /** Immutable blobs are CDN-cached aggressively; safe for upload-and-forget assets. */
  immutable?: boolean;
  /**
   * Bearer token. Defaults to the anon key. Pass the signed-in user's
   * `access_token` for user-scoped uploads (avatars, etc.).
   */
  authToken?: string;
}

export interface UploadFileResult {
  key: string;
  url: string;
}

function getApiBase(): string {
  return window.__KYCHON_API || 'https://api.run402.com';
}

function getAnonKey(): string {
  return window.__KYCHON_ANON_KEY || '';
}

export function safeStorageName(name: string): string {
  const base = String(name).split(/[\\/]/).pop() || 'file';
  return base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

export async function sha256Hex(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function uploadFileContentAddressed(
  file: File | Blob,
  opts: UploadFileOpts,
): Promise<UploadFileResult> {
  const api = getApiBase();
  const anon = getAnonKey();
  const bearer = opts.authToken || anon;
  const rawName = file instanceof File ? file.name : 'file';
  const filename = safeStorageName(opts.keyName || rawName);
  const prefix = opts.keyPrefix.replace(/^\/+|\/+$/g, '');
  const key = `${prefix}/${Date.now()}_${filename}`;
  const contentType = file.type || 'application/octet-stream';

  const initRes = await fetch(`${api}/storage/v1/uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({
      key,
      size_bytes: file.size,
      content_type: contentType,
      visibility: opts.visibility || 'public',
      immutable: opts.immutable !== false,
      sha256: await sha256Hex(file),
    }),
  });
  if (!initRes.ok) throw new Error(`Upload init failed: ${await initRes.text()}`);
  const init = await initRes.json();

  const parts: Array<{ part_number: number; etag: string }> = [];
  for (const part of init.parts || []) {
    const putRes = await fetch(part.url, {
      method: 'PUT',
      body: file.slice(part.byte_start, part.byte_end + 1),
    });
    if (!putRes.ok) throw new Error(`Part ${part.part_number} upload failed`);
    parts.push({ part_number: part.part_number, etag: putRes.headers.get('etag') || '' });
  }

  const completeRes = await fetch(
    `${api}/storage/v1/uploads/${encodeURIComponent(init.upload_id)}/complete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify(init.mode === 'multipart' ? { parts } : {}),
    },
  );
  if (!completeRes.ok) throw new Error(`Upload complete failed: ${await completeRes.text()}`);

  const completed = await completeRes.json();
  const url =
    completed.cdn_immutable_url ||
    completed.immutable_url ||
    completed.cdn_url ||
    completed.url ||
    `/storage/${key}`;
  return { key, url };
}
