export const AUTH_OPEN_EVENT = 'kychon:auth-open';

export interface AuthModalOpenDetail {
  error?: string;
  flow?: 'connect-google';
  mode?: 'sign-in' | 'sign-up';
  trigger?: HTMLElement | null;
}

export function openAuthModal(detail: AuthModalOpenDetail = {}): void {
  document.dispatchEvent(new CustomEvent<AuthModalOpenDetail>(AUTH_OPEN_EVENT, { detail }));
}
