// auth.ts — Google OAuth + password auth, session management, role checking

function getAPI(): string {
  return window.__KYCHON_API || 'https://api.run402.com';
}

function getAnonKey(): string {
  return window.__KYCHON_ANON_KEY || '';
}

const AUTH_RETURN_TO_KEY = 'wl_auth_return_to';
const MAGIC_LINK_TOKEN_PARAMS = ['token', 'magic_link_token', 'magic_token', 'confirmation_token'];
const PASSWORD_SET_KEY_PREFIX = 'kychon_password_set:';
const GOOGLE_LINK_RESUME_PARAM = 'connect_google';
const GOOGLE_LINK_RESUME_KEY = 'kychon_connect_google_after_magic';

export interface OAuthCallbackErrorDetail {
  code: string;
  message: string;
  flow?: 'connect-google';
}

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

function getCallbackParams(): URLSearchParams {
  const hash = window.location.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);
  if (hash) return hashParams;
  return new URLSearchParams(window.location.search.replace(/^\?/, ''));
}

function getMagicLinkToken(params = getCallbackParams()): string | null {
  for (const key of MAGIC_LINK_TOKEN_PARAMS) {
    const token = params.get(key);
    if (token) return token;
  }
  return null;
}

function cleanMagicLinkCallbackUrl(): string {
  const queryParams = new URLSearchParams(window.location.search.replace(/^\?/, ''));
  for (const key of MAGIC_LINK_TOKEN_PARAMS) queryParams.delete(key);
  if (queryParams.get('type') === 'magic_link') queryParams.delete('type');
  queryParams.delete('expires_at');
  const query = queryParams.toString();
  return `${window.location.pathname || '/'}${query ? `?${query}` : ''}`;
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
      return 'This email already has access here. Verify it once, then we will connect Google sign-in to that account.';
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

function oauthErrorFlow(code: string): OAuthCallbackErrorDetail['flow'] {
  return code === 'account_exists_requires_link' ? 'connect-google' : undefined;
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

function requireAccessToken(): string {
  const token = getSession()?.access_token;
  if (typeof token !== 'string' || !token) {
    throw new Error('Please sign in before changing account security.');
  }
  return token;
}

function publicAuthHeaders(): Record<string, string> {
  const anonKey = getAnonKey();
  return { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` };
}

function currentUrlWithParam(param: string, value: string): string {
  const url = new URL(currentPathWithSearch(), window.location.origin);
  url.searchParams.set(param, value);
  return `${url.pathname}${url.search}`;
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

export function hasGoogleIdentity(session = getSession()): boolean {
  const user = session?.user || {};
  const claims = getSessionClaims(session) || {};
  const identities = Array.isArray(user.identities) ? user.identities : [];
  return identities.some((identity: any) => {
    const provider = String(identity?.provider || identity?.identity_provider || '').toLowerCase();
    return provider === 'google' || provider === 'oauth_google';
  }) || [claims.provider, claims.app_metadata?.provider, user.app_metadata?.provider]
    .map((value) => String(value || '').toLowerCase())
    .includes('google');
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

  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: getAnonKey() };
  const token = getSession()?.access_token;
  if (typeof token === 'string' && token) headers.Authorization = `Bearer ${token}`;
  const linking = typeof token === 'string' && token.length > 0;
  const loginHint = linking ? getSessionEmail() : '';

  const res = await fetch(`${getAPI()}/auth/v1/oauth/google/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      redirect_url: `${window.location.origin}/`,
      mode: 'redirect',
      intent: linking ? 'link' : 'signin',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      ...(loginHint ? { login_hint: loginHint } : {}),
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
  return consumeOAuthCallbackErrorDetail()?.message ?? null;
}

export function consumeOAuthCallbackErrorDetail(): OAuthCallbackErrorDetail | null {
  const params = getOAuthCallbackParams();
  const error = params.get('error');
  if (!error) return null;
  window.history.replaceState(null, '', cleanOAuthCallbackUrl());
  return {
    code: error,
    message: oauthErrorMessage(error),
    flow: oauthErrorFlow(error),
  };
}

export function consumeAuthReturnTo(): string | null {
  const returnTo = safeReturnTo(localStorage.getItem(AUTH_RETURN_TO_KEY));
  localStorage.removeItem(AUTH_RETURN_TO_KEY);
  return returnTo;
}

export function consumeGoogleLinkResumeIntent(): boolean {
  const queryParams = new URLSearchParams(window.location.search.replace(/^\?/, ''));
  const fromQuery = queryParams.get(GOOGLE_LINK_RESUME_PARAM) === '1';
  const fromStorage = localStorage.getItem(GOOGLE_LINK_RESUME_KEY) === '1';
  localStorage.removeItem(GOOGLE_LINK_RESUME_KEY);
  if (fromQuery) {
    queryParams.delete(GOOGLE_LINK_RESUME_PARAM);
    const query = queryParams.toString();
    window.history.replaceState(null, '', `${window.location.pathname || '/'}${query ? `?${query}` : ''}`);
  }
  return fromQuery || fromStorage;
}

export function hasMagicLinkCallback(): boolean {
  return !!getMagicLinkToken();
}

export async function handleMagicLinkCallback(): Promise<any> {
  const token = getMagicLinkToken();
  if (!token) return null;

  window.history.replaceState(null, '', cleanMagicLinkCallbackUrl());
  const res = await fetch(`${getAPI()}/auth/v1/token?grant_type=magic_link`, {
    method: 'POST',
    headers: publicAuthHeaders(),
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    let message = 'This secure sign-in link could not be used. Please request a new link.';
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

export async function requestGoogleConnectionLink(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Enter your email address first.');
  localStorage.setItem(GOOGLE_LINK_RESUME_KEY, '1');
  const redirectUrl = `${window.location.origin}${currentUrlWithParam(GOOGLE_LINK_RESUME_PARAM, '1')}`;
  const res = await fetch(`${getAPI()}/auth/v1/magic-link`, {
    method: 'POST',
    headers: publicAuthHeaders(),
    body: JSON.stringify({
      email: normalizedEmail,
      redirect_url: redirectUrl,
      intent: 'signin',
      client_state: { intent: 'connect_google' },
    }),
  });
  if (!res.ok) {
    localStorage.removeItem(GOOGLE_LINK_RESUME_KEY);
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || 'We could not send that secure link. Please try again.');
  }
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

export async function setPassword(newPassword: string, currentPassword?: string): Promise<void> {
  const body: Record<string, string> = { new_password: newPassword };
  if (currentPassword) body.current_password = currentPassword;

  const res = await fetch(`${getAPI()}/auth/v1/user/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: getAnonKey(),
      Authorization: `Bearer ${requireAccessToken()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || 'Password could not be updated.');
  }
  localStorage.setItem(passwordSetStorageKey(), 'true');
}

export function hasPasswordSetMarker(): boolean {
  return localStorage.getItem(passwordSetStorageKey()) === 'true';
}

function passwordSetStorageKey(): string {
  return `${PASSWORD_SET_KEY_PREFIX}${getSessionEmail() || 'anonymous'}`;
}

export function passkeysSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.credentials &&
    typeof window.PublicKeyCredential !== 'undefined'
  );
}

export async function listPasskeys(): Promise<any[]> {
  const res = await fetch(`${getAPI()}/auth/v1/passkeys`, {
    headers: {
      apikey: getAnonKey(),
      Authorization: `Bearer ${requireAccessToken()}`,
    },
  });
  if (!res.ok) return [];
  const body = await res.json().catch(() => null);
  return Array.isArray(body?.passkeys) ? body.passkeys : [];
}

export async function registerPasskey(label = 'Kychon admin passkey'): Promise<any> {
  if (!passkeysSupported()) {
    throw new Error('Passkeys are not available in this browser.');
  }
  const accessToken = requireAccessToken();
  const optionsRes = await fetch(`${getAPI()}/auth/v1/passkeys/register/options`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: getAnonKey(),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ app_origin: window.location.origin }),
  });
  const optionsBody = await optionsRes.json().catch(() => null);
  if (!optionsRes.ok) {
    throw new Error(optionsBody?.message || 'Passkey setup could not be started.');
  }

  const credential = await navigator.credentials.create({
    publicKey: normalizeCreationOptions(optionsBody?.options),
  }) as PublicKeyCredential | null;
  if (!credential) throw new Error('Passkey setup was cancelled.');

  const verifyRes = await fetch(`${getAPI()}/auth/v1/passkeys/register/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: getAnonKey(),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      challenge_id: optionsBody?.challenge_id,
      response: credentialToJSON(credential),
      label,
    }),
  });
  const verifyBody = await verifyRes.json().catch(() => null);
  if (!verifyRes.ok) {
    throw new Error(verifyBody?.message || 'Passkey setup could not be completed.');
  }
  return verifyBody;
}

export async function signInWithPasskey(email?: string): Promise<any> {
  if (!passkeysSupported()) {
    throw new Error('Passkeys are not available in this browser.');
  }
  const optionsRes = await fetch(`${getAPI()}/auth/v1/passkeys/login/options`, {
    method: 'POST',
    headers: publicAuthHeaders(),
    body: JSON.stringify({
      app_origin: window.location.origin,
      ...(email ? { email } : {}),
    }),
  });
  const optionsBody = await optionsRes.json().catch(() => null);
  if (!optionsRes.ok) {
    throw new Error(optionsBody?.message || 'Passkey sign-in could not be started.');
  }

  const credential = await navigator.credentials.get({
    publicKey: normalizeRequestOptions(optionsBody?.options),
  }) as PublicKeyCredential | null;
  if (!credential) throw new Error('Passkey sign-in was cancelled.');

  const verifyRes = await fetch(`${getAPI()}/auth/v1/passkeys/login/verify`, {
    method: 'POST',
    headers: publicAuthHeaders(),
    body: JSON.stringify({
      challenge_id: optionsBody?.challenge_id,
      response: credentialToJSON(credential),
    }),
  });
  const session = await verifyRes.json().catch(() => null);
  if (!verifyRes.ok) {
    throw new Error(session?.message || 'Passkey sign-in could not be completed.');
  }
  saveSession(session);
  return session;
}

function normalizeCreationOptions(options: any): PublicKeyCredentialCreationOptions {
  const publicKey = { ...(options?.publicKey ?? options ?? {}) };
  if (typeof publicKey.challenge === 'string') publicKey.challenge = base64UrlToArrayBuffer(publicKey.challenge);
  if (publicKey.user?.id && typeof publicKey.user.id === 'string') {
    publicKey.user = { ...publicKey.user, id: base64UrlToArrayBuffer(publicKey.user.id) };
  }
  if (Array.isArray(publicKey.excludeCredentials)) {
    publicKey.excludeCredentials = publicKey.excludeCredentials.map((credential: any) => ({
      ...credential,
      id: typeof credential.id === 'string' ? base64UrlToArrayBuffer(credential.id) : credential.id,
    }));
  }
  return publicKey as PublicKeyCredentialCreationOptions;
}

function normalizeRequestOptions(options: any): PublicKeyCredentialRequestOptions {
  const publicKey = { ...(options?.publicKey ?? options ?? {}) };
  if (typeof publicKey.challenge === 'string') publicKey.challenge = base64UrlToArrayBuffer(publicKey.challenge);
  if (Array.isArray(publicKey.allowCredentials)) {
    publicKey.allowCredentials = publicKey.allowCredentials.map((credential: any) => ({
      ...credential,
      id: typeof credential.id === 'string' ? base64UrlToArrayBuffer(credential.id) : credential.id,
    }));
  }
  return publicKey as PublicKeyCredentialRequestOptions;
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function arrayBufferToBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function credentialToJSON(credential: PublicKeyCredential): any {
  const maybeToJSON = (credential as any).toJSON;
  if (typeof maybeToJSON === 'function') return maybeToJSON.call(credential);
  const response = credential.response as any;
  const json: any = {
    id: credential.id,
    type: credential.type,
    rawId: arrayBufferToBase64Url(credential.rawId),
    response: {
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
  if (response.attestationObject) json.response.attestationObject = arrayBufferToBase64Url(response.attestationObject);
  if (response.authenticatorData) json.response.authenticatorData = arrayBufferToBase64Url(response.authenticatorData);
  if (response.signature) json.response.signature = arrayBufferToBase64Url(response.signature);
  if (response.userHandle) json.response.userHandle = arrayBufferToBase64Url(response.userHandle);
  return json;
}

export function signOut(): void {
  localStorage.removeItem('wl_session');
  window.location.href = '/';
}
