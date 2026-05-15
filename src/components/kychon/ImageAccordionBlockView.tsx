import type { CSSProperties } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Badge, Card, CardContent } from '@/components/kychon/ui';
import { cn } from '@/lib/ui/cn';
import { constrainedContainerClass } from '@/lib/ui/container';

export interface ImageAccordionRenderPanel {
  ctaEditablePath?: string;
  ctaLabel?: string;
  description?: string;
  descriptionEditablePath?: string;
  href?: string;
  imageAlt: string;
  imageEditablePath?: string;
  imageUrl?: string;
  objectFit: 'cover' | 'contain';
  objectPosition: string;
  panelStyle: Record<string, string>;
  title?: string;
  titleEditablePath?: string;
}

export interface ImageAccordionRenderProps {
  editableHeadingPath?: string;
  heading?: string;
  mobileFallback: 'stack' | 'cards';
  panels: ImageAccordionRenderPanel[];
  rootStyle: Record<string, string>;
  showEmptyPlaceholder: boolean;
}

const panelClass = cn(
  'group relative block min-w-0 overflow-hidden rounded-md bg-card text-white no-underline outline-none',
  'transition-[flex,transform,color] duration-[var(--accordion-reveal-duration,260ms)] ease-[var(--interaction-easing,ease)]',
  'hover:text-[var(--accordion-panel-hover-color)] focus:text-[var(--accordion-panel-hover-color)] focus-within:text-[var(--accordion-panel-hover-color)]',
  'focus-visible:ring-[3px] focus-visible:ring-[var(--accordion-panel-focus-color)] focus-visible:ring-offset-[3px]',
  'md:flex-[var(--accordion-idle,1)_1_0] md:hover:flex-[var(--accordion-active,2.5)_1_0] md:focus:flex-[var(--accordion-active,2.5)_1_0] md:focus-within:flex-[var(--accordion-active,2.5)_1_0]',
  'max-md:min-h-64 max-md:flex-none',
);

function ImageAccordionHeading({ editableHeadingPath, heading }: Pick<ImageAccordionRenderProps, 'editableHeadingPath' | 'heading'>) {
  if (!heading) return null;
  return (
    <h2 className="mb-4 text-2xl font-semibold tracking-normal" data-editable={editableHeadingPath} data-accordion-heading>
      {heading}
    </h2>
  );
}

function PanelImage({ panel, index }: { index: number; panel: ImageAccordionRenderPanel }) {
  if (!panel.imageUrl) {
    return (
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary to-accent"
        data-editable-image={panel.imageEditablePath}
        data-accordion-placeholder
      />
    );
  }

  return (
    <img
      alt={panel.imageAlt}
      className="absolute inset-0 block h-full w-full"
      data-editable-image={panel.imageEditablePath}
      data-accordion-image
      loading={index === 0 ? 'eager' : 'lazy'}
      src={panel.imageUrl}
      style={{ objectFit: panel.objectFit, objectPosition: panel.objectPosition }}
    />
  );
}

function PanelBody({ index, panel }: { index: number; panel: ImageAccordionRenderPanel }) {
  return (
    <Card className="relative h-full min-h-[22rem] overflow-hidden border-0 bg-card shadow-none max-md:min-h-64" data-accordion-card>
      <CardContent className="p-0">
        <PanelImage index={index} panel={panel} />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[var(--accordion-overlay-color,rgba(0,0,0,0.55))] opacity-[var(--accordion-overlay-opacity,1)]"
          data-accordion-overlay
        />
        <span
          className={cn(
            'absolute inset-x-0 bottom-0 z-10 grid translate-y-5 gap-2 p-5 opacity-0',
            'transition-[opacity,transform] duration-[var(--accordion-reveal-duration,260ms)] ease-[var(--interaction-easing,ease)]',
            'group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100',
            'max-md:translate-y-0 max-md:opacity-100',
          )}
          data-accordion-content
        >
          <span
            className="text-[clamp(1.1rem,2vw,1.6rem)] font-extrabold leading-tight"
            data-editable={panel.titleEditablePath}
            data-accordion-title
          >
            {panel.title || ''}
          </span>
          {panel.description ? (
            <p className="m-0 max-w-md" data-editable={panel.descriptionEditablePath} data-accordion-description>
              {panel.description}
            </p>
          ) : null}
          {panel.ctaLabel ? (
            <Badge
              className="w-fit border-current bg-transparent px-2 py-1 text-[0.8125rem] font-extrabold uppercase text-current"
              data-editable={panel.ctaEditablePath}
              data-accordion-cta
              variant="outline"
            >
              {panel.ctaLabel}
            </Badge>
          ) : null}
        </span>
      </CardContent>
    </Card>
  );
}

function ImageAccordionPanel({ index, panel }: { index: number; panel: ImageAccordionRenderPanel }) {
  const style = panel.panelStyle as CSSProperties;

  if (panel.href) {
    return (
      <a className={panelClass} data-accordion-item data-accordion-panel={index} href={panel.href} style={style}>
        <PanelBody index={index} panel={panel} />
      </a>
    );
  }

  return (
    <div
      aria-label={panel.title || `Panel ${index + 1}`}
      className={panelClass}
      data-accordion-item
      data-accordion-panel={index}
      role="group"
      style={style}
      tabIndex={0}
    >
      <PanelBody index={index} panel={panel} />
    </div>
  );
}

function ImageAccordionBlock({
  editableHeadingPath,
  heading,
  mobileFallback,
  panels,
  rootStyle,
  showEmptyPlaceholder,
}: ImageAccordionRenderProps) {
  return (
    <div className={constrainedContainerClass} data-accordion-content-root data-layout-container>
      <ImageAccordionHeading editableHeadingPath={editableHeadingPath} heading={heading} />
      <div
        className="flex min-h-[22rem] gap-2 max-md:min-h-0 max-md:flex-col"
        data-accordion
        data-mobile-fallback={mobileFallback}
        style={rootStyle as CSSProperties}
      >
        {panels.map((panel, index) => (
          <ImageAccordionPanel index={index} key={`${panel.title || 'panel'}-${index}`} panel={panel} />
        ))}
        {showEmptyPlaceholder && panels.length === 0 ? (
          <Card className="w-full border-dashed shadow-none" data-accordion-empty>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No accordion panels yet - add panels via the editor.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

export function renderImageAccordionBlockHtml(props: ImageAccordionRenderProps): string {
  return renderToStaticMarkup(<ImageAccordionBlock {...props} />);
}
