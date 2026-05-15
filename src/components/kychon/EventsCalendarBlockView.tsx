import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Card, CardContent } from '@/components/kychon/ui';

export interface EventsCalendarShellProps {
  configJson: string;
  editableHeadingPath?: string;
  heading?: string;
}

function EventsCalendarShell({ configJson, editableHeadingPath, heading }: EventsCalendarShellProps) {
  return (
    <div className="ky-container" data-block-hydrate="events_calendar" data-config={configJson}>
      {heading ? (
        <h2 className="mb-4 text-2xl font-semibold tracking-normal" data-editable={editableHeadingPath} data-events-calendar-heading>
          {heading}
        </h2>
      ) : null}
      <div aria-label="Loading events" className="grid min-h-32 grid-cols-1 gap-2 sm:grid-cols-2" data-events-calendar-skeleton>
        {Array.from({ length: 4 }, (_, index) => (
          <Card className="shadow-none" data-events-calendar-skeleton-card key={index}>
            <CardContent className="h-24 animate-pulse rounded-md bg-muted p-0" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function renderEventsCalendarShellHtml(props: EventsCalendarShellProps): string {
  return renderToStaticMarkup(<EventsCalendarShell {...props} />);
}
