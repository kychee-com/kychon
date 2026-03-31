// toast.js — Lightweight toast notification system
// Usage: import { showToast } from './toast.js?v=6';
//        showToast('You are going!', 'success');

const ICONS = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
};

let container = null;
let dismissTimer = null;

function getContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

export function showToast(message, type = 'info') {
  const c = getContainer();

  // Remove existing toast
  if (dismissTimer) clearTimeout(dismissTimer);
  c.innerHTML = '';

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${ICONS[type] || ICONS.info}</span><span>${message}</span>`;
  c.appendChild(toast);

  // Auto-dismiss after 3s
  dismissTimer = setTimeout(() => {
    toast.classList.add('dismissing');
    toast.addEventListener(
      'animationend',
      () => {
        toast.remove();
      },
      { once: true },
    );
  }, 3000);
}
