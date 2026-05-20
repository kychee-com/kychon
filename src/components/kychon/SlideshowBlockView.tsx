import type { CSSProperties } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button, Card, CardContent } from '@/components/kychon/ui';
import { KychonImage, type AssetManifest } from '@/lib/kychon-image';
import { cn } from '@/lib/ui/cn';
import { constrainedContainerClass } from '@/lib/ui/container';

export interface SlideshowRenderItem {
  alt: string;
  avifSrc?: string;
  caption?: string;
  fit: 'cover' | 'contain';
  fetchPriority?: 'high' | 'low' | 'auto';
  href?: string;
  loading: 'eager' | 'lazy';
  objectPosition: string;
  src: string;
  webpSrc?: string;
}

export interface SlideshowRenderProps {
  ariaLabel: string;
  autoMs: number;
  editableHeadingPath?: string;
  fit: 'cover' | 'contain';
  heading?: string;
  items: SlideshowRenderItem[];
  manualPause: boolean;
  pauseFocus: boolean;
  pauseHover: boolean;
  rootStyle: Record<string, string>;
  showArrows: boolean;
  showDots: boolean;
  showEmptyPlaceholder: boolean;
  transition: 'fade' | 'slide';
  /** @run402/astro@0.2 manifest — per-slide variant lookup at render time. */
  manifest?: AssetManifest | null;
}

export type SlideshowCarouselProps = Pick<
  SlideshowRenderProps,
  | 'ariaLabel'
  | 'autoMs'
  | 'fit'
  | 'items'
  | 'manifest'
  | 'manualPause'
  | 'pauseFocus'
  | 'pauseHover'
  | 'rootStyle'
  | 'showArrows'
  | 'showDots'
  | 'transition'
>;

const arrowButtonClass =
  'absolute top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border-0 bg-[var(--slideshow-arrow-bg,rgba(0,0,0,0.55))] p-0 text-[var(--slideshow-arrow-color,#fff)] shadow-sm hover:bg-[var(--slideshow-arrow-hover-bg,rgba(0,0,0,0.75))] hover:text-[var(--slideshow-arrow-hover-color,var(--slideshow-arrow-color,#fff))] focus-visible:ring-ring';

function SlideshowHeading({ editableHeadingPath, heading }: Pick<SlideshowRenderProps, 'editableHeadingPath' | 'heading'>) {
  if (!heading) return null;
  return (
    <h2
      className="mb-3 text-2xl font-semibold tracking-normal"
      data-editable={editableHeadingPath}
      data-slideshow-heading
    >
      {heading}
    </h2>
  );
}

function SlideImage({ item, manifest }: { item: SlideshowRenderItem; manifest: AssetManifest | null | undefined }) {
  if (!item.src) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-muted px-4 text-center text-sm text-muted-foreground"
        data-slideshow-missing-image
      >
        {item.alt || 'Slide image'}
      </div>
    );
  }

  // Manifest hit → KychonImage emits `<picture>` with the v1.49 3-width
  // WebP ladder. The legacy avifSrc/webpSrc pathway is kept as a fallback
  // for slides where the seed pre-baked single-URL variant sources.
  const objectStyle = { objectFit: item.fit, objectPosition: item.objectPosition };
  if (manifest) {
    return (
      <KychonImage
        alt={item.alt}
        className="block h-full w-full"
        loading={item.loading}
        manifest={manifest}
        priority={item.fetchPriority === 'high'}
        sizes="100vw"
        url={item.src}
      />
    );
  }

  const image = (
    <img
      alt={item.alt}
      className="block h-full w-full"
      fetchPriority={item.fetchPriority}
      loading={item.loading}
      src={item.src}
      style={objectStyle}
    />
  );

  if (!item.avifSrc && !item.webpSrc) return image;

  return (
    <picture className="block h-full w-full">
      {item.avifSrc ? <source srcSet={item.avifSrc} type="image/avif" /> : null}
      {item.webpSrc ? <source srcSet={item.webpSrc} type="image/webp" /> : null}
      {image}
    </picture>
  );
}

