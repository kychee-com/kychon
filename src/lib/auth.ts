// auth.ts — Google OAuth + password auth, session management, role checking

function getAPI(): string {
  return window.__KYCHON_API || 'https://api.run402.com';
}

function getAnonKey(): string {
  return window.__KYCHON_ANON_KEY || '';
}

const AUTH_RETURN_TO_KEY = 'wl_auth_return_to';

function currentPathWithSearch(): string {
  const pathname = cleanRoutePath(window.location.pathname || '/');
  return `${pathname}${window.location.search || ''}`;
}

function cleanRoutePath(pathname: string): string {
  switch (pathname) {
    case '/admin.html':
      return '/admin';
    case '/admin-members.html':
      return '/admin-members';
    case '/admin-settings.html':
      return '/admin-settings';
    default:
      return pathname || '/';
  }
}

function getOAuthCallbackParams(): URLSearchParams {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (hashParams.has('code') || hashParams.has('error')) return hashParams;

  const queryParams = new URLSearchParams(window.location.search.replace(/^\?/, ''));
  if (queryParams.has('code') || queryParams.has('error')) return queryParams;

  return new URLSearchParams();
}

function cleanOAuthCallbackUrl(): string {
  const queryParams = new URLSearchParams(window.location.search.replace(/^\?/, ''));
  queryParams.delete('code');
  queryParams.delete('state');
  queryParams.delete('error');
  queryParams.delete('error_description');
  const query = queryParams.toString();
  return `${window.location.pathname || '/'}${query ? `?${query}` : ''}`;
}

function oauthErrorMessage(code: string): string {
  switch (code) {
    case 'account_exists_requires_link':
      return 'That Google account already exists here, but it is not connected to Google sign-in yet.';
    case 'identity_already_linked':
      return 'That Google account is already connected to another user.';
    case 'identity_resolution_failed':
      return 'We could not finish connecting that Google account.';
    case 'id_token_invalid':
      return 'Google sign-in could not be verified. Please try again.';
    case 'token_exchange_failed':
      return 'Google sign-in could not be completed. Please try again.';
    default:
      return 'Google sign-in could not be completed. Please try again.';
  }
}

function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

// PKCE helpers
export function generateVerifier(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function generateChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Session management
export function getSession(): any {
  return JSON.parse(localStorage.getItem('wl_session') || 'null');
}

function saveSession(session: any): void {
  localStorage.setItem('wl_session', JSON.stringify(session));
}

function decodeBase64UrlJson(value: string): any | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
    const raw = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('binary');
    const json = decodeURIComponent(
      Array.from(raw)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getSessionClaims(session = getSession()): any | null {
  const token = session?.access_token;
  if (typeof token !== 'string') return null;
  const payload = token.split('.')[1];
  return payload ? decodeBase64UrlJson(payload) : null;
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getSessionEmail(session = getSession()): string {
  const user = session?.user || {};
  const claims = getSessionClaims(session) || {};
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const candidates = [
    user.email,
    session?.email,
    user.user_metadata?.email,
    user.raw_user_meta_data?.email,
    user.identity_data?.email,
    identities[0]?.identity_data?.email,
    claims.email,
    claims.user_metadata?.email,
    claims.raw_user_meta_data?.email,
    claims.app_metadata?.email,
  ];

  for (const candidate of candidates) {
    const email = normalizeEmail(candidate);
    if (email) return email;
  }
  return '';
}

export function isProjectAdminSession(session = getSession()): boolean {
  const user = session?.user || {};
  const claims = getSessionClaims(session) || {};
  return (
    user.is_admin === true ||
    user.role === 'project_admin' ||
    user.app_metadata?.role === 'project_admin' ||
    user.app_metadata?.is_admin === true ||
    claims.role === 'project_admin' ||
    claims.is_admin === true ||
    claims.app_metadata?.role === 'project_admin' ||
    claims.app_metadata?.is_admin === true
  );
}

export function getRole(): string | null {
  const session = getSession();
  return session?.user?.member?.role || (isProjectAdminSession(session) ? 'admin' : null);
}

export function isAdmin(): boolean {
  return getRole() === 'admin';
}

export function isAuthenticated(): boolean {
  return !!getSession();
}

export function requireAuth(): boolean {
  return isAuthenticated();
}

export function requireAdmin(): boolean {
  return isAdmin();
}

// Google OAuth
export async function signInWithGoogle(): Promise<void> {
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);
  localStorage.setItem('wl_pkce_verifier', verifier);
  localStorage.setItem(AUTH_RETURN_TO_KEY, currentPathWithSearch());

  const res = await fetch(`${getAPI()}/auth/v1/oauth/google/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
    body: JSON.stringify({
      redirect_url: `${window.location.origin}/`,
      mode: 'redirect',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(authStartErrorMessage(body));
  }

  const authorization_url = typeof body?.authorization_url === 'string' ? body.authorization_url : '';
  if (!authorization_url) {
    throw new Error('Google sign-in could not be started. Please try again.');
  }
  window.location.href = authorization_url;
}

function authStartErrorMessage(body: any): string {
  const message = typeof body?.message === 'string' ? body.message : '';
  if (/redirect_url is not an allowed origin/i.test(message)) {
    return 'Google sign-in is not ready on this domain yet. Please use the setup link from Kychon and try again.';
  }
  return message || 'Google sign-in could not be started. Please try again.';
}

export async function handleOAuthCallback(): Promise<any> {
  const params = getOAuthCallbackParams();
  const code = params.get('code');
  if (!code) return null;

  window.history.replaceState(null, '', cleanOAuthCallbackUrl());
  const verifier = localStorage.getItem('wl_pkce_verifier');
  localStorage.removeItem('wl_pkce_verifier');

  const res = await fetch(`${getAPI()}/auth/v1/token?grant_type=authorization_code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
    body: JSON.stringify({ code, code_verifier: verifier }),
  });

  if (!res.ok) {
    let message = 'Google sign-in could not be completed. Please try again.';
    try {
      const err = await res.json();
      if (err?.message) message = err.message;
    } catch {}
    throw new Error(message);
  }
  const session = await res.json();
  saveSession(session);
  return session;
}

export function consumeOAuthCallbackError(): string | null {
  const params = getOAuthCallbackParams();
  const error = params.get('error');
  if (!error) return null;
  window.history.replaceState(null, '', cleanOAuthCallbackUrl());
  return oauthErrorMessage(error);
}

export function consumeAuthReturnTo(): string | null {
  const returnTo = safeReturnTo(localStorage.getItem(AUTH_RETURN_TO_KEY));
  localStorage.removeItem(AUTH_RETURN_TO_KEY);
  return returnTo;
}

// Password auth
export async function signUp(email: string, password: string): Promise<any> {
  const res = await fetch(`${getAPI()}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Signup failed');
  }
  return res.json();
}

export async function signIn(email: string, password: string): Promise<any> {
  const res = await fetch(`${getAPI()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Login failed');
  }
  const session = await res.json();
  saveSession(session);
  return session;
}

export function signOut(): void {
  localStorage.removeItem('wl_session');
  window.location.href = '/';
}
