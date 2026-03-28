import { describe, it, expect, vi, beforeEach } from 'vitest';

// Node 20+ has crypto built-in and read-only — use it directly
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
global.TextEncoder = TextEncoder;
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null; },
  setItem(k, v) { this._data[k] = v; },
  removeItem(k) { delete this._data[k]; },
};
global.window = {
  __WILDLYCHEE_API: 'https://api.test',
  __WILDLYCHEE_ANON_KEY: 'test_key',
  location: { origin: 'http://localhost', hash: '', pathname: '/', href: 'http://localhost/' },
  history: { replaceState: vi.fn() },
};
global.fetch = vi.fn();

let auth;

describe('auth.js', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage._data = {};
    global.fetch.mockReset();
    auth = await import('../../site/js/auth.js');
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
      localStorage.setItem('wl_session', JSON.stringify({
        access_token: 'tok',
        user: { member: { role: 'admin' } },
      }));
      expect(auth.getRole()).toBe('admin');
    });

    it('isAdmin returns true for admin role', () => {
      localStorage.setItem('wl_session', JSON.stringify({
        access_token: 'tok',
        user: { member: { role: 'admin' } },
      }));
      expect(auth.isAdmin()).toBe(true);
    });

    it('isAdmin returns false for member role', () => {
      localStorage.setItem('wl_session', JSON.stringify({
        access_token: 'tok',
        user: { member: { role: 'member' } },
      }));
      expect(auth.isAdmin()).toBe(false);
    });
  });

  describe('password auth', () => {
    it('signIn stores session on success', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'tok', refresh_token: 'ref', user: { id: '1', email: 'test@test.com' } }),
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
