'use client';

import { useEffect } from 'react';
import { clearActor, loadActor } from '@/lib/auth';

// Cookie-session populate. The platform-hosted /auth/* routes own every
// sign-in / OAuth / magic-link / passkey callback now, so this island no
// longer handles callbacks. On mount it resolves the cookie actor via whoami
// (over the same-origin /api/kychon route), force-logs-out any stale
// pre-cutover localStorage session, and fans out `wl-auth-changed` so the
// chrome + gated islands repaint with the resolved actor.
export default function AuthProviderIsland() {
  useEffect(() => {
    let cancelled = false;

    async function resolveActor(): Promise<void> {
      const actor = await loadActor();
      if (cancelled) return;

      // A leftover `wl_session` (written by the pre-cutover Bearer build) has
      // no cookie, so whoami resolves it as anonymous. Clear it once so the
      // user re-signs-in through the hosted flow instead of seeing a ghost
      // signed-in state from stale storage.
      if (!actor?.authenticated) {
        try {
          if (localStorage.getItem('wl_session')) {
            localStorage.removeItem('wl_session');
            clearActor();
          }
        } catch {
          // localStorage unavailable — nothing to clear.
        }
      }

      document.dispatchEvent(new CustomEvent('wl-auth-changed'));
    }

    void resolveActor();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
