// slideshow.ts — runtime controller for the `slideshow` block-type.
//
// Targets ≤ 4 kB minified. Pauses on hover, focus-within, and tab-hidden.
// Disables auto-rotation entirely under prefers-reduced-motion. Wires up
// arrow buttons, dots, arrow keys, and a polite live region for slide
// changes. Uses IntersectionObserver to lazy-load slide images outside the
// viewport (a small win on top of `loading="lazy"` for above-fold cases).

interface SlideshowState {
  root: HTMLElement;
  slides: HTMLElement[];
  dots: HTMLButtonElement[];
  live: HTMLElement | null;
  index: number;
  autoMs: number;
  reduced: boolean;
  intervalId: number | null;
  pauseOnHover: boolean;
  pauseOnFocus: boolean;
  manualPauseAfterInteraction: boolean;
  paused: { hover: boolean; focus: boolean; hidden: boolean; manual: boolean };
  onVis: () => void;
  onSwap: () => void;
  io: IntersectionObserver | null;
}

const STATES = new WeakMap<HTMLElement, SlideshowState>();

export function initSlideshow(root: HTMLElement): void {
  if (root.dataset.hydrated === 'true') return;
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-slideshow-slide]'));
  if (slides.length <= 0) return;
  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-slideshow-dot]'));
  const live = root.querySelector<HTMLElement>('[data-slideshow-live]');
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const autoMs = Math.max(0, Number(root.dataset.autoMs) || 0);
  const pauseOnHover = root.dataset.pauseHover !== 'false';
  const pauseOnFocus = root.dataset.pauseFocus !== 'false';
  const manualPauseAfterInteraction = root.dataset.manualPause === 'true';

  const state: SlideshowState = {
    root,
    slides,
    dots,
    live,
    index: 0,
    autoMs,
    reduced,
    intervalId: null,
    pauseOnHover,
    pauseOnFocus,
    manualPauseAfterInteraction,
    paused: { hover: false, focus: false, hidden: false, manual: false },
    onVis: () => {
      state.paused.hidden = document.visibilityState !== 'visible';
      reschedule(state);
    },
    onSwap: () => destroySlideshow(root),
    io: null,
  };
  STATES.set(root, state);

  // Initial active state.
  setActive(state, 0, /*announce*/ false);

  // Arrow buttons.
  root.querySelector('[data-slide-prev]')?.addEventListener('click', () => {
    setActive(state, state.index - 1, true);
    pauseManual(state);
    reschedule(state);
  });
  root.querySelector('[data-slide-next]')?.addEventListener('click', () => {
    setActive(state, state.index + 1, true);
    pauseManual(state);
    reschedule(state);
  });

  // Dots.
  for (const dot of dots) {
    dot.addEventListener('click', () => {
      const target = Number(dot.dataset.slideGo) || 0;
      setActive(state, target, true);
      pauseManual(state);
      reschedule(state);
    });
  }

  // Keyboard arrows when slideshow has focus.
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActive(state, state.index + 1, true);
      pauseManual(state);
      reschedule(state);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive(state, state.index - 1, true);
      pauseManual(state);
      reschedule(state);
    }
  });

  // Pause on hover / focus.
  root.addEventListener('mouseenter', () => {
    if (!state.pauseOnHover) return;
    state.paused.hover = true;
    reschedule(state);
  });
  root.addEventListener('mouseleave', () => {
    if (!state.pauseOnHover) return;
    state.paused.hover = false;
    reschedule(state);
  });
  root.addEventListener('focusin', () => {
    if (!state.pauseOnFocus) return;
    state.paused.focus = true;
    reschedule(state);
  });
  root.addEventListener('focusout', () => {
    // Defer so :focus-within transitions out before we resume.
    setTimeout(() => {
      if (!root.contains(document.activeElement)) {
        state.paused.focus = false;
        reschedule(state);
      }
    }, 0);
  });

  // Tab visibility.
  document.addEventListener('visibilitychange', state.onVis);
  // SPA cleanup hook. Runtime page hydration emits `wl-content-rendered` after
  // dynamic blocks bind; treating that event as teardown immediately disables
  // the carousel on normal page loads.
  document.addEventListener('astro:before-swap', state.onSwap);

  // IntersectionObserver lazy-load: ensure off-screen slides only fetch
  // their image when scrolled near the viewport.
  if (typeof IntersectionObserver !== 'undefined') {
    state.io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const img = entry.target as HTMLImageElement;
          // Browser already handles loading=lazy; this is a hint to bring
          // forward (mark as eager once we're nearby).
          if (img.loading === 'lazy') img.loading = 'eager';
          state.io?.unobserve(img);
        }
      },
      { rootMargin: '200px' },
    );
    for (const slide of slides) {
      const img = slide.querySelector<HTMLImageElement>('img');
      if (img && img.loading === 'lazy') state.io.observe(img);
    }
  }

  root.dataset.hydrated = 'true';

  // Start auto-rotation unless reduced motion or no auto.
  if (!state.reduced && state.autoMs > 0) {
    reschedule(state);
  }
}

function pauseManual(state: SlideshowState): void {
  if (!state.manualPauseAfterInteraction) return;
  state.paused.manual = true;
}

function setActive(state: SlideshowState, raw: number, announce: boolean): void {
  const total = state.slides.length;
  if (total === 0) return;
  const next = ((raw % total) + total) % total;
  if (next === state.index && state.slides[next]?.dataset.active === 'true') {
    // Already correct (initial paint); nothing to do.
  }
  for (let i = 0; i < total; i++) {
    const slide = state.slides[i];
    if (!slide) continue;
    const isActive = i === next;
    slide.dataset.active = isActive ? 'true' : 'false';
  }
  for (let i = 0; i < state.dots.length; i++) {
    const dot = state.dots[i];
    if (!dot) continue;
    const isActive = i === next;
    dot.dataset.active = isActive ? 'true' : 'false';
    if (isActive) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  }
  state.index = next;
  if (announce && state.live) {
    const nextSlide = state.slides[next];
    const cap = nextSlide?.querySelector<HTMLElement>('[data-slideshow-caption]');
    state.live.textContent = cap?.textContent?.trim() || `Slide ${next + 1} of ${total}`;
  }
}

function reschedule(state: SlideshowState): void {
  // Always clear the existing interval; if any pause flag is set, leave it cleared.
  if (state.intervalId != null) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  if (state.reduced) return;
  if (state.autoMs <= 0) return;
  const { hover, focus, hidden, manual } = state.paused;
  if (hover || focus || hidden || manual) return;
  state.intervalId = window.setInterval(() => {
    setActive(state, state.index + 1, true);
  }, state.autoMs);
}

export function destroySlideshow(root: HTMLElement): void {
  const state = STATES.get(root);
  if (!state) return;
  if (state.intervalId != null) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  document.removeEventListener('visibilitychange', state.onVis);
  document.removeEventListener('astro:before-swap', state.onSwap);
  state.io?.disconnect();
  STATES.delete(root);
  // Allow re-init if the same node is re-rendered.
  delete root.dataset.hydrated;
}
