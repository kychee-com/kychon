// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/auth-modal-events', () => ({
  openAuthModal: vi.fn(),
}));

import { showAuthGate } from '../../src/lib/auth-gate';
import { openAuthModal } from '../../src/lib/auth-modal-events';

describe('auth gate', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="main-content"></main>';
    vi.clearAllMocks();
  });

  it('shows a sign-in action for admin access denial', () => {
    showAuthGate('#main-content', 'admin');

    const signIn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('auth.gate.signIn'),
    );
    expect(signIn?.textContent).toBe('auth.gate.signIn');

    signIn?.click();
    expect(openAuthModal).toHaveBeenCalledWith({ trigger: signIn });
  });
});
