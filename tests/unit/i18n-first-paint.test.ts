// @vitest-environment happy-dom

// Regression for kychee-com/kychon#185: on a cold load the sign-in island
// rendered before /custom/strings/en.json arrived, so t('nav.sign_in')
// returned the raw key and the button flashed "nav.sign_in".

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendBodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

vi.mock('../../src/lib/auth', () => ({ getSession: () => null }));
vi.mock('../../src/lib/auth-modal-events', () => ({ openAuthModal: vi.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('i18n first paint (before strings load)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    clearBodyFixture();
  });

  it('t() resolves known chrome keys to English before any locale is loaded', async () => {
    const { t } = await import('../../src/lib/i18n');
    expect(t('nav.sign_in')).toBe('Sign in');
    expect(t('nav.sign_out')).toBe('Sign out');
    expect(t('nav.profile')).toBe('Profile');
  });

  it('still returns the key for genuinely unknown keys', async () => {
    const { t } = await import('../../src/lib/i18n');
    expect(t('definitely.not.a.key')).toBe('definitely.not.a.key');
  });

  it('sign-in island first render shows "Sign in", not the raw key', async () => {
    const { mountSignInBarIsland } = await import('../../src/components/kychon/SignInBarIsland');
    const [host] = appendBodyFixture('<div></div>');
    await act(async () => {
      mountSignInBarIsland(host, { showLangToggle: false, showThemeToggle: false });
    });
    const button = host.querySelector('#login-btn');
    expect(button?.textContent).toBe('Sign in');
    expect(host.textContent).not.toContain('nav.sign_in');
  });
});
