// nav-dropdown.ts — runtime behavior for the `nav` block's dropdowns.
//
// Loaded once and bound at first call. Re-bind across SPA navigations is
// idempotent: `el.dataset.navBound === 'true'` and `window.__navDropdownClickBound === true`
// guard against double-attach.
//
// Wires:
//   • chevron click → toggle aria-expanded + [hidden]
//   • focusin/focusout → keep aria-expanded in sync with focus subtree
//   • keydown on dropdown → ↑/↓ navigate items, Enter/Space activate,
//     Escape closes + returns focus, Tab/Shift+Tab close + advance
//   • document-level click → close any open dropdown when click is outside
//
// Touch / no-hover viewports: chevron click toggles inline expansion; focus
// management is identical (focus-open works on every modality).

const BOUND_FLAG = 'navBound';

function getFocusableInMenu(menu: HTMLElement): HTMLElement[] {
  // Items focusable via arrow keys: top-level menuitems + immediate chevron toggles.
  // Selector intentionally avoids `:scope` (not supported by happy-dom) — we
  // iterate direct <li> children and pick out each row's anchor + chevron.
  const out: HTMLElement[] = [];
  for (const child of Array.from(menu.children)) {
    if (child.tagName.toLowerCase() !== 'li') continue;
    for (const grand of Array.from(child.children)) {
      const tag = grand.tagName.toLowerCase();
      if (tag === 'a' && grand.getAttribute('role') === 'menuitem') {
        out.push(grand as HTMLElement);
      } else if (tag === 'button' && (grand as HTMLElement).classList.contains('nav-chevron-toggle')) {
        out.push(grand as HTMLElement);
      }
    }
  }
  return out;
}

function directChildren(parent: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(parent.children).filter((c) => c.matches(selector)) as HTMLElement[];
}

function findControlled(toggle: HTMLElement): HTMLElement | null {
  const id = toggle.getAttribute('aria-controls');
  if (!id) return null;
  return document.getElementById(id);
}

function findTrigger(menu: HTMLElement): HTMLElement | null {
  // Triggers always sit immediately before the menu in the DOM.
  // For top-level menus, the trigger may be a chevron-toggle button OR a parent button.
  // For nested menus, the trigger is a chevron-toggle button inside the parent <li>.
  const id = menu.id;
  if (!id) return null;
  return document.querySelector<HTMLElement>(`[aria-controls="${id}"]`);
}

function openMenu(menu: HTMLElement, focusFirst: 'first' | 'last' | null = 'first'): void {
  if (!menu.hasAttribute('hidden') && focusFirst === null) return;
  menu.removeAttribute('hidden');
  const trigger = findTrigger(menu);
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
  if (focusFirst) {
    const items = getFocusableInMenu(menu);
    const target = focusFirst === 'first' ? items[0] : items[items.length - 1];
    target?.focus();
  }
}

function closeMenu(menu: HTMLElement, returnFocus = false): void {
  if (menu.hasAttribute('hidden')) return;
  menu.setAttribute('hidden', '');
  const trigger = findTrigger(menu);
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  // Recursively close any nested open submenus.
  menu.querySelectorAll<HTMLElement>('.nav-dropdown-nested:not([hidden])').forEach((nested) => {
    nested.setAttribute('hidden', '');
    const nestedTrigger = findTrigger(nested);
    if (nestedTrigger) nestedTrigger.setAttribute('aria-expanded', 'false');
  });
  // The CSS hover-open rule would otherwise keep the menu visible until the
  // user moves their cursor off the trigger. Suppress hover-open until next
  // mouseleave so Escape / click-outside closes feel immediate.
  const wrap = menu.parentElement;
  if (wrap?.classList.contains('nav-item-wrap') || wrap?.classList.contains('nav-dropdown-parent')) {
    wrap.classList.add('nav-suppress-hover');
    const cleanup = () => {
      wrap.classList.remove('nav-suppress-hover');
      wrap.removeEventListener('mouseleave', cleanup);
    };
    wrap.addEventListener('mouseleave', cleanup);
  }
  if (returnFocus && trigger) trigger.focus();
}

function closeAllOpenMenus(except?: HTMLElement): void {
  document.querySelectorAll<HTMLElement>('.nav-dropdown:not([hidden])').forEach((menu) => {
    if (except && (menu === except || except.contains(menu) || menu.contains(except))) return;
    closeMenu(menu);
  });
}

function focusSibling(current: HTMLElement, dir: 1 | -1, items: HTMLElement[]): void {
  const idx = items.indexOf(current);
  if (idx === -1) return;
  const next = (idx + dir + items.length) % items.length;
  items[next]?.focus();
}

function bindChevronToggles(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.nav-chevron-toggle, .nav-link.nav-parent-button').forEach((trigger) => {
    if (trigger.dataset.chevronBound === 'true') return;
    trigger.dataset.chevronBound = 'true';
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const menu = findControlled(trigger);
      if (!menu) return;
      const wasOpen = !menu.hasAttribute('hidden');
      // Close sibling dropdowns at the same level for cleanliness.
      const parentList = menu.parentElement?.parentElement;
      if (parentList) {
        // Iterate direct children to find sibling .nav-dropdowns (avoids :scope).
        Array.from(parentList.children).forEach((sibling) => {
          if (sibling === menu.parentElement) return;
          const otherMenu = sibling.querySelector(':scope > .nav-dropdown') as HTMLElement | null
            || (sibling.tagName.toLowerCase() === 'li'
              ? Array.from(sibling.children).find((c) => c.classList.contains('nav-dropdown')) as HTMLElement | undefined
              : undefined);
          if (otherMenu && otherMenu !== menu && !otherMenu.hasAttribute('hidden')) {
            closeMenu(otherMenu);
          }
        });
      }
      if (wasOpen) closeMenu(menu);
      else openMenu(menu, 'first');
    });
  });
}

