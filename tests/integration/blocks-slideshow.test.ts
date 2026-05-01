import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function buildSlideshowDOM(opts: { autoMs?: number; slides?: number; reducedMotion?: boolean } = {}) {
  const autoMs = opts.autoMs ?? 1000;
  const total = opts.slides ?? 3;
  const wrapper = document.createElement('section');
  wrapper.className = 'section section-slideshow';
  wrapper.innerHTML = `
    <div class="container">
      <div class="block-slideshow block-slideshow--fade" tabindex="0" role="region" aria-roledescription="carousel" aria-label="Test" data-block-hydrate="slideshow" data-auto-ms="${autoMs}" style="--aspect:16/9;--fit:cover">
        <div class="block-slideshow__track">
          ${Array.from({ length: total })
            .map(
              (_, i) =>
                `<figure class="block-slideshow__slide${i === 0 ? ' is-active' : ''}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${total}" data-slide-index="${i}"><img src="/x.jpg" alt="${i}" loading="${i === 0 ? 'eager' : 'lazy'}"><figcaption class="block-slideshow__caption">Cap ${i + 1}</figcaption></figure>`,
            )
            .join('')}
        </div>
        <button class="block-slideshow__arrow block-slideshow__arrow--prev" type="button" data-slide-prev aria-label="Previous slide">&lsaquo;</button>
        <button class="block-slideshow__arrow block-slideshow__arrow--next" type="button" data-slide-next aria-label="Next slide">&rsaquo;</button>
        <div class="block-slideshow__dots" role="tablist">
          ${Array.from({ length: total })
            .map(
              (_, i) =>
                `<button class="block-slideshow__dot${i === 0 ? ' is-active' : ''}" type="button" data-slide-go="${i}" aria-label="Slide ${i + 1} of ${total}"${i === 0 ? ' aria-current="true"' : ''}></button>`,
            )
            .join('')}
        </div>
        <div class="block-slideshow__live sr-only" aria-live="polite"></div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);
  // Mock matchMedia for reduced-motion control.
  (window as any).matchMedia = (q: string) => ({
    matches: !!opts.reducedMotion && /reduce/.test(q),
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  // happy-dom doesn't have IntersectionObserver — stub it.
  (window as any).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  return wrapper.querySelector('[data-block-hydrate="slideshow"]') as HTMLElement;
}

async function init(root: HTMLElement) {
  const { initSlideshow } = await import('../../src/lib/blocks/slideshow');
  initSlideshow(root);
}

describe('slideshow controller', () => {
  it('auto-rotates through slides at the configured cadence', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3 });
    await init(root);
    expect(root.querySelectorAll('.block-slideshow__slide')[0].classList.contains('is-active')).toBe(true);
    vi.advanceTimersByTime(500);
    expect(root.querySelectorAll('.block-slideshow__slide')[1].classList.contains('is-active')).toBe(true);
    vi.advanceTimersByTime(500);
    expect(root.querySelectorAll('.block-slideshow__slide')[2].classList.contains('is-active')).toBe(true);
    vi.advanceTimersByTime(500);
    expect(root.querySelectorAll('.block-slideshow__slide')[0].classList.contains('is-active')).toBe(true);
  });

  it('mouseenter pauses rotation; mouseleave resumes', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3 });
    await init(root);
    root.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(2000);
    expect(root.querySelectorAll('.block-slideshow__slide')[0].classList.contains('is-active')).toBe(true);
    root.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(500);
    expect(root.querySelectorAll('.block-slideshow__slide')[1].classList.contains('is-active')).toBe(true);
  });

  it('next button advances and updates aria-current on dot', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 3 });
    await init(root);
    (root.querySelector('[data-slide-next]') as HTMLButtonElement).click();
    const dots = root.querySelectorAll('.block-slideshow__dot');
    expect(dots[1].getAttribute('aria-current')).toBe('true');
    expect(dots[0].hasAttribute('aria-current')).toBe(false);
  });

  it('prev button wraps from first to last slide', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 3 });
    await init(root);
    (root.querySelector('[data-slide-prev]') as HTMLButtonElement).click();
    const slides = root.querySelectorAll('.block-slideshow__slide');
    expect(slides[2].classList.contains('is-active')).toBe(true);
  });

  it('dot click jumps to that slide', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 4 });
    await init(root);
    const dots = root.querySelectorAll<HTMLButtonElement>('.block-slideshow__dot');
    dots[2].click();
    const slides = root.querySelectorAll('.block-slideshow__slide');
    expect(slides[2].classList.contains('is-active')).toBe(true);
  });

  it('arrow keys navigate when slideshow is focused', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 3 });
    await init(root);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(root.querySelectorAll('.block-slideshow__slide')[1].classList.contains('is-active')).toBe(true);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(root.querySelectorAll('.block-slideshow__slide')[0].classList.contains('is-active')).toBe(true);
  });

  it('reduced-motion disables auto-rotation', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3, reducedMotion: true });
    await init(root);
    vi.advanceTimersByTime(5000);
    // No rotation despite many ticks
    expect(root.querySelectorAll('.block-slideshow__slide')[0].classList.contains('is-active')).toBe(true);
  });

  it('cleanup on astro:before-swap clears interval', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3 });
    await init(root);
    document.dispatchEvent(new Event('astro:before-swap'));
    vi.advanceTimersByTime(5000);
    // After cleanup, slides do not advance
    expect(root.querySelectorAll('.block-slideshow__slide')[0].classList.contains('is-active')).toBe(true);
  });

  it('updates the aria-live region on slide change', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 2 });
    await init(root);
    (root.querySelector('[data-slide-next]') as HTMLButtonElement).click();
    const live = root.querySelector('.block-slideshow__live') as HTMLElement;
    expect(live.textContent).toContain('Cap 2');
  });
});
