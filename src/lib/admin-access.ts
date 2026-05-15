import { showAuthGate } from './auth-gate.js';
import { removeNode } from './dom-fragment';

const CHECKING_SELECTOR = '[data-admin-access-checking]';
const CONTENT_SELECTOR = '[data-admin-content]';

export function revealAdminContent(): void {
  const checking = document.querySelector(CHECKING_SELECTOR);
  if (checking) removeNode(checking);
  const content = document.querySelector<HTMLElement>(CONTENT_SELECTOR);
  if (content) content.hidden = false;
}

export function showAdminAccessDenied(target = '#main-content'): void {
  const checking = document.querySelector(CHECKING_SELECTOR);
  if (checking) removeNode(checking);
  showAuthGate(target, 'admin');
}
