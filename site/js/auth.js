// auth.js — Google OAuth + password auth, session management, role checking

const API = window.__WILDLYCHEE_API || 'https://api.run402.com';
const ANON_KEY = window.__WILDLYCHEE_ANON_KEY || '';

// PKCE helpers
function generateVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Session management
export function getSession() {
  return JSON.parse(localStorage.getItem('wl_session') || 'null');
}

function saveSession(session) {
  localStorage.setItem('wl_session', JSON.stringify(session));
}

export function getRole() {
  const session = getSession();
  return session?.user?.member?.role || null;
}

export function isAdmin() {
  return getRole() === 'admin';
}

export function isAuthenticated() {
  return !!getSession();
}

export function requireAuth(redirectTo = '/') {
  if (!isAuthenticated()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

export function requireAdmin(redirectTo = '/') {
  if (!isAdmin()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

// Google OAuth
export async function signInWithGoogle() {
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);
  localStorage.setItem('wl_pkce_verifier', verifier);

  const res = await fetch(API + '/auth/v1/oauth/google/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({
      redirect_url: window.location.origin + '/',
      mode: 'redirect',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }),
  });
  const { authorization_url } = await res.json();
  window.location.href = authorization_url;
}

export async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.hash.substring(1));
  const code = params.get('code');
  if (!code) return null;

  window.history.replaceState(null, '', window.location.pathname);
  const verifier = localStorage.getItem('wl_pkce_verifier');
  localStorage.removeItem('wl_pkce_verifier');

  const res = await fetch(API + '/auth/v1/token?grant_type=authorization_code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ code, code_verifier: verifier }),
  });

  if (!res.ok) return null;
  const session = await res.json();
  saveSession(session);
  return session;
}

// Password auth
export async function signUp(email, password) {
  const res = await fetch(API + '/auth/v1/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Signup failed');
  }
  return res.json();
}

export async function signIn(email, password) {
  const res = await fetch(API + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
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

export function signOut() {
  localStorage.removeItem('wl_session');
  window.location.href = '/';
}

// Export for testing
export { generateVerifier, generateChallenge };
