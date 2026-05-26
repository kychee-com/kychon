'use client';

import { CalendarDays, ImageIcon, Loader2, Lock, MapPin, Plus, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@/components/kychon/ui';
import { getEvents, post } from '@/lib/api';
import { isAdmin } from '@/lib/auth';
import { ready, siteConfig, translateItems } from '@/lib/config';
import { formatEventDateTime } from '@/lib/event-display';
import { getGlobalManifest, lookupAssetRef } from '@/lib/kychon-image';
import { Run402Image } from '@/lib/run402-image-react';
import { showToast } from '@/lib/toast-events';
import type { Event } from '@/schemas/event';

interface EventFormState {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  capacity: string;
  isMembersOnly: boolean;
}

const EMPTY_FORM: EventFormState = {
  title: '',
  description: '',
  location: '',
  startsAt: '',
  endsAt: '',
  capacity: '0',
  isMembersOnly: false,
};

function normalizeDateTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  if (Number.isNaN(Date.parse(normalized))) throw new Error('Use a valid date and time.');
  return normalized;
}

function EventImage({ event }: { event: Event }) {
  if (!event.image_url) {
    return (
      <div className="flex aspect-[16/7] items-center justify-center bg-muted text-muted-foreground">
        <ImageIcon className="h-8 w-8" />
      </div>
    );
  }

  // Manifest hit → `<Run402Image>` (variant ladder + v1.54 pre-decoded
  // placeholder); miss → plain `<img>` against the original URL (admin
  // uploads not yet covered by the build-time assetsDir walk).
  //
  // Class/style split (per the rev-4 spec): `<Run402Image>` forwards
  // `className` to the outermost element (the `<picture>` wrapper) and
  // `style` always to the inner `<img>`. So we put the aspect-ratio +
  // width box on the `<picture>` (`block` because `<picture>` is
  // `display: inline` by default — `w-full` is a no-op on inline), and
  // the cover-crop fitting on the `<img>` via `style`. Without the
  // `display: block` + `objectFit: cover` split, source images (e.g.
  // 1024×1024 squares) get stretched into the 16:7 box.
  //
  // `loading="eager"` (not the component default `lazy`) because this
  // grid is fully React-hydrated: the skeleton renders first, then
  // `loadEvents()` resolves and React injects the `<picture>` nodes
  // post-hydration. Chrome's native lazy-loading observer doesn't
  // re-evaluate those late-inserted in-viewport imgs, leaving them
  // stuck on the blurhash placeholder. Eager loading bypasses the
  // observer entirely; bandwidth cost is small because the variant
  // ladder picks the appropriate width.
  const asset = lookupAssetRef(event.image_url, getGlobalManifest());
  if (asset) {
    return (
      <Run402Image
        asset={asset}
        alt=""
        className="block aspect-[16/7] w-full"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        loading="eager"
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      />
    );
  }

  return <img alt="" className="aspect-[16/7] w-full object-cover" height={180} src={event.image_url} width={480} />;
}

