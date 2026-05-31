// auth-modal-events.ts — Sign-in entrypoint shim.
//
// The bespoke auth modal is gone; sign-in is the platform-hosted <SignIn>
// surface on /join. `openAuthModal` stays as the single seam every "sign in"
// affordance (~18 call sites) routes through — it now navigates to /join with
// the current location as `returnTo` so the hosted flow returns the visitor
// to where they started. The detail shape is kept for call-site compatibility;
// only navigation matters now (the hosted form owns mode/error/flow).

export interface AuthModalOpenDetail {
  error?: string;
  flow?: 'connect-google';
  mode?: 'sign-in' | 'sign-up';
  trigger?: HTMLElement | null;
}

export function openAuthModal(_detail: AuthModalOpenDetail = {}): void {
  if (typeof window === 'undefined') return;
  const current = `${window.location.pathname || '/'}${window.location.search || ''}`;
  window.location.assign(`/join?returnTo=${encodeURIComponent(current)}`);
}
