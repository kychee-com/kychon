import { beforeEach, describe, expect, it, vi } from 'vitest';

// Node 20+ has crypto built-in and read-only — use it directly
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
global.TextEncoder = TextEncoder;
global.localStorage = {
  _data: {},
  getItem(k) {
    return this._data[k] ?? null;
  },
  setItem(k, v) {
    this._data[k] = v;
  },
  removeItem(k) {
    delete this._data[k];
  },
};
global.window = {
  __KYCHON_API: 'https://api.test',
  __KYCHON_ANON_KEY: 'test_key',
  location: { origin: 'http://localhost', hash: '', pathname: '/', search: '', href: 'http://localhost/' },
  history: { replaceState: vi.fn() },
};
global.fetch = vi.fn();

let auth;

function jwt(payload) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode(payload)}.sig`;
}

describe('auth.js', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage._data = {};
    global.fetch.mockReset();
    global.window.location.pathname = '/';
    global.window.location.search = '';
    global.window.location.hash = '';
    global.window.location.href = 'http://localhost/';
    delete global.window.PublicKeyCredential;
    global.window.history.replaceState.mockClear();
    auth = await import('../../src/lib/auth.ts');
  });

  describe('PKCE', () => {
    it('generateVerifier returns a URL-safe base64 string', () => {
      const v = auth.generateVerifier();
      expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(v.length).toBeGreaterThan(10);
    });

    it('generateChallenge returns a URL-safe base64 string', async () => {
      const c = await auth.generateChallenge('test_verifier');
      expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('session management', () => {
    it('getSession returns null when no session', () => {
      expect(auth.getSession()).toBeNull();
    });

    it('getSession returns stored session', () => {
      localStorage.setItem('wl_session', JSON.stringify({ access_token: 'tok', user: { id: '1' } }));
      const s = auth.getSession();
      expect(s.access_token).toBe('tok');
    });

    it('isAuthenticated returns false when no session', () => {
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('isAuthenticated returns true when session exists', () => {
      localStorage.setItem('wl_session', JSON.stringify({ access_token: 'tok' }));
      expect(auth.isAuthenticated()).toBe(true);
    });
  });

  describe('role checking', () => {
    it('getRole returns null when no member data', () => {
      expect(auth.getRole()).toBeNull();
    });

    it('getRole returns member role', () => {
      localStorage.setItem(
        'wl_session',
        JSON.stringify({
          access_token: 'tok',
          user: { member: { role: 'admin' } },
        }),
      );
      expect(auth.getRole()).toBe('admin');
    });

    it('isAdmin returns true for admin role', () => {
      localStorage.setItem(
        'wl_session',
        JSON.stringify({
          access_token: 'tok',
          user: { member: { role: 'admin' } },
        }),
      );
      expect(auth.isAdmin()).toBe(true);
    });

    it('isAdmin returns false for member role', () => {
      localStorage.setItem(
        'wl_session',
        JSON.stringify({
          access_token: 'tok',
          user: { member: { role: 'member' } },
        }),
      );
      expect(auth.isAdmin()).toBe(false);
    });

    it('isAdmin accepts Run402 project_admin JWT sessions', () => {
      localStorage.setItem(
        'wl_session',
        JSON.stringify({
          access_token: jwt({ role: 'project_admin' }),
          user: { id: '1' },
        }),
      );
      expect(auth.getRole()).toBe('admin');
      expect(auth.isAdmin()).toBe(true);
    });
  });

  describe('session email extraction', () => {
    it('returns normalized session user email', () => {
      localStorage.setItem(
        'wl_session',
        JSON.stringify({
          access_token: 'tok',
          user: { email: 'Major.Tal@gmail.com ' },
        }),
      );
      expect(auth.getSessionEmail()).toBe('major.tal@gmail.com');
    });

    it('falls back to JWT email claims', () => {
      localStorage.setItem(
        'wl_session',
        JSON.stringify({
          access_token: jwt({ email: 'Major.Tal@gmail.com' }),
          user: { id: '1' },
        }),
      );
      expect(auth.getSessionEmail()).toBe('major.tal@gmail.com');
    });

    it('detects Google sessions from top-level OAuth provider metadata', () => {
      localStorage.setItem(
        'wl_session',
        JSON.stringify({
          access_token: 'tok',
          provider: 'google',
          user: { id: '1', email: 'owner@test.com' },
        }),
      );
      expect(auth.hasGoogleIdentity()).toBe(true);
    });

    it('detects Google sessions from fetched account identities', () => {
      localStorage.setItem(
        'wl_session',
        JSON.stringify({
          access_token: 'tok',
          user: {
            id: '1',
            email: 'owner@test.com',
            identities: [{ provider: 'google' }],
          },
        }),
      );
      expect(auth.hasGoogleIdentity()).toBe(true);
    });
  });

  describe('password auth', () => {
    it('signIn stores session on success', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: 'tok', refresh_token: 'ref', user: { id: '1', email: 'test@test.com' } }),
      });
      const session = await auth.signIn('test@test.com', 'password');
      expect(session.access_token).toBe('tok');
      expect(localStorage.getItem('wl_session')).toBeTruthy();
    });

    it('signIn throws on failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      });
      await expect(auth.signIn('bad@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('signUp calls signup endpoint', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1' }),
      });
      await auth.signUp('new@test.com', 'password');
      expect(global.fetch.mock.calls[0][0]).toContain('/auth/v1/signup');
    });

    it('setPassword uses the signed-in session bearer token', async () => {
      localStorage.setItem('wl_session', JSON.stringify({ access_token: 'tok', user: { email: 'owner@test.com' } }));
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await auth.setPassword('new-password');

      expect(global.fetch.mock.calls[0][0]).toContain('/auth/v1/user/password');
      expect(global.fetch.mock.calls[0][1].method).toBe('PUT');
      expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ new_password: 'new-password' });
      expect(auth.hasPasswordSetMarker()).toBe(true);
    });
  });

  describe('current user', () => {
    it('fetches authoritative account state and merges it into the stored session', async () => {
      localStorage.setItem('wl_session', JSON.stringify({ access_token: 'tok', user: { id: '1' } }));
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: '1',
            email: 'owner@test.com',
            identities: [{ provider: 'google' }],
            has_passkeys: true,
            passkey_count: 1,
            has_passkey_for_current_rp: true,
            current_rp_id: 'localhost',
            has_password: true,
          }),
      });

      const user = await auth.getCurrentUser();
      const session = auth.getSession();

      expect(user.passkey_count).toBe(1);
      expect(global.fetch.mock.calls[0][0]).toBe('https://api.test/auth/v1/user?app_origin=http%3A%2F%2Flocalhost');
      expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
      expect(session.user.email).toBe('owner@test.com');
      expect(session.user.identities[0].provider).toBe('google');
      expect(session.user.has_passkey_for_current_rp).toBe(true);
    });
  });

  describe('passkeys', () => {
    it('sends registration credentials as unpadded base64url', async () => {
      localStorage.setItem('wl_session', JSON.stringify({ access_token: 'tok' }));
      global.window.PublicKeyCredential = function PublicKeyCredential() {};
      const create = vi.fn().mockResolvedValue({
        id: '+/8=',
        rawId: Uint8Array.from([251, 255]).buffer,
        type: 'public-key',
        response: {
          clientDataJSON: Uint8Array.from([1, 2, 3]).buffer,
          attestationObject: Uint8Array.from([4, 5, 6]).buffer,
          getTransports: () => ['internal'],
        },
        authenticatorAttachment: 'platform',
        getClientExtensionResults: () => ({}),
        toJSON: () => ({
          id: '+/8=',
          rawId: '+/8=',
          response: { clientDataJSON: 'AQID', attestationObject: 'BAUG' },
        }),
      });
      Object.defineProperty(global, 'navigator', {
        value: { credentials: { create } },
        configurable: true,
      });
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              challenge_id: 'challenge-1',
              options: {
                challenge: 'AQID',
                user: { id: 'BAUG', name: 'owner@test.com', displayName: 'Owner' },
                excludeCredentials: [],
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'passkey-1' }),
        });

      await auth.registerPasskey();

      const verifyBody = JSON.parse(global.fetch.mock.calls[1][1].body);
      expect(verifyBody.response.id).toBe('-_8');
      expect(verifyBody.response.rawId).toBe('-_8');
      expect(verifyBody.response.response.clientDataJSON).toBe('AQID');
      expect(verifyBody.response.response.attestationObject).toBe('BAUG');
      expect(verifyBody.response.response.transports).toEqual(['internal']);
      expect(verifyBody.response.authenticatorAttachment).toBe('platform');
    });
  });

  describe('Google OAuth', () => {
    it('exchanges query-string callback codes and stores the session', async () => {
      localStorage.setItem('wl_pkce_verifier', 'verifier123');
      global.window.location.search = '?code=code123&state=state123&keep=1';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'tok',
            refresh_token: 'ref',
            user: { id: '1', email: 'test@test.com' },
          }),
      });

      const session = await auth.handleOAuthCallback();

      expect(session.access_token).toBe('tok');
      expect(global.fetch.mock.calls[0][0]).toContain('/auth/v1/token?grant_type=authorization_code');
      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
        code: 'code123',
        code_verifier: 'verifier123',
      });
      expect(global.window.history.replaceState).toHaveBeenCalledWith(null, '', '/?keep=1');
      expect(localStorage.getItem('wl_session')).toBeTruthy();
      expect(localStorage.getItem('wl_pkce_verifier')).toBeNull();
    });

    it('stores and consumes the clean current path for Google return navigation', async () => {
      global.window.location.pathname = '/admin.html';
      global.window.location.search = '?tab=setup';
      localStorage.setItem('wl_session', JSON.stringify({ access_token: 'tok', user: { email: 'Owner@Test.com' } }));
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ authorization_url: 'https://accounts.google.test/auth' }),
      });

      await auth.signInWithGoogle();

      expect(localStorage.getItem('wl_auth_return_to')).toBe('/admin?tab=setup');
      expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
        redirect_url: 'http://localhost/',
        mode: 'redirect',
        intent: 'link',
        code_challenge_method: 'S256',
        login_hint: 'owner@test.com',
      });
      expect(auth.consumeAuthReturnTo()).toBe('/admin?tab=setup');
      expect(localStorage.getItem('wl_auth_return_to')).toBeNull();
    });

    it('exchanges magic-link tokens and preserves setup query params', async () => {
      global.window.location.pathname = '/admin';
      global.window.location.search = '?fresh_start=owner_setup&token=magic123&type=magic_link';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'tok',
            refresh_token: 'ref',
            user: { id: '1', email: 'owner@test.com', is_admin: true },
          }),
      });

      expect(auth.hasMagicLinkCallback()).toBe(true);
      const session = await auth.handleMagicLinkCallback();

      expect(session.access_token).toBe('tok');
      expect(global.fetch.mock.calls[0][0]).toContain('/auth/v1/token?grant_type=magic_link');
      expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test_key');
      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ token: 'magic123' });
      expect(global.window.history.replaceState).toHaveBeenCalledWith(null, '', '/admin?fresh_start=owner_setup');
      expect(localStorage.getItem('wl_session')).toBeTruthy();
    });

    it('requests a secure link for verified Google connection', async () => {
      global.window.location.pathname = '/admin';
      global.window.location.search = '?fresh_start=owner_setup';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await auth.requestGoogleConnectionLink(' Owner@Test.COM ');

      expect(global.fetch.mock.calls[0][0]).toContain('/auth/v1/magic-link');
      expect(global.fetch.mock.calls[0][1].method).toBe('POST');
      expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test_key');
      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
        email: 'owner@test.com',
        redirect_url: 'http://localhost/admin?fresh_start=owner_setup&connect_google=1',
        intent: 'signin',
        client_state: { intent: 'connect_google' },
      });
      expect(localStorage.getItem('kychon_connect_google_after_magic')).toBe('1');
    });

    it('consumes Google connection resume intent and preserves other query params', () => {
      global.window.location.pathname = '/admin';
      global.window.location.search = '?fresh_start=owner_setup&connect_google=1';
      localStorage.setItem('kychon_connect_google_after_magic', '1');

      expect(auth.consumeGoogleLinkResumeIntent()).toBe(true);

      expect(global.window.history.replaceState).toHaveBeenCalledWith(null, '', '/admin?fresh_start=owner_setup');
      expect(localStorage.getItem('kychon_connect_google_after_magic')).toBeNull();
    });

    it('throws instead of navigating to undefined when Google OAuth start fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'redirect_url is not an allowed origin for this project' }),
      });

      await expect(auth.signInWithGoogle()).rejects.toThrow('Google sign-in is not ready on this domain yet');
      expect(global.window.location.href).toBe('http://localhost/');
    });

    it('throws instead of navigating to undefined when Google OAuth start omits the URL', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await expect(auth.signInWithGoogle()).rejects.toThrow('Google sign-in could not be started');
      expect(global.window.location.href).toBe('http://localhost/');
    });

    it('ignores unsafe return paths', () => {
      localStorage.setItem('wl_auth_return_to', 'https://evil.test/admin.html');
      expect(auth.consumeAuthReturnTo()).toBeNull();
      localStorage.setItem('wl_auth_return_to', '//evil.test/admin.html');
      expect(auth.consumeAuthReturnTo()).toBeNull();
    });

    it('consumes Google callback errors from the hash', () => {
      global.window.location.hash = '#error=account_exists_requires_link';

      expect(auth.consumeOAuthCallbackError()).toContain('already has access here');
      expect(global.window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
    });

    it('maps Google account-match errors to the connection flow', () => {
      global.window.location.hash = '#error=account_exists_requires_link';

      expect(auth.consumeOAuthCallbackErrorDetail()).toMatchObject({
        code: 'account_exists_requires_link',
        flow: 'connect-google',
      });
      expect(global.window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
    });

    it('throws when the authorization code exchange fails', async () => {
      localStorage.setItem('wl_pkce_verifier', 'verifier123');
      global.window.location.hash = '#code=code123';
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid, expired, or already used authorization code' }),
      });

      await expect(auth.handleOAuthCallback()).rejects.toThrow('Invalid, expired, or already used authorization code');
      expect(localStorage.getItem('wl_session')).toBeNull();
    });
  });

  describe('signOut', () => {
    it('clears session and POSTs server-side sign-out', async () => {
      localStorage.setItem('wl_session', JSON.stringify({ access_token: 'tok' }));
      global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      // Mock window.location
      delete global.window.location;
      global.window.location = { href: '' };
      await auth.signOut();
      expect(localStorage.getItem('wl_session')).toBeNull();
      const [url, init] = global.fetch.mock.calls[0] ?? [];
      expect(String(url)).toContain('/auth/v1/sign-out');
      expect(init?.method).toBe('POST');
      expect(init?.credentials).toBe('include');
    });
  });
});