function EventCard({ event }: { event: Event }) {
  const dateTime = formatEventDateTime(event, undefined, siteConfig, { dateStyle: 'card' });

  return (
    <Card className="h-full overflow-hidden transition-colors hover:bg-accent/50" data-event-card={event.id}>
      <a className="block h-full text-foreground no-underline" href={`/event?id=${event.id}`}>
        <EventImage event={event} />
        <CardHeader>
          <CardTitle className="break-words text-lg leading-6">{event.title}</CardTitle>
          <CardDescription className="space-y-2">
            <span className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{dateTime.dateTimeLabel}</span>
            </span>
            {event.location ? (
              <span className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{event.location}</span>
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-2">
          {event.is_members_only ? (
            <Badge>
              <Lock className="mr-1 h-3 w-3" />
              Members only
            </Badge>
          ) : null}
          {event.capacity ? (
            <Badge variant="secondary">
              <Users className="mr-1 h-3 w-3" />
              {event.capacity} spots
            </Badge>
          ) : null}
        </CardFooter>
      </a>
    </Card>
  );
}

function EventSection({ title, tone, events }: { title: string; tone?: 'muted'; events: Event[] }) {
  if (events.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className={tone === 'muted' ? 'text-lg font-semibold text-muted-foreground' : 'text-lg font-semibold'}>{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-events-list={title.toLowerCase().replace(/\s+/g, '-')}>
        {events.map((event) => (
          <EventCard event={event} key={event.id} />
        ))}
      </div>
    </section>
  );
}

function CreateEventDialog({
  open,
  creating,
  form,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  creating: boolean;
  form: EventFormState;
  onFormChange: (form: EventFormState) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>Add a calendar event for members and visitors.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              onChange={(event) => onFormChange({ ...form, title: event.target.value })}
              required
              value={form.title}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              onChange={(event) => onFormChange({ ...form, description: event.target.value })}
              value={form.description}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-location">Location</Label>
            <Input id="event-location" onChange={(event) => onFormChange({ ...form, location: event.target.value })} value={form.location} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-starts-at">Starts</Label>
              <Input
                id="event-starts-at"
                onChange={(event) => onFormChange({ ...form, startsAt: event.target.value })}
                placeholder="2026-06-30 18:00"
                required
                value={form.startsAt}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-ends-at">Ends</Label>
              <Input
                id="event-ends-at"
                onChange={(event) => onFormChange({ ...form, endsAt: event.target.value })}
                placeholder="2026-06-30 20:00"
                value={form.endsAt}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-capacity">Capacity</Label>
              <Input
                id="event-capacity"
                min="0"
                onChange={(event) => onFormChange({ ...form, capacity: event.target.value })}
                type="number"
                value={form.capacity}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium" id="event-members-only-label">
                Members only
              </div>
              <Button
                aria-labelledby="event-members-only-label"
                aria-pressed={form.isMembersOnly}
                className="w-full justify-start"
                onClick={() => onFormChange({ ...form, isMembersOnly: !form.isMembersOnly })}
                type="button"
                variant={form.isMembersOnly ? 'secondary' : 'outline'}
              >
                <Lock className="h-4 w-4" />
                Members only
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={creating} onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={creating} onClick={onSubmit} type="button">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EventsPageAppProps {
  /**
   * Pre-fetched events from the build-time SSR pass — `events.astro`
   * awaits `ensureBuildEventsLoaded()` and forwards `getAllBuildEvents()`
   * here. When present, React's initial render uses these for the
   * upcoming/past split so the SSR HTML already has real `<EventCard>`
   * tiles (no skeleton). The runtime `loadEvents()` still runs to:
   *   - apply the current visitor's locale via `translateItems`
   *   - pull in member-only events visible only after sign-in
   *   - catch admin edits made between build and visit
   * RLS-gates the build-time fetch to public rows, so signed-in members
   * see the extra member-only events appear in the post-hydrate refresh.
   */
  initialEvents?: Event[];
}

export default function EventsPageApp({ initialEvents }: EventsPageAppProps = {}) {
  const [events, setEvents] = useState<Event[]>(() => initialEvents ?? []);
  const [admin, setAdmin] = useState(false);
  // Skip the skeleton when we hydrate from SSR-baked events — first
  // render already shows real cards, the post-mount fetch refreshes.
  const [loading, setLoading] = useState(() => !initialEvents);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM);

  const loadEvents = useCallback(async () => {
    // Background refresh path. Avoid the skeleton flash when we already
    // have SSR-baked events on screen — set `loading=true` only on the
    // first ever fetch (when state is empty), so subsequent refreshes
    // (locale change, auth change) update in place.
    setError('');
    try {
      await ready;
      setAdmin(isAdmin());
      const rows = await getEvents('order=starts_at.asc');
      const translated = await translateItems('event', rows, ['title', 'description']);
      setEvents(translated as Event[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
    document.addEventListener('wl-auth-changed', loadEvents);
    document.addEventListener('wl-locale-changed', loadEvents);
    return () => {
      document.removeEventListener('wl-auth-changed', loadEvents);
      document.removeEventListener('wl-locale-changed', loadEvents);
    };
  }, [loadEvents]);

  const { upcoming, past } = useMemo(() => {
    const now = new Date().toISOString();
    return {
      upcoming: events.filter((event) => event.starts_at >= now),
      past: events.filter((event) => event.starts_at < now).reverse(),
    };
  }, [events]);

  async function submitCreate() {
    if (!form.title.trim()) {
      showToast('Event title is required.', 'warning');
      return;
    }

    let startsAt: string | null;
    let endsAt: string | null;
    try {
      startsAt = normalizeDateTime(form.startsAt);
      endsAt = normalizeDateTime(form.endsAt);
    } catch (dateError) {
      showToast(dateError instanceof Error ? dateError.message : 'Use a valid date and time.', 'warning');
      return;
    }

    if (!startsAt) {
      showToast('Start date and time is required.', 'warning');
      return;
    }

    const capacity = Number(form.capacity);
    setCreating(true);
    try {
      await post('events', {
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        starts_at: startsAt,
        ends_at: endsAt,
        capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
        is_members_only: form.isMembersOnly,
      });
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      showToast('Event created', 'success');
      await loadEvents();
    } catch (createError) {
      showToast(createError instanceof Error ? createError.message : 'Failed to create event.', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6" data-events-page>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Events</h2>
          <p className="text-sm text-muted-foreground">Browse upcoming and past club events.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild size="sm" type="button" variant="secondary">
            <a href="/calendar">View as calendar</a>
          </Button>
          {admin ? (
            <Button onClick={() => setCreateOpen(true)} size="sm" type="button">
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status">
          {[0, 1, 2].map((item) => (
            <Card key={item}>
              <div className="aspect-[16/7] bg-muted" />
              <CardHeader>
                <div className="h-5 w-3/4 rounded-md bg-muted" />
                <div className="h-4 w-1/2 rounded-md bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No events yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <EventSection events={upcoming} title="Upcoming" />
          <EventSection events={past} title="Past Events" tone="muted" />
        </div>
      )}

      <CreateEventDialog
        creating={creating}
        form={form}
        onFormChange={setForm}
        onOpenChange={setCreateOpen}
        onSubmit={submitCreate}
        open={createOpen}
      />
    </div>
  );
}
