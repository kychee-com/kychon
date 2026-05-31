'use client';

import { useEffect } from 'react';
import {
  consumeAuthReturnTo,
  consumeGoogleLinkResumeIntent,
  consumeOAuthCallbackErrorDetail,
  handleMagicLinkCallback,
  handleOAuthCallback,
  hasMagicLinkCallback,
  signInWithGoogle,
} from '@/lib/auth';
import { openAuthModal } from '@/lib/auth-modal-events';
import { init } from '@/lib/config';
import { currentPageSlug, hydratePage } from '@/lib/page-render';

function hasOAuthCallback(): boolean {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search.replace(/^\?/, ''));
  return hashParams.has('code') || hashParams.has('error') || queryParams.has('code') || queryParams.has('error');
}

function showAuthError(message: string) {
  openAuthModal({ error: message });
}

async function refreshAuthenticatedPage(): Promise<void> {
  await init();
  await hydratePage(currentPageSlug());
  document.dispatchEvent(new CustomEvent('wl-auth-changed'));
}

export default function AuthProviderIsland() {
  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      if (hasMagicLinkCallback()) {
        try {
          const resumeGoogleLink = consumeGoogleLinkResumeIntent();
          const session = await handleMagicLinkCallback();
          if (session && !cancelled) {
            await refreshAuthenticatedPage();
            if (resumeGoogleLink) await signInWithGoogle();
          }
        } catch (err) {
          showAuthError(
            err instanceof Error
              ? err.message
              : 'This secure sign-in link could not be used. Please request a new link.',
          );
        }
        return;
      }

      if (!hasOAuthCallback()) return;

      const callbackError = consumeOAuthCallbackErrorDetail();
      if (callbackError) {
        openAuthModal({
          error: callbackError.message,
          ...(callbackError.flow ? { flow: callbackError.flow } : {}),
        });
        return;
      }

      try {
        const session = await handleOAuthCallback();
        if (!session || cancelled) return;

        const returnTo = consumeAuthReturnTo();
        const currentPath = `${window.location.pathname || '/'}${window.location.search || ''}`;
        if (returnTo && returnTo !== currentPath) {
          window.location.replace(returnTo);
        } else {
          await refreshAuthenticatedPage();
        }
      } catch (err) {
        showAuthError(err instanceof Error ? err.message : 'Google sign-in could not be completed. Please try again.');
      }
    }

    void handleCallback();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
