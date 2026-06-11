/**
 * Subtle motion polish — section scroll-reveal and stat count-up.
 *
 * Inspired by React Bits (reactbits.dev, MIT: AnimatedContent / CountUp),
 * reimplemented dependency-free for the Kychon substrate: IntersectionObserver
 * plus CSS transitions, no gsap/motion payload.
 *
 * Design constraints (load-bearing — the concierge parity gates check them):
 * - Progressive enhancement only: the pre-animation hidden state is applied
 *   BY JS, never by static CSS, so no-JS readers, crawlers, and the no-JS
 *   parity harness always see full content.
 * - `prefers-reduced-motion: reduce` disables everything.
 * - Sections already inside the initial viewport are never hidden — first
 *   paint and LCP stay identical.
 * - `theme.motion: "none"` (html[data-motion="none"]) turns it all off;
 *   the default is "subtle".
 */

const REVEAL_ATTR = 'data-reveal';
const STAT_ATTR = 'data-stat-value';
const COUNT_DURATION_MS = 900;

function motionEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.getAttribute('data-motion') === 'none') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return typeof IntersectionObserver !== 'undefined';
}

/** Parse "1,234+" / "$50" / "98%" into countable parts. Null when the text
 *  has no usable number (e.g. "24/7") — those stats stay static. */
export function parseStatValue(text: string): { prefix: string; value: number; suffix: string; grouped: boolean } | null {
  const match = text.trim().match(/^([^0-9]*?)(\d{1,3}(?:,\d{3})+|\d+)([^0-9]*)$/);
  if (!match) return null;
  const grouped = match[2].includes(',');
  const value = Number(match[2].replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  return { prefix: match[1], value, suffix: match[3], grouped };
}

export function formatStatValue(n: number, grouped: boolean): string {
  const rounded = Math.round(n);
  return grouped ? rounded.toLocaleString('en-US') : String(rounded);
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function countUp(el: HTMLElement): void {
  const original = el.textContent ?? '';
  const parsed = parseStatValue(original);
  if (!parsed) return;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / COUNT_DURATION_MS);
    const current = parsed.value * easeOutCubic(t);
    el.textContent = `${parsed.prefix}${formatStatValue(current, parsed.grouped)}${parsed.suffix}`;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = original;
  };
  requestAnimationFrame(tick);
}

function initSectionReveal(): void {
  const sections = document.querySelectorAll<HTMLElement>('[data-section-zone="main"]');
  if (sections.length === 0) return;
  const fold = window.innerHeight;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute(REVEAL_ATTR, 'in');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const section of sections) {
    if (section.hasAttribute(REVEAL_ATTR)) continue;
    // Never hide what the visitor can already see.
    if (section.getBoundingClientRect().top < fold) {
      section.setAttribute(REVEAL_ATTR, 'in');
      continue;
    }
    section.setAttribute(REVEAL_ATTR, '');
    observer.observe(section);
  }
}

function initCountUp(): void {
  const values = document.querySelectorAll<HTMLElement>(`[${STAT_ATTR}]`);
  if (values.length === 0) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      observer.unobserve(el);
      if (el.getAttribute(STAT_ATTR) === 'done') continue;
      el.setAttribute(STAT_ATTR, 'done');
      countUp(el);
    }
  });
  for (const el of values) {
    if (el.getAttribute(STAT_ATTR) === 'done') continue;
    observer.observe(el);
  }
}

/** Idempotent; call on page load and again after swaps/section re-renders. */
export function initDelight(): void {
  if (!motionEnabled()) return;
  initSectionReveal();
  initCountUp();
}
