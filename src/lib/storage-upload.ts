// Browser-side wrapper around the Kychon upload pipeline.
//
// The legacy `POST /storage/v1/uploads*` routes were removed in the Run402
// v1.48 / @run402/sdk@2.0 unified-apply cutover. Browser code now POSTs the
// file payload to `functions/v1/upload-asset`, which runs in Run402's
// serverless and calls `assets.put` from `@run402/functions@2.2.0` against
// the new `/apply/v1/service-asset-put` substrate. Keeping the wire-shape
// logic on the server side means future Run402 endpoint changes are a
// one-file fix instead of two. (issue #28, openspec/changes/upgrade-run402-sdk-v2)

declare global {
  interface Window {
    __KYCHON_API: string;
    __KYCHON_ANON_KEY: string;
  }
}

export interface UploadFileOpts {
  /**
   * Path prefix the file lands under. Today's only supported prefix is
   * `assets` (the namespace `functions/upload-asset.js` writes into).
   * Other prefixes are rejected to keep parity with the server-side
   * validation in `isSafeAssetPath`.
   */
  keyPrefix: string;
  /** Optional filename override; defaults to `safeStorageName(file.name)`. */
  keyName?: string;
  /**
   * Bearer token. Defaults to the anon key. Pass the signed-in user's
   * `access_token` for user-scoped uploads (avatars, etc.).
   */
  authToken?: string;
  /** Optional `target` field forwarded to the edge function for hint-bearing slots. */
  target?: string;
}

export interface UploadFileResult {
  key: string;
  url: string;
  warning?: string;
  dimensions?: { width: number; height: number };
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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] as number);
  return btoa(bin);
}

export async function uploadFileContentAddressed(
  file: File | Blob,
  opts: UploadFileOpts,
): Promise<UploadFileResult> {
  const api = getApiBase();
  const anon = getAnonKey();
  const bearer = opts.authToken || anon;

  const prefix = opts.keyPrefix.replace(/^\/+|\/+$/g, '');
  if (prefix !== 'assets') {
    throw new Error(
      `Upload prefix "${prefix}" is not supported. Only the "assets" prefix routes through functions/upload-asset.js.`,
    );
  }

  const rawName = file instanceof File ? file.name : 'file';
  const filename = safeStorageName(opts.keyName || rawName);
  const path = `${Date.now()}_${filename}`;
  const contentType = file.type || 'application/octet-stream';

  const buffer = await file.arrayBuffer();
  const data = bytesToBase64(new Uint8Array(buffer));

  const body: Record<string, unknown> = {
    file: { data, name: filename, type: contentType },
    path,
  };
  if (opts.target) body.target = opts.target;

  const res = await fetch(`${api}/functions/v1/upload-asset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`Upload failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as {
    url?: string;
    path?: string;
    warning?: string;
    dimensions?: { width: number; height: number };
  };
  if (!json.url) {
    throw new Error('Upload response missing url field');
  }

  const result: UploadFileResult = {
    key: `assets/${path}`,
    url: json.url,
  };
  if (json.warning) result.warning = json.warning;
  if (json.dimensions) result.dimensions = json.dimensions;
  return result;
}
