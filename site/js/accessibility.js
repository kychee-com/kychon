// accessibility.js — Font scaling, high contrast, reduced motion, toolbar, focus management
// Loaded on every page. Preferences applied before first paint via applyA11yPrefs().

const FONT_SCALES = [1, 1.25, 1.5];
const FONT_SCALE_LABELS = ['100%', '125%', '150%'];
const LS_FONT_SCALE = 'wl_font_scale';
const LS_HIGH_CONTRAST = 'wl_high_contrast';
const LS_REDUCED_MOTION = 'wl_reduced_motion';

// --- Apply preferences (call early, before first paint) ---

export function applyA11yPrefs() {
  const scale = localStorage.getItem(LS_FONT_SCALE);
  if (scale) document.documentElement.style.setProperty('--wl-font-scale', scale);

  if (localStorage.getItem(LS_HIGH_CONTRAST) === '1') {
    document.documentElement.classList.add('wl-high-contrast');
  }

  if (localStorage.getItem(LS_REDUCED_MOTION) === '1') {
    document.documentElement.classList.add('wl-reduced-motion');
  }
}

// --- Screen reader announcements ---

export function announce(message) {
  const el = document.getElementById('wl-sr-live');
  if (!el) return;
  el.textContent = '';
  // Use setTimeout to ensure screen readers pick up the change
  setTimeout(() => {
    el.textContent = message;
  }, 50);
}

// --- Focus trap for modals ---

let _focusTrapEl = null;
let _focusTrigger = null;

export function trapFocus(modalEl, triggerEl) {
  _focusTrapEl = modalEl;
  _focusTrigger = triggerEl || document.activeElement;
  const focusable = _getFocusable(modalEl);
  if (focusable.length) focusable[0].focus();
  document.addEventListener('keydown', _focusTrapHandler);
}

export function releaseFocus() {
  document.removeEventListener('keydown', _focusTrapHandler);
  if (_focusTrigger?.focus) _focusTrigger.focus();
  _focusTrapEl = null;
  _focusTrigger = null;
}

function _focusTrapHandler(e) {
  if (!_focusTrapEl) return;
  if (e.key === 'Escape') {
    releaseFocus();
    // Close the modal — dispatch custom event so page JS can handle it
    _focusTrapEl?.dispatchEvent(new CustomEvent('wl-modal-close'));
    return;
  }
  if (e.key !== 'Tab') return;
  const focusable = _getFocusable(_focusTrapEl);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function _getFocusable(el) {
  return [
    ...el.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((e) => e.offsetParent !== null);
}

// --- Arrow-key navigation for dropdowns ---

export function enableArrowNav(containerEl) {
  containerEl.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Escape'].includes(e.key)) return;
    const items = _getFocusable(containerEl);
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Escape') {
      containerEl.classList.remove('open');
      containerEl.closest('.wl-a11y-toolbar')?.querySelector('.wl-a11y-btn')?.focus();
    }
  });
}

// --- Build accessibility toolbar ---

export function buildA11yToolbar() {
  const userEl = document.getElementById('nav-user');
  if (!userEl) return;

  const toolbar = document.createElement('div');
  toolbar.className = 'wl-a11y-toolbar';

  const btn = document.createElement('button');
  btn.className = 'wl-a11y-btn';
  btn.setAttribute('aria-label', 'Accessibility options');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-haspopup', 'true');
  btn.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="1"/><path d="M7 8h10"/><path d="M12 8v8"/><path d="M9 20l3-4 3 4"/></svg>';

  const dropdown = document.createElement('div');
  dropdown.className = 'wl-a11y-dropdown';
  dropdown.setAttribute('role', 'menu');

  // Font size
  const currentScale = parseFloat(localStorage.getItem(LS_FONT_SCALE) || '1');
  dropdown.innerHTML = `
    <div class="wl-a11y-group-label" role="presentation">Text Size</div>
    <label role="menuitem">
      <span>Font size</span>
      <div class="wl-a11y-scale-btns">
        ${FONT_SCALES.map(
          (s, i) =>
            `<button data-scale="${s}" class="${s === currentScale ? 'active' : ''}" aria-label="Font size ${FONT_SCALE_LABELS[i]}">${FONT_SCALE_LABELS[i]}</button>`,
        ).join('')}
      </div>
    </label>
    <div class="wl-a11y-group-label" role="presentation">Display</div>
    <label role="menuitem">
      <span>High contrast</span>
      <button class="wl-toggle" role="switch" aria-checked="${localStorage.getItem(LS_HIGH_CONTRAST) === '1'}" aria-label="Toggle high contrast" id="wl-hc-toggle"></button>
    </label>
    <label role="menuitem">
      <span>Reduce motion</span>
      <button class="wl-toggle" role="switch" aria-checked="${localStorage.getItem(LS_REDUCED_MOTION) === '1' || (window.matchMedia('(prefers-reduced-motion: reduce)').matches && localStorage.getItem(LS_REDUCED_MOTION) !== '0')}" aria-label="Toggle reduced motion" id="wl-rm-toggle"></button>
    </label>
  `;

  toolbar.appendChild(btn);
  toolbar.appendChild(dropdown);
  userEl.prepend(toolbar);

  // Toggle dropdown
  btn.addEventListener('click', () => {
    const isOpen = dropdown.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      const first = dropdown.querySelector('button');
      if (first) first.focus();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!toolbar.contains(e.target)) {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Close on Escape
  dropdown.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });

  // Font scale buttons
  dropdown.querySelectorAll('[data-scale]').forEach((scaleBtn) => {
    scaleBtn.addEventListener('click', () => {
      const scale = scaleBtn.dataset.scale;
      document.documentElement.style.setProperty('--wl-font-scale', scale);
      localStorage.setItem(LS_FONT_SCALE, scale);
      dropdown.querySelectorAll('[data-scale]').forEach((b) => b.classList.remove('active'));
      scaleBtn.classList.add('active');
    });
  });

  // High contrast toggle
  const hcToggle = dropdown.querySelector('#wl-hc-toggle');
  if (hcToggle) {
    hcToggle.addEventListener('click', () => {
      const on = hcToggle.getAttribute('aria-checked') !== 'true';
      hcToggle.setAttribute('aria-checked', String(on));
      document.documentElement.classList.toggle('wl-high-contrast', on);
      localStorage.setItem(LS_HIGH_CONTRAST, on ? '1' : '0');
    });
  }

  // Reduced motion toggle
  const rmToggle = dropdown.querySelector('#wl-rm-toggle');
  if (rmToggle) {
    rmToggle.addEventListener('click', () => {
      const on = rmToggle.getAttribute('aria-checked') !== 'true';
      rmToggle.setAttribute('aria-checked', String(on));
      document.documentElement.classList.toggle('wl-reduced-motion', on);
      localStorage.setItem(LS_REDUCED_MOTION, on ? '1' : '0');
    });
  }

  // Arrow-key nav within dropdown
  enableArrowNav(dropdown);
}
