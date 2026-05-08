import { beforeEach, describe, expect, it, vi } from 'vitest';

// Node 20+ has crypto built-in and read-only — use it directly
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
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

    it('stores and consumes the current path for Google return navigation', async () => {
      global.window.location.pathname = '/admin.html';
      global.window.location.search = '?tab=setup';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ authorization_url: 'https://accounts.google.test/auth' }),
      });

      await auth.signInWithGoogle();

      expect(localStorage.getItem('wl_auth_return_to')).toBe('/admin.html?tab=setup');
      expect(auth.consumeAuthReturnTo()).toBe('/admin.html?tab=setup');
      expect(localStorage.getItem('wl_auth_return_to')).toBeNull();
    });

    it('ignores unsafe return paths', () => {
      localStorage.setItem('wl_auth_return_to', 'https://evil.test/admin.html');
      expect(auth.consumeAuthReturnTo()).toBeNull();
      localStorage.setItem('wl_auth_return_to', '//evil.test/admin.html');
      expect(auth.consumeAuthReturnTo()).toBeNull();
    });

    it('consumes Google callback errors from the hash', () => {
      global.window.location.hash = '#error=account_exists_requires_link';

      expect(auth.consumeOAuthCallbackError()).toContain('already exists');
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
    it('clears session', () => {
      localStorage.setItem('wl_session', JSON.stringify({ access_token: 'tok' }));
      // Mock window.location
      delete global.window.location;
      global.window.location = { href: '' };
      auth.signOut();
      expect(localStorage.getItem('wl_session')).toBeNull();
    });
  });
});
