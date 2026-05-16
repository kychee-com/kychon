import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ctx: BlockRenderContext = { admin: false, locale: 'en' };

function slideshowSection(config: Record<string, unknown>): Section {
  return {
    id: 77,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'slideshow',
    position: 1,
    config,
  };
}

beforeEach(() => {
  clearBodyFixture();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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
  const wrapper = bodyFixture(
    renderBlock(
      slideshowSection({
        auto_rotate_seconds: autoMs / 1000,
        heading: 'Test',
        items: Array.from({ length: total }, (_, i) => ({
          alt: String(i),
          caption: `Cap ${i + 1}`,
          src: '/x.jpg',
        })),
        manual_pause: opts.manualPause === true,
        pause_on_focus: opts.pauseFocus !== false,
        pause_on_hover: opts.pauseHover !== false,
      }),
      ctx,
    ),
  );
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
  return wrapper.querySelector('[data-block-hydrate="slideshow"]') as HTMLElement;
}

async function init(root: HTMLElement) {
  const { initSlideshow } = await import('../../src/lib/blocks/slideshow');
  await act(async () => {
    initSlideshow(root);
  });
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

function carousel(root: HTMLElement) {
  return root.querySelector('[data-slideshow]') as HTMLElement;
}

async function tick(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function click(root: HTMLElement, selector: string) {
  const target = root.querySelector(selector) as HTMLButtonElement;
  await act(async () => {
    target.click();
  });
}

async function dispatchCarouselEvent(root: HTMLElement, event: Event) {
  await act(async () => {
    carousel(root).dispatchEvent(event);
  });
}

describe('slideshow controller', () => {
  it('auto-rotates through slides at the configured cadence', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3 });
    await init(root);
    expectActive(root, 0);
    await tick(500);
    expectActive(root, 1);
    await tick(500);
    expectActive(root, 2);
    await tick(500);
    expectActive(root, 0);
  });

  it('mouseenter pauses rotation; mouseleave resumes', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3 });
    await init(root);
    await dispatchCarouselEvent(root, new MouseEvent('mouseover', { bubbles: true }));
    await tick(2000);
    expectActive(root, 0);
    await dispatchCarouselEvent(root, new MouseEvent('mouseout', { bubbles: true }));
    await tick(500);
    expectActive(root, 1);
  });

  it('can disable hover pause for source carousels', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3, pauseHover: false });
    await init(root);
    await dispatchCarouselEvent(root, new MouseEvent('mouseover', { bubbles: true }));
    await tick(500);
    expectActive(root, 1);
  });

  it('manual interaction can pause future auto rotation', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3, manualPause: true });
    await init(root);
    await click(root, '[data-slide-next]');
    expectActive(root, 1);
    await tick(2000);
    expectActive(root, 1);
  });

  it('next button advances and updates aria-current on dot', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 3 });
    await init(root);
    await click(root, '[data-slide-next]');
    expect(dots(root)[1].getAttribute('aria-current')).toBe('true');
    expect(dots(root)[0].hasAttribute('aria-current')).toBe(false);
  });

  it('prev button wraps from first to last slide', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 3 });
    await init(root);
    await click(root, '[data-slide-prev]');
    expectActive(root, 2);
  });

  it('dot click jumps to that slide', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 4 });
    await init(root);
    await act(async () => {
      dots(root)[2].click();
    });
    expectActive(root, 2);
  });

  it('arrow keys navigate when slideshow is focused', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 3 });
    await init(root);
    await dispatchCarouselEvent(root, new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expectActive(root, 1);
    await dispatchCarouselEvent(root, new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expectActive(root, 0);
  });

  it('reduced-motion disables auto-rotation', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3, reducedMotion: true });
    await init(root);
    await tick(5000);
    // No rotation despite many ticks
    expectActive(root, 0);
  });

  it('cleanup on astro:before-swap clears interval', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3 });
    await init(root);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    await act(async () => {
      document.dispatchEvent(new Event('astro:before-swap'));
    });
    expect(root.dataset.hydrated).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stays hydrated after page-render announces content rendered', async () => {
    const root = buildSlideshowDOM({ autoMs: 500, slides: 3 });
    await init(root);
    await act(async () => {
      document.dispatchEvent(new CustomEvent('wl-content-rendered'));
    });
    expect(root.dataset.hydrated).toBe('true');
    await tick(500);
    expectActive(root, 1);
  });

  it('updates the aria-live region on slide change', async () => {
    const root = buildSlideshowDOM({ autoMs: 0, slides: 2 });
    await init(root);
    await click(root, '[data-slide-next]');
    const live = root.querySelector('[data-slideshow-live]') as HTMLElement;
    expect(live.textContent).toContain('Cap 2');
  });
});
