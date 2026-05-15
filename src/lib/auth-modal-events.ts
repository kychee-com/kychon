export const AUTH_OPEN_EVENT = 'kychon:auth-open';

export interface AuthModalOpenDetail {
  error?: string;
  flow?: 'connect-google';
  mode?: 'sign-in' | 'sign-up';
  trigger?: HTMLElement | null;
}

const PENDING_AUTH_MODAL_OPEN_KEY = '__kychonPendingAuthModalOpen';

function authModalWindow(): (Window & typeof globalThis & { [PENDING_AUTH_MODAL_OPEN_KEY]?: AuthModalOpenDetail }) | null {
  return typeof window === 'undefined' ? null : (window as Window & typeof globalThis);
}

export function openAuthModal(detail: AuthModalOpenDetail = {}): void {
  const win = authModalWindow();
  if (win) win[PENDING_AUTH_MODAL_OPEN_KEY] = detail;
  document.dispatchEvent(new CustomEvent<AuthModalOpenDetail>(AUTH_OPEN_EVENT, { detail }));
}

export function consumePendingAuthModalOpen(): AuthModalOpenDetail | null {
  const win = authModalWindow();
  if (!win?.[PENDING_AUTH_MODAL_OPEN_KEY]) return null;
  const detail = win[PENDING_AUTH_MODAL_OPEN_KEY];
  delete win[PENDING_AUTH_MODAL_OPEN_KEY];
  return detail;
}
