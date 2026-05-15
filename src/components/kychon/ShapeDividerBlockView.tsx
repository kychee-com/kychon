import type { CSSProperties } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Card, CardContent } from '@/components/kychon/ui';

export interface ShapeDividerRenderLayer {
  d: string;
  fill: string;
  index: number;
  opacity?: number;
  transform?: string;
}

export interface ShapeDividerRenderProps {
  bottomColor: string;
  height: string;
  invalid: boolean;
  layers: ShapeDividerRenderLayer[];
  placement: string;
  topColor: string;
  transform?: string;
  viewBox: string;
}

function ShapeDividerInvalid() {
  return (
    <Card className="mx-auto max-w-2xl border-dashed border-destructive text-destructive shadow-none" data-shape-invalid>
      <CardContent className="py-4 text-sm font-medium">Invalid shape divider path</CardContent>
    </Card>
  );
}

function ShapeDividerBlock({
  bottomColor,
  height,
  invalid,
  layers,
  placement,
  topColor,
  transform,
  viewBox,
}: ShapeDividerRenderProps) {
  if (invalid) return <ShapeDividerInvalid />;

  const style = {
    '--shape-bottom-color': bottomColor,
    '--shape-height': height,
    '--shape-top-color': topColor,
    ...(transform ? { '--shape-transform': transform } : {}),
    background:
      'linear-gradient(to bottom, var(--shape-top-color,var(--color-bg)) 0 50%, var(--shape-bottom-color,var(--color-primary)) 50% 100%)',
    color: 'var(--shape-bottom-color,var(--color-primary))',
    height: 'var(--shape-height,96px)',
    lineHeight: 0,
    width: '100%',
  } as CSSProperties;

  return (
    <div
      className="w-full"
      data-bottom-color={bottomColor}
      data-shape-divider
      data-shape-placement={placement}
      data-top-color={topColor}
      style={style}
    >
      <svg
        aria-hidden="true"
        className="block h-full w-full"
        data-shape-svg
        preserveAspectRatio="none"
        style={{ transform: 'var(--shape-transform,none)' }}
        viewBox={viewBox}
      >
        {layers.map((layer) => (
          <path
            d={layer.d}
            data-shape-layer={layer.index}
            data-shape-path
            fill={layer.fill}
            key={layer.index}
            opacity={layer.opacity}
            transform={layer.transform}
          />
        ))}
      </svg>
    </div>
  );
}

export function renderShapeDividerBlockHtml(props: ShapeDividerRenderProps): string {
  return renderToStaticMarkup(<ShapeDividerBlock {...props} />);
}