function bindKeyboard(root: HTMLElement): void {
  if (root.dataset.navKeyboardBound === 'true') return;
  root.dataset.navKeyboardBound = 'true';

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    const isTrigger = target.classList.contains('nav-chevron-toggle')
      || target.classList.contains('nav-parent-button');
    const insideMenu = target.closest('.nav-dropdown') as HTMLElement | null;

    if (isTrigger) {
      const menu = findControlled(target);
      if (!menu) return;
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu(menu, 'first');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu(menu, 'last');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu(menu);
      }
      return;
    }

    if (insideMenu) {
      const items = getFocusableInMenu(insideMenu);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusSibling(target, 1, items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusSibling(target, -1, items);
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu(insideMenu, true);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (target.tagName.toLowerCase() === 'a') {
          // Native anchor activation; menu closes after navigation. Close
          // proactively for SPA-style links.
          if (e.key === ' ') {
            e.preventDefault();
            (target as HTMLAnchorElement).click();
          }
          // Close all menus along the chain.
          closeAllOpenMenus();
        } else if (target.classList.contains('nav-chevron-toggle')) {
          // Already handled above as trigger.
        }
      } else if (e.key === 'Tab') {
        // Close current menu when tabbing out — let native focus order continue.
        closeMenu(insideMenu);
      }
    }
  });
}

function bindFocusSync(root: HTMLElement): void {
  if (root.dataset.navFocusBound === 'true') return;
  root.dataset.navFocusBound = 'true';

  // Per WAI-ARIA menu-button pattern, focus alone does NOT open the menu —
  // only ArrowDown/ArrowUp/Enter/Space on the trigger does (handled in
  // bindKeyboard). focusout DOES close the menu when focus leaves the wrap
  // subtree (e.g., user tabbed away).
  root.addEventListener('focusout', (e) => {
    const t = e.target as HTMLElement;
    if (!t) return;
    const wrap = t.closest('.nav-item-wrap') as HTMLElement | null;
    if (!wrap) return;
    // Defer to allow focusin elsewhere to fire first.
    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || !wrap.contains(active)) {
        const menu = directChildren(wrap, '.nav-dropdown')[0] || null;
        if (menu && !menu.hasAttribute('hidden')) closeMenu(menu);
      }
    }, 0);
  });
}

function bindHoverSync(root: HTMLElement): void {
  if (root.dataset.navHoverBound === 'true') return;
  root.dataset.navHoverBound = 'true';

  // CSS handles visual hover-open via the @media (hover) query, but we still
  // need to keep `aria-expanded` in sync with hover state for assistive tech.
  root.querySelectorAll<HTMLElement>('.nav-item-wrap, .nav-dropdown-parent').forEach((wrap) => {
    if ((wrap as any).dataset.navHoverWrapBound === 'true') return;
    (wrap as any).dataset.navHoverWrapBound = 'true';
    wrap.addEventListener('mouseenter', () => {
      const menu = directChildren(wrap, '.nav-dropdown')[0] || null;
      if (!menu) return;
      const trigger = findTrigger(menu);
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      menu.removeAttribute('hidden');
    });
    wrap.addEventListener('mouseleave', () => {
      const menu = directChildren(wrap, '.nav-dropdown')[0] || null;
      if (!menu) return;
      // Don't close if focus is still inside the menu (keyboard user).
      if (wrap.contains(document.activeElement)) return;
      const trigger = findTrigger(menu);
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      menu.setAttribute('hidden', '');
    });
  });
}

function bindClickOutside(): void {
  if ((window as any).__navDropdownClickBound === true) return;
  (window as any).__navDropdownClickBound = true;
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    document.querySelectorAll<HTMLElement>('.nav-dropdown:not([hidden])').forEach((menu) => {
      const trigger = findTrigger(menu);
      const inMenu = menu.contains(target);
      const inTrigger = trigger ? trigger.contains(target) : false;
      // Also keep open if click is inside the same nav-item-wrap (covers
      // clicks on the parent <a class="nav-link nav-parent"> that opens
      // alongside its chevron).
      const wrap = menu.parentElement?.classList.contains('nav-item-wrap')
        ? (menu.parentElement as HTMLElement)
        : null;
      const inWrap = wrap ? wrap.contains(target) : false;
      if (!inMenu && !inTrigger && !inWrap) closeMenu(menu);
    });
  });
}

export function bindNavDropdowns(navRoot?: HTMLElement | null): void {
  const root = navRoot || (document.getElementById('nav-links') as HTMLElement | null);
  if (!root) return;
  if (root.dataset[BOUND_FLAG] === 'true') {
    // Re-scan: new nav items may have appeared via SPA re-render. The flags on
    // individual elements (chevronBound / focusBound) keep this idempotent.
    bindChevronToggles(root);
    bindHoverSync(root);
    bindClickOutside();
    return;
  }
  root.dataset[BOUND_FLAG] = 'true';
  bindChevronToggles(root);
  bindKeyboard(root);
  bindFocusSync(root);
  bindHoverSync(root);
  bindClickOutside();
}

export function rebindNavDropdowns(): void {
  // Called after SPA swap or section re-render. Resets per-element flags so a
  // freshly-rendered nav block picks up the bindings.
  const root = document.getElementById('nav-links') as HTMLElement | null;
  if (!root) return;
  // The root-level flags persist (the listeners are on the root element which
  // doesn't get replaced — only innerHTML changes). For inner triggers we
  // already rely on per-element `dataset.chevronBound` to gate.
  bindChevronToggles(root);
  bindHoverSync(root);
}
