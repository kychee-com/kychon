import type { CSSProperties } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Card, CardContent, buttonVariants } from '@/components/kychon/ui';
import { cn } from '@/lib/ui/cn';

export interface SlideshowRenderItem {
  alt: string;
  avifSrc?: string;
  caption?: string;
  fit: 'cover' | 'contain';
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
}

const arrowButtonClass = buttonVariants({
  className:
    'absolute top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border-0 bg-[var(--slideshow-arrow-bg,rgba(0,0,0,0.55))] p-0 text-[var(--slideshow-arrow-color,#fff)] shadow-sm hover:bg-[var(--slideshow-arrow-hover-bg,rgba(0,0,0,0.75))] hover:text-[var(--slideshow-arrow-hover-color,var(--slideshow-arrow-color,#fff))] focus-visible:ring-ring',
  size: 'icon',
  variant: 'ghost',
});

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

function SlideImage({ item }: { item: SlideshowRenderItem }) {
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

  const image = (
    <img
      alt={item.alt}
      className="block h-full w-full"
      loading={item.loading}
      src={item.src}
      style={{ objectFit: item.fit, objectPosition: item.objectPosition }}
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
  index,
  item,
  total,
  transition,
}: {
  index: number;
  item: SlideshowRenderItem;
  total: number;
  transition: SlideshowRenderProps['transition'];
}) {
  const image = <SlideImage item={item} />;
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
      data-active={index === 0 ? 'true' : 'false'}
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

function SlideshowDots({ items, showDots }: Pick<SlideshowRenderProps, 'items' | 'showDots'>) {
  if (!showDots) return null;
  return (
    <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5" data-slideshow-dots role="tablist">
      {items.map((_, index) => (
        <button
          aria-current={index === 0 ? 'true' : undefined}
          aria-label={`Slide ${index + 1} of ${items.length}`}
          className="h-2.5 w-2.5 rounded-full border border-white/85 bg-[var(--slideshow-dot-bg,rgba(255,255,255,0.45))] p-0 data-[active=true]:bg-[var(--slideshow-dot-active-bg,#fff)]"
          data-active={index === 0 ? 'true' : 'false'}
          data-slide-go={index}
          data-slideshow-dot
          key={`dot-${index}`}
          type="button"
        />
      ))}
    </div>
  );
}

function SlideshowArrows({ showArrows }: Pick<SlideshowRenderProps, 'showArrows'>) {
  if (!showArrows) return null;
  return (
    <>
      <button
        aria-label="Previous slide"
        className={cn(arrowButtonClass, 'left-2')}
        data-slide-prev
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="h-5 w-5" />
      </button>
      <button
        aria-label="Next slide"
        className={cn(arrowButtonClass, 'right-2')}
        data-slide-next
        type="button"
      >
        <ChevronRight aria-hidden="true" className="h-5 w-5" />
      </button>
    </>
  );
}

function SlideshowBlock({
  ariaLabel,
  autoMs,
  editableHeadingPath,
  fit,
  heading,
  items,
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
      <div className="ky-container">
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

  return (
    <div className="ky-container">
      <SlideshowHeading editableHeadingPath={editableHeadingPath} heading={heading} />
      <Card className="overflow-hidden p-0 shadow-none" data-slideshow-card>
        <CardContent className="p-0">
          <div
            aria-label={ariaLabel}
            aria-roledescription="carousel"
            className="relative aspect-[var(--aspect)] h-[var(--slideshow-mobile-height,var(--slideshow-height,auto))] overflow-hidden rounded-md bg-card outline-none md:h-[var(--slideshow-height,auto)]"
            data-auto-ms={autoMs}
            data-block-hydrate="slideshow"
            data-fit={fit}
            data-manual-pause={manualPause ? 'true' : 'false'}
            data-pause-focus={pauseFocus ? 'true' : 'false'}
            data-pause-hover={pauseHover ? 'true' : 'false'}
            data-slideshow
            data-transition={transition}
            role="region"
            style={rootStyle as CSSProperties}
            tabIndex={0}
          >
            <div className="relative h-full w-full" data-slideshow-track>
              {items.map((item, index) => (
                <SlideshowSlide index={index} item={item} key={`${item.src}-${index}`} total={items.length} transition={transition} />
              ))}
            </div>
            <SlideshowArrows showArrows={showArrows} />
            <SlideshowDots items={items} showDots={showDots} />
            <div aria-live="polite" className="sr-only" data-slideshow-live />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function renderSlideshowBlockHtml(props: SlideshowRenderProps): string {
  return renderToStaticMarkup(<SlideshowBlock {...props} />);
}