function SlideshowSlide({
  active,
  index,
  item,
  manifest,
  total,
  transition,
}: {
  active: boolean;
  index: number;
  item: SlideshowRenderItem;
  manifest: AssetManifest | null | undefined;
  total: number;
  transition: SlideshowRenderProps['transition'];
}) {
  const image = <SlideImage item={item} manifest={manifest} />;
  const linked = item.href ? (
    <a className="block h-full w-full" href={item.href}>
      {image}
    </a>
  ) : (
    image
  );

  return (
    <figure
      aria-label={`${index + 1} of ${total}`}
      aria-roledescription="slide"
      className={cn(
        'pointer-events-none absolute inset-0 m-0 flex items-center justify-center opacity-0 transition-opacity duration-[var(--slideshow-transition-ms)] ease-[var(--slideshow-transition-easing)] motion-reduce:transform-none motion-reduce:transition-none data-[active=true]:pointer-events-auto data-[active=true]:opacity-100',
        transition === 'slide' &&
          'translate-x-5 transition-[opacity,transform] data-[active=true]:translate-x-0',
      )}
      data-active={active ? 'true' : 'false'}
      data-slide-index={index}
      data-slideshow-slide
      role="group"
    >
      {linked}
      {item.caption ? (
        <figcaption
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 py-3 text-sm text-white"
          data-slideshow-caption
        >
          {item.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function SlideshowDots({
  activeIndex,
  items,
  onSelect,
  showDots,
}: Pick<SlideshowRenderProps, 'items' | 'showDots'> & {
  activeIndex: number;
  onSelect?: (index: number) => void;
}) {
  if (!showDots) return null;
  return (
    <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5" data-slideshow-dots role="tablist">
      {items.map((_, index) => {
        const active = index === activeIndex;
        return (
          <Button
            aria-current={active ? 'true' : undefined}
            aria-label={`Slide ${index + 1} of ${items.length}`}
            className="h-2.5 w-2.5 rounded-full border border-white/85 bg-[var(--slideshow-dot-bg,rgba(255,255,255,0.45))] p-0 data-[active=true]:bg-[var(--slideshow-dot-active-bg,#fff)]"
            data-active={active ? 'true' : 'false'}
            data-slide-go={index}
            data-slideshow-dot
            key={`dot-${index}`}
            onClick={() => onSelect?.(index)}
            size="icon"
            type="button"
            variant="ghost"
          />
        );
      })}
    </div>
  );
}

function SlideshowArrows({
  onNext,
  onPrevious,
  showArrows,
}: Pick<SlideshowRenderProps, 'showArrows'> & {
  onNext?: () => void;
  onPrevious?: () => void;
}) {
  if (!showArrows) return null;
  return (
    <>
      <Button
        aria-label="Previous slide"
        className={cn(arrowButtonClass, 'left-2')}
        data-slide-prev
        onClick={onPrevious}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ChevronLeft aria-hidden="true" className="h-5 w-5" />
      </Button>
      <Button
        aria-label="Next slide"
        className={cn(arrowButtonClass, 'right-2')}
        data-slide-next
        onClick={onNext}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ChevronRight aria-hidden="true" className="h-5 w-5" />
      </Button>
    </>
  );
}

function normalizeSlideIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

function slideAnnouncement(items: SlideshowRenderItem[], index: number): string {
  const item = items[index];
  return item?.caption?.trim() || `Slide ${index + 1} of ${items.length}`;
}

export function SlideshowCarousel({
  ariaLabel,
  autoMs,
  fit,
  items,
  manifest,
  manualPause,
  pauseFocus,
  pauseHover,
  rootStyle,
  showArrows,
  showDots,
  transition,
}: SlideshowCarouselProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [liveText, setLiveText] = React.useState('');
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [paused, setPaused] = React.useState({ hover: false, focus: false, hidden: false, manual: false });
  const total = items.length;

  const setPausedFlag = React.useCallback((flag: keyof typeof paused, value: boolean) => {
    setPaused((current) => current[flag] === value ? current : { ...current, [flag]: value });
  }, []);

  const announce = React.useCallback((index: number) => {
    setLiveText(slideAnnouncement(items, index));
  }, [items]);

  const activate = React.useCallback((rawIndex: number, options: { announce: boolean; manual: boolean }) => {
    const next = normalizeSlideIndex(rawIndex, total);
    setActiveIndex(next);
    if (options.announce) announce(next);
    if (options.manual && manualPause) setPausedFlag('manual', true);
  }, [announce, manualPause, setPausedFlag, total]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync);
      return () => media.removeEventListener('change', sync);
    }
    const legacyMedia = media as unknown as {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    legacyMedia.addListener?.(sync);
    return () => legacyMedia.removeListener?.(sync);
  }, []);

  React.useEffect(() => {
    const syncVisibility = () => setPausedFlag('hidden', document.visibilityState !== 'visible');
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, [setPausedFlag]);

  React.useEffect(() => {
    if (reducedMotion || autoMs <= 0 || total <= 1) return;
    if (paused.hover || paused.focus || paused.hidden || paused.manual) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = normalizeSlideIndex(current + 1, total);
        announce(next);
        return next;
      });
    }, autoMs);
    return () => window.clearInterval(interval);
  }, [announce, autoMs, paused.focus, paused.hidden, paused.hover, paused.manual, reducedMotion, total]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      activate(activeIndex + 1, { announce: true, manual: true });
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      activate(activeIndex - 1, { announce: true, manual: true });
    }
  }, [activate, activeIndex]);

  const handleBlur = React.useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (!pauseFocus) return;
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setPausedFlag('focus', false);
    }
  }, [pauseFocus, setPausedFlag]);

  return (
    <div
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      className="relative aspect-[var(--aspect)] h-[var(--slideshow-mobile-height,var(--slideshow-height,auto))] overflow-hidden rounded-md bg-card outline-none md:h-[var(--slideshow-height,auto)]"
      data-auto-ms={autoMs}
      data-fit={fit}
      data-manual-pause={manualPause ? 'true' : 'false'}
      data-pause-focus={pauseFocus ? 'true' : 'false'}
      data-pause-hover={pauseHover ? 'true' : 'false'}
      data-slideshow
      data-transition={transition}
      onBlurCapture={handleBlur}
      onFocusCapture={pauseFocus ? () => setPausedFlag('focus', true) : undefined}
      onKeyDown={handleKeyDown}
      onMouseEnter={pauseHover ? () => setPausedFlag('hover', true) : undefined}
      onMouseLeave={pauseHover ? () => setPausedFlag('hover', false) : undefined}
      role="region"
      style={rootStyle as CSSProperties}
      tabIndex={0}
    >
      <div className="relative h-full w-full" data-slideshow-track>
        {items.map((item, index) => (
          <SlideshowSlide
            active={index === activeIndex}
            index={index}
            item={item}
            key={`${item.src}-${index}`}
            manifest={manifest}
            total={items.length}
            transition={transition}
          />
        ))}
      </div>
      <SlideshowArrows
        onNext={() => activate(activeIndex + 1, { announce: true, manual: true })}
        onPrevious={() => activate(activeIndex - 1, { announce: true, manual: true })}
        showArrows={showArrows}
      />
      <SlideshowDots
        activeIndex={activeIndex}
        items={items}
        onSelect={(index) => activate(index, { announce: true, manual: true })}
        showDots={showDots}
      />
      <div aria-live="polite" className="sr-only" data-slideshow-live>
        {liveText}
      </div>
    </div>
  );
}

