// auth-gate.ts — Inline empty-state card shown to anonymous or non-admin users
// in place of the silent `window.location.href = '/'` redirect that requireAuth
// / requireAdmin used to perform. Page chrome (header / footer) stays put so
// the user keeps their bearings and sees a clear next action.

import { mountAuthGate } from '../components/kychon/AuthGateIsland';
import { t } from './i18n';

export type AuthGateKind = 'auth' | 'admin';
export type AuthGateContext = 'directory' | 'profile' | 'admin';

interface GateCopy {
  title: string;
  body: string;
  showSignIn: boolean;
}

export function authGateCopy(kind: AuthGateKind, context?: AuthGateContext): GateCopy {
  if (kind === 'admin') {
    return {
      title: t('auth.gate.admin.title'),
      body: t('auth.gate.admin.body'),
      showSignIn: true,
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
  mountAuthGate(targetSelector, {
    copy: authGateCopy(kind, context),
    kind,
    signInLabel: t('auth.gate.signIn'),
    backLabel: t('auth.gate.backHome'),
  });
}
