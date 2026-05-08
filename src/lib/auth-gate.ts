// auth-gate.ts — Inline empty-state card shown to anonymous or non-admin users
// in place of the silent `window.location.href = '/'` redirect that requireAuth
// / requireAdmin used to perform. Page chrome (header / footer) stays put so
// the user keeps their bearings and sees a clear next action.

import { openAuthModal } from './auth-modal-events';
import { t } from './i18n';

export type AuthGateKind = 'auth' | 'admin';
export type AuthGateContext = 'directory' | 'profile' | 'admin';

interface GateCopy {
  title: string;
  body: string;
  showSignIn: boolean;
}

const ICON_AUTH = '\u{1F512}'; // 🔒
const ICON_ADMIN = '\u{1F6E1}\u{FE0F}'; // 🛡️

function escHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function gateCopy(kind: AuthGateKind, context?: AuthGateContext): GateCopy {
  if (kind === 'admin') {
    return {
      title: t('auth.gate.admin.title'),
      body: t('auth.gate.admin.body'),
      showSignIn: false,
    };
  }
  const ctx = context === 'profile' ? 'profile' : 'directory';
  return {
    title: t(`auth.gate.${ctx}.title`),
    body: t(`auth.gate.${ctx}.body`),
    showSignIn: true,
  };
}

export function showAuthGate(
  targetSelector: string,
  kind: AuthGateKind,
  context?: AuthGateContext,
): void {
  const target = document.querySelector(targetSelector) as HTMLElement | null;
  if (!target) return;

  const { title, body, showSignIn } = gateCopy(kind, context);
  const icon = kind === 'admin' ? ICON_ADMIN : ICON_AUTH;
  const signInLabel = t('auth.gate.signIn');
  const backLabel = t('auth.gate.backHome');

  const signInBtn = showSignIn
    ? `<button type="button" class="btn btn-primary" data-auth-gate-action="sign-in">${escHtml(signInLabel)}</button>`
    : '';

  target.innerHTML = `
    <div class="ky-container auth-gate">
      <div class="auth-gate__card card" role="status" aria-live="polite">
        <div class="auth-gate__icon" aria-hidden="true">${icon}</div>
        <h2 class="auth-gate__title">${escHtml(title)}</h2>
        <p class="auth-gate__body ky-text-muted">${escHtml(body)}</p>
        <div class="auth-gate__actions">
          ${signInBtn}
          <a class="btn btn-secondary" href="/" data-auth-gate-action="home">${escHtml(backLabel)}</a>
        </div>
      </div>
    </div>
  `;

  const signInEl = target.querySelector('[data-auth-gate-action="sign-in"]');
  signInEl?.addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal({ trigger: e.currentTarget as HTMLElement });
    // The gate wiped the page's interactive elements, so the page's own
    // wl-auth-changed listener can't repaint them. Reload once the modal
    // completes sign-in so the page boots fresh against the new session.
    document.addEventListener('wl-auth-changed', () => window.location.reload(), {
      once: true,
    });
  });

  const homeEl = target.querySelector('[data-auth-gate-action="home"]');
  homeEl?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.assign('/');
  });
}
