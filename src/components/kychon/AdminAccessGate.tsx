'use client';

import type { ReactNode } from 'react';
import { authGateCopy } from '@/lib/auth-gate';
import { t } from '@/lib/i18n';
import AdminAccessShellView from './AdminAccessShellView';
import { AuthGate } from './AuthGateIsland';

export type AdminAccessState = 'checking' | 'allowed' | 'denied';

interface AdminAccessGateProps {
  children: ReactNode;
  state: AdminAccessState;
}

export function AdminAccessGate({ children, state }: AdminAccessGateProps) {
  if (state === 'checking') {
    return <AdminAccessShellView title="Checking access" body="Confirming your admin session." />;
  }

  if (state === 'denied') {
    return (
      <AuthGate
        backLabel={t('auth.gate.backHome')}
        copy={authGateCopy('admin')}
        kind="admin"
        signInLabel={t('auth.gate.signIn')}
      />
    );
  }

  return <>{children}</>;
}
