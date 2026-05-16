import * as React from 'react';
import type { AnchorHTMLAttributes, ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Button } from '@/components/kychon/ui';

type DataAttributes = Record<`data-${string}`, string | number | boolean | undefined>;
type StaticAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & DataAttributes;

interface StaticLinkButtonOptions {
  className?: string;
  dataAttrs?: DataAttributes;
  editablePath?: string;
  href: string;
  size?: ComponentProps<typeof Button>['size'];
  text: string;
}

export function renderStaticLinkButtonHtml({
  className,
  dataAttrs = {},
  editablePath,
  href,
  size,
  text,
}: StaticLinkButtonOptions): string {
  const anchorProps: StaticAnchorProps = {
    href,
    ...dataAttrs,
  };
  if (editablePath) anchorProps['data-editable'] = editablePath;

  return renderToStaticMarkup(
    <Button asChild className={className} size={size}>
      <a {...anchorProps}>{text}</a>
    </Button>,
  );
}
