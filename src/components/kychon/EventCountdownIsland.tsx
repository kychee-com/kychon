import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CalendarDays } from 'lucide-react';

import { Card, CardContent } from '@/components/kychon/ui';
import { get } from '@/lib/api';

interface EventCountdownConfig {
  heading?: string;
}

interface EventCountdownProps {
  config: EventCountdownConfig;
  headingEditablePath?: string;
}

interface EventRow {
  id?: number | string | null;
  starts_at?: string | null;
  title?: string | null;
}

type CountdownState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; event: EventRow; startsAt: number };

const roots = new WeakMap<HTMLElement, Root>();

function countdownParts(startsAt: number): { days: number; hours: number; minutes: number } {
  const diff = Math.max(0, startsAt - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
  };
}

function EventCountdownIsland({ config, headingEditablePath }: EventCountdownProps) {
  const [state, setState] = React.useState<CountdownState>({ status: 'loading' });
  const [tick, setTick] = React.useState(0);
  const heading = String(config.heading || '').trim();

  React.useEffect(() => {
    let ignore = false;
    async function refresh(): Promise<void> {
      try {
        const events = await get(`events?starts_at=gte.${new Date().toISOString()}&order=starts_at.asc&limit=1`) as EventRow[];
        if (ignore) return;
        const event = events[0];
        const startsAt = event?.starts_at ? new Date(event.starts_at).getTime() : Number.NaN;
        setState(event && Number.isFinite(startsAt) ? { status: 'ready', event, startsAt } : { status: 'empty' });
      } catch (error) {
        console.warn('event_countdown hydrate failed:', error);
        if (!ignore) setState({ status: 'empty' });
      }
    }
    void refresh();
    return () => {
      ignore = true;
    };
  }, []);

  React.useEffect(() => {
    if (state.status !== 'ready') return undefined;
    const interval = window.setInterval(() => setTick((value) => value + 1), 60000);
    return () => window.clearInterval(interval);
  }, [state.status]);

  const parts = state.status === 'ready' ? countdownParts(state.startsAt) : null;
  void tick;

  return (
    <div className="mx-auto max-w-3xl text-center" data-event-countdown>
      {heading && (
        <h2 className="mb-4 text-2xl font-semibold tracking-normal" data-editable={headingEditablePath || undefined}>
          {heading}
        </h2>
      )}
      <Card>
        <CardContent className="p-6 sm:p-8">
          {state.status === 'loading' && (
            <div className="space-y-4" aria-label="Loading next event">
              <div className="mx-auto h-5 w-40 rounded bg-muted" />
              <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
                <div className="h-20 rounded-md bg-muted" />
                <div className="h-20 rounded-md bg-muted" />
                <div className="h-20 rounded-md bg-muted" />
              </div>
            </div>
          )}
          {state.status === 'empty' && (
            <p className="text-sm text-muted-foreground" data-event-countdown-empty>
              No upcoming events.
            </p>
          )}
          {state.status === 'ready' && parts && (
            <div className="space-y-5">
              <p className="text-lg font-semibold text-foreground">{state.event.title || 'Untitled event'}</p>
              <div className="grid grid-cols-3 gap-3" data-event-countdown-digits>
                <CountdownUnit label="Days" value={parts.days} />
                <CountdownUnit label="Hours" value={parts.hours} />
                <CountdownUnit label="Minutes" value={parts.minutes} />
              </div>
              <p className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Starts soon
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CountdownUnit({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-4">
      <div className="text-3xl font-bold leading-none text-primary">{value}</div>
      <div className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

export function mountEventCountdownIsland(
  element: HTMLElement,
  props: {
    config: EventCountdownConfig;
    headingEditablePath?: string;
  },
): void {
  let root = roots.get(element);
  if (!root) {
    root = createRoot(element);
    roots.set(element, root);
  }
  root.render(<EventCountdownIsland {...props} />);
}
