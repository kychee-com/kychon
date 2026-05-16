import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];

  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {}
}

function buildSlideshowDOM(
  opts: {
    autoMs?: number;
    slides?: number;
    reducedMotion?: boolean;
    pauseHover?: boolean;
    pauseFocus?: boolean;
    manualPause?: boolean;
  } = {},
) {
  const autoMs = opts.autoMs ?? 1000;
  const total = opts.slides ?? 3;
  const wrapper = document.createElement('section');
  wrapper.dataset.section = '';
  wrapper.setAttribute('class', 'w-full py-4');
  wrapper.innerHTML = `
    <div class="mx-auto w-full max-w-[var(--max-width)] px-6" data-layout-container>
      <div class="relative overflow-hidden" tabindex="0" role="region" aria-roledescription="carousel" aria-label="Test" data-block-hydrate="slideshow" data-auto-ms="${autoMs}" data-pause-hover="${opts.pauseHover === false ? 'false' : 'true'}" data-pause-focus="${opts.pauseFocus === false ? 'false' : 'true'}" data-manual-pause="${opts.manualPause ? 'true' : 'false'}" style="--aspect:16/9;--fit:cover">
        <div data-slideshow-track>
          ${Array.from({ length: total })
            .map(
              (_, i) =>
                `<figure class="slide" data-active="${i === 0 ? 'true' : 'false'}" data-slideshow-slide role="group" aria-roledescription="slide" aria-label="${i + 1} of ${total}" data-slide-index="${i}"><img src="/x.jpg" alt="${i}" loading="${i === 0 ? 'eager' : 'lazy'}"><figcaption data-slideshow-caption>Cap ${i + 1}</figcaption></figure>`,
            )
            .join('')}
        </div>
        <button class="slide-prev-button" type="button" data-slide-prev aria-label="Previous slide">&lsaquo;</button>
        <button class="slide-next-button" type="button" data-slide-next aria-label="Next slide">&rsaquo;</button>
        <div data-slideshow-dots role="tablist">
          ${Array.from({ length: total })
            .map(
              (_, i) =>
                `<button class="dot" data-active="${i === 0 ? 'true' : 'false'}" data-slideshow-dot type="button" data-slide-go="${i}" aria-label="Slide ${i + 1} of ${total}"${i === 0 ? ' aria-current="true"' : ''}></button>`,
            )
            .join('')}
        </div>
        <div class="sr-only" data-slideshow-live aria-live="polite"></div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);
  // Mock matchMedia for reduced-motion control.
  vi.stubGlobal(
    'matchMedia',
    (q: string): MediaQueryList => ({
      matches: !!opts.reducedMotion && /reduce/.test(q),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  );
  // happy-dom doesn't have IntersectionObserver — stub it.
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  return wrapper.querySelector('[data-block-hydrate="slideshow"]') as HTMLElement;
}

async function init(root: HTMLElement) {
  const { initSlideshow } = await import('../../src/lib/blocks/slideshow');
  initSlideshow(root);
}

function slides(root: HTMLElement) {
  return root.querySelectorAll<HTMLElement>('[data-slideshow-slide]');
}

function dots(root: HTMLElement) {
  return root.querySelectorAll<HTMLButtonElement>('[data-slideshow-dot]');
}

function expectActive(root: HTMLElement, index: number) {
  slides(root).forEach((slide, i) => {
    expect(slide.dataset.active).toBe(i === index ? 'true' : 'false');
  });
}

describe('slideshow controller', () => {
  it('auto-rotates through slides at the configured cadence', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3 });
    await init(root);
    expectActive(root, 0);
    vi.advanceTimersByTime(500);
    expectActive(root, 1);
    vi.advanceTimersByTime(500);
    expectActive(root, 2);
    vi.advanceTimersByTime(500);
    expectActive(root, 0);
  });

  it('mouseenter pauses rotation; mouseleave resumes', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3 });
    await init(root);
    root.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(2000);
    expectActive(root, 0);
    root.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(500);
    expectActive(root, 1);
  });

  it('can disable hover pause for source carousels', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3, pauseHover: false });
    await init(root);
    root.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(500);
    expectActive(root, 1);
  });

  it('manual interaction can pause future auto rotation', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3, manualPause: true });
    await init(root);
    (root.querySelector('[data-slide-next]') as HTMLButtonElement).click();
    expectActive(root, 1);
    vi.advanceTimersByTime(2000);
    expectActive(root, 1);
  });

  it('next button advances and updates aria-current on dot', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 3 });
    await init(root);
    (root.querySelector('[data-slide-next]') as HTMLButtonElement).click();
    expect(dots(root)[1].getAttribute('aria-current')).toBe('true');
    expect(dots(root)[0].hasAttribute('aria-current')).toBe(false);
  });

  it('prev button wraps from first to last slide', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 3 });
    await init(root);
    (root.querySelector('[data-slide-prev]') as HTMLButtonElement).click();
    expectActive(root, 2);
  });

  it('dot click jumps to that slide', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 4 });
    await init(root);
    dots(root)[2].click();
    expectActive(root, 2);
  });

  it('arrow keys navigate when slideshow is focused', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 3 });
    await init(root);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expectActive(root, 1);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expectActive(root, 0);
  });

  it('reduced-motion disables auto-rotation', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3, reducedMotion: true });
    await init(root);
    vi.advanceTimersByTime(5000);
    // No rotation despite many ticks
    expectActive(root, 0);
  });

  it('cleanup on astro:before-swap clears interval', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3 });
    await init(root);
    document.dispatchEvent(new Event('astro:before-swap'));
    vi.advanceTimersByTime(5000);
    // After cleanup, slides do not advance
    expectActive(root, 0);
  });

  it('stays hydrated after page-render announces content rendered', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3 });
    await init(root);
    document.dispatchEvent(new CustomEvent('wl-content-rendered'));
    expect(root.dataset.hydrated).toBe('true');
    vi.advanceTimersByTime(500);
    expectActive(root, 1);
  });

  it('updates the aria-live region on slide change', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 2 });
    await init(root);
    (root.querySelector('[data-slide-next]') as HTMLButtonElement).click();
    const live = root.querySelector('[data-slideshow-live]') as HTMLElement;
    expect(live.textContent).toContain('Cap 2');
  });
});
