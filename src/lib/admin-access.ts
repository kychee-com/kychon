import { showAuthGate } from './auth-gate.js';

const CHECKING_SELECTOR = '[data-admin-access-checking]';
const CONTENT_SELECTOR = '[data-admin-content]';

export function revealAdminContent(): void {
  document.querySelector(CHECKING_SELECTOR)?.remove();
  const content = document.querySelector<HTMLElement>(CONTENT_SELECTOR);
  if (content) content.hidden = false;
}

export function showAdminAccessDenied(target = '#main-content'): void {
  document.querySelector(CHECKING_SELECTOR)?.remove();
  showAuthGate(target, 'admin');
}
