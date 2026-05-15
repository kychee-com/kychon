import type { CSSProperties } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Alert, AlertDescription, AlertTitle, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/kychon/ui';
import { cn } from '@/lib/ui/cn';
import { constrainedContainerClass } from '@/lib/ui/container';

interface EmbedBlockContentProps {
  heading?: string;
  height: string;
  providerId: string;
  responsive: boolean;
  sandbox: string;
  showExternalBadge: boolean;
  src: string;
  title: string;
}

interface EmbedFrameProps {
  height: string;
  responsive: boolean;
  sandbox: string;
  src: string;
  title: string;
}

function EmbedFrame({ height, responsive, sandbox, src, title }: EmbedFrameProps) {
  const iframeStyle: CSSProperties = responsive
    ? { border: 0, height: '100%', width: '100%' }
    : { border: 0, height, width: '100%' };

  return (
    <div
      className={cn('overflow-hidden rounded-md border border-border bg-muted', responsive ? 'aspect-video w-full' : 'w-full')}
      data-embed-frame
      data-embed-responsive={responsive ? 'true' : 'false'}
    >
      <iframe
        allowFullScreen
        className="block"
        loading="lazy"
        sandbox={sandbox}
        src={src}
        style={iframeStyle}
        title={title}
      />
    </div>
  );
}

function EmbedBlockContent({
  heading,
  height,
  providerId,
  responsive,
  sandbox,
  showExternalBadge,
  src,
  title,
}: EmbedBlockContentProps) {
  return (
    <div className={constrainedContainerClass} data-embed-content data-layout-container>
      <Card className="overflow-hidden shadow-none" data-embed-card>
        {heading ? (
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xl tracking-normal" data-embed-heading>
              {heading}
            </CardTitle>
          </CardHeader>
        ) : null}
        <CardContent className={cn('space-y-3', heading ? 'px-4 pb-4 pt-0' : 'p-3')}>
          <EmbedFrame height={height} responsive={responsive} sandbox={sandbox} src={src} title={title} />
          {showExternalBadge ? (
            <Badge
              className="uppercase tracking-wide"
              data-embed-badge
              title="Generic iframe - bypasses provider allowlist"
              variant="secondary"
            >
              External content
            </Badge>
          ) : null}
          <span className="sr-only" data-embed-provider-label>
            {providerId}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

export function renderEmbedBlockContentHtml(props: EmbedBlockContentProps): string {
  return renderToStaticMarkup(<EmbedBlockContent {...props} />);
}

export function renderEmbedErrorContentHtml(message: string): string {
  return renderToStaticMarkup(
    <div className={constrainedContainerClass} data-embed-content data-layout-container>
      <Alert className="border-dashed" data-embed-error role="alert" variant="destructive">
        <AlertTitle>Embed unavailable</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>,
  );
}
