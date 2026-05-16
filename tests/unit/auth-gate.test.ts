// @vitest-environment happy-dom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appendBodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

vi.mock('../../src/lib/auth-modal-events', () => ({
  openAuthModal: vi.fn(),
}));

import { AuthGate } from '../../src/components/kychon/AuthGateIsland';
import { openAuthModal } from '../../src/lib/auth-modal-events';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

describe('auth gate', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    clearBodyFixture();
    vi.clearAllMocks();
  });

  it('shows a sign-in action for admin access denial', async () => {
    const [host] = appendBodyFixture('<main id="main-content"></main>');
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(
        React.createElement(AuthGate, {
          backLabel: 'Back to home',
          copy: { title: 'Admin access required', body: 'This page is for site admins.', showSignIn: true },
          kind: 'admin',
          signInLabel: 'Sign in',
        }),
      );
    });

    const signIn = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Sign in'),
    );
    expect(signIn?.textContent).toBe('Sign in');

    signIn?.click();
    expect(openAuthModal).toHaveBeenCalledWith({ trigger: signIn });
  });
});