function SlideshowBlock({
  ariaLabel,
  autoMs,
  editableHeadingPath,
  fit,
  heading,
  items,
  manifest,
  manualPause,
  pauseFocus,
  pauseHover,
  rootStyle,
  showArrows,
  showDots,
  showEmptyPlaceholder,
  transition,
}: SlideshowRenderProps) {
  if (items.length === 0) {
    return (
      <div className={constrainedContainerClass} data-layout-container>
        <SlideshowHeading editableHeadingPath={editableHeadingPath} heading={heading} />
        {showEmptyPlaceholder ? (
          <Card className="border-dashed shadow-none" data-slideshow-empty>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No slides yet - add some via the editor.
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  // Manifest is intentionally NOT serialized into `data-slideshow-props` —
  // the client-side hydrator (`src/lib/blocks/slideshow.ts:readSlideshowProps`)
  // pulls it from `window.__KYCHON_ASSET_MANIFEST` instead, so we don't bloat
  // the per-slideshow JSON payload with the full manifest object.
  const carouselProps: SlideshowCarouselProps = {
    ariaLabel,
    autoMs,
    fit,
    items,
    manifest,
    manualPause,
    pauseFocus,
    pauseHover,
    rootStyle,
    showArrows,
    showDots,
    transition,
  };
  const serializedCarouselProps = { ...carouselProps, manifest: undefined };

  return (
    <div className={constrainedContainerClass} data-layout-container>
      <SlideshowHeading editableHeadingPath={editableHeadingPath} heading={heading} />
      <Card className="overflow-hidden p-0 shadow-none" data-slideshow-card>
        <CardContent className="p-0">
          <div data-block-hydrate="slideshow" data-slideshow-props={JSON.stringify(serializedCarouselProps)}>
            <SlideshowCarousel {...carouselProps} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function renderSlideshowBlockHtml(props: SlideshowRenderProps): string {
  return renderToStaticMarkup(<SlideshowBlock {...props} />);
}
