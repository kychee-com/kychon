// @ts-check
// api.js — Thin REST wrapper around Run402 PostgREST API

const API = window.__KYCHON_API || 'https://api.run402.com';
const ANON_KEY = window.__KYCHON_ANON_KEY || '';

function getAuthHeaders() {
  /** @type {Record<string, string>} */
  const headers = { apikey: ANON_KEY, 'Content-Type': 'application/json' };
  const session = JSON.parse(localStorage.getItem('wl_session') || 'null');
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function refreshToken() {
  const session = JSON.parse(localStorage.getItem('wl_session') || 'null');
  if (!session?.refresh_token) return null;
  const res = await fetch(`${API}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) {
    localStorage.removeItem('wl_session');
    return null;
  }
  const newSession = await res.json();
  localStorage.setItem('wl_session', JSON.stringify(newSession));
  return newSession;
}

/** @param {string} method @param {string} path @param {{ body?: any, headers?: Record<string, string>, retry?: boolean }} [opts] */
async function request(method, path, { body, headers: extra, retry = true } = {}) {
  const url = `${API}/rest/v1/${path}`;
  const headers = { ...getAuthHeaders(), ...extra };
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res = await fetch(url, opts);

  if (res.status === 401 && retry) {
    const refreshed = await refreshToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${refreshed.access_token}`;
      opts.headers = headers;
      res = await fetch(url, opts);
    }
  }

  if (!res.ok) {
    const err = /** @type {any} */ (new Error(`API ${method} ${path}: ${res.status}`));
    err.status = res.status;
    try {
      err.body = await res.json();
    } catch {}
    throw err;
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function get(path) {
  return request('GET', path);
}

export function post(path, body) {
  return request('POST', path, { body, headers: { Prefer: 'return=representation' } });
}

export function patch(path, body) {
  return request('PATCH', path, { body, headers: { Prefer: 'return=representation' } });
}

export function del(path) {
  return request('DELETE', path);
}

// Count via GET with Prefer: count=exact and Content-Range header
export async function count(path) {
  const url = `${API}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: { ...getAuthHeaders(), Prefer: 'count=exact' },
  });
  const range = res.headers.get('Content-Range');
  if (range) {
    const total = range.split('/')[1];
    return total === '*' ? 0 : parseInt(total, 10);
  }
  return 0;
}

export { ANON_KEY, API, getAuthHeaders };
