// auth-gate.ts — Shared copy for inline empty-state cards shown to anonymous
// or non-admin users. Page chrome stays put so the user keeps their bearings
// and sees a clear next action.

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
