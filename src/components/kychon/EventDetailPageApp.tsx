'use client';

import {
  ArrowLeft,
  CalendarDays,
  Check,
  ImageIcon,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
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
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/kychon/ui';
import {
  createEventRegistrationOption,
  del,
  get,
  getEventRegistrationOptions,
  patch,
  post,
  updateEventRegistrationOption,
  updateEventTimezone,
} from '@/lib/api';
import { getSession, isAdmin, isAuthenticated } from '@/lib/auth';
import { ready, siteConfig, translateItems } from '@/lib/config';
import { formatEventDateTime, formatEventDateTimeStable } from '@/lib/event-display';
import { formatEventTags, normalizeEventTags } from '@/lib/event-tags';
import {
  eventTimezonePayload,
  registrationOptionPayload,
} from '@/lib/event-registration';
import {
  type AssetManifest,
  lookupAssetRef,
  rewriteAssetUrlsInHtml,
  useGlobalManifest,
} from '@/lib/kychon-image';
import { Run402Image } from '@/lib/run402-image-react';
import { sanitizeRichHtml } from '@/lib/sanitize-html';
import { useHydrated } from '@/lib/use-event-date-time';
import { RegistrationOptions, RsvpPanel } from '@/components/kychon/EventRegistrationPanels';
import { showToast as showKychonToast, type KychonToastType } from '@/lib/toast-events';
import type { Event, EventRegistrationOption, EventRSVP } from '@/schemas/event';

type EventRSVPWithMember = EventRSVP & {
  members?: {
    avatar_url?: string | null;
    display_name?: string | null;
  } | null;
};

interface RegistrationDraft {
  id: number;
  position: string;
  label: string;
  description: string;
  price_amount: string;
  currency: string;
  raw_price_label: string;
  guest_policy: string;
  capacity: string;
  spaces_left: string;
  availability_status: string;
  cancellation_note: string;
  source_registration_url: string;
  review_state: string;
  is_disabled: boolean;
}

interface TimezoneForm {
  source_timezone: string;
  source_timezone_label: string;
  time_display_mode: 'visitor' | 'source';
  import_review_state: string;
  all_day: boolean;
}

const EMPTY_TIMEZONE_FORM: TimezoneForm = {
  source_timezone: '',
  source_timezone_label: '',
  time_display_mode: 'visitor',
  import_review_state: '',
  all_day: false,
};

const AVAILABILITY_OPTIONS = ['available', 'waitlist', 'full', 'closed', 'unknown'];

function showToast(message: string, type: KychonToastType = 'info') {
  showKychonToast({ message, type });
}

function eventIdFromLocation(): string | null {
  return new URLSearchParams(window.location.search).get('id');
}

function memberIdFromSession(): number | null {
  if (typeof window === 'undefined') return null;
  const id = getSession()?.user?.member?.id;
  const numeric = Number(id);
  return Number.isFinite(numeric) ? numeric : null;
}

function optionToDraft(option: EventRegistrationOption): RegistrationDraft {
  return {
    id: option.id,
    position: String(option.position ?? 0),
    label: option.label || '',
    description: option.description || '',
    price_amount: option.price_amount == null ? '' : String(option.price_amount),
    currency: option.currency || '',
    raw_price_label: option.raw_price_label || '',
    guest_policy: option.guest_policy || '',
    capacity: option.capacity == null ? '' : String(option.capacity),
    spaces_left: option.spaces_left == null ? '' : String(option.spaces_left),
    availability_status: option.availability_status || 'unknown',
    cancellation_note: option.cancellation_note || '',
    source_registration_url: option.source_registration_url || '',
    review_state: option.review_state || 'needs_review',
    is_disabled: option.is_disabled === true,
  };
}

function draftToPayload(draft: RegistrationDraft): Record<string, unknown> {
  return registrationOptionPayload({
    position: draft.position,
    label: draft.label,
    description: draft.description,
    price_amount: draft.price_amount,
    currency: draft.currency,
    raw_price_label: draft.raw_price_label,
    guest_policy: draft.guest_policy,
    capacity: draft.capacity,
    spaces_left: draft.spaces_left,
    availability_status: draft.availability_status,
    cancellation_note: draft.cancellation_note,
    source_registration_url: draft.source_registration_url,
    review_state: draft.review_state === 'reviewed' ? 'reviewed' : 'needs_review',
    is_disabled: draft.is_disabled,
  }) as Record<string, unknown>;
}

function timezoneFormFromEvent(event: Event): TimezoneForm {
  return {
    source_timezone: event.source_timezone || '',
    source_timezone_label: event.source_timezone_label || '',
    time_display_mode: event.time_display_mode === 'source' ? 'source' : 'visitor',
    import_review_state: event.import_review_state || '',
    all_day: event.all_day === true,
  };
}

function attendeeName(rsvp: EventRSVPWithMember): string {
  return rsvp.members?.display_name || 'Member';
}

function Description({
  admin,
  event,
  manifest,
}: {
  admin: boolean;
  event: Event;
  manifest: AssetManifest | null;
}) {
  const html = rewriteAssetUrlsInHtml(sanitizeRichHtml(event.description), manifest);
  if (!html) return null;
  return (
    <div
      className="prose prose-sm max-w-none text-foreground"
      data-editable-rich={admin ? `events.${event.id}.description` : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function Attendees({ rsvps }: { rsvps: EventRSVPWithMember[] }) {
  const attendees = rsvps.filter((rsvp) => rsvp.status === 'going' || rsvp.status === 'maybe');
  if (attendees.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-normal">Attendees</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {attendees.map((rsvp) => (
          <Card key={rsvp.id} className="shadow-none">
            <CardContent className="flex items-center gap-3 p-4">
              {rsvp.members?.avatar_url ? (
                <img alt="" className="h-10 w-10 rounded-full object-cover" height={40} src={rsvp.members.avatar_url} width={40} />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {attendeeName(rsvp).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{attendeeName(rsvp)}</div>
                <Badge variant={rsvp.status === 'going' ? 'default' : 'secondary'}>{rsvp.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function TimezoneEditor({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: TimezoneForm;
  onChange: (form: TimezoneForm) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg tracking-normal">Event Timezone</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="event-source-timezone">Source timezone</Label>
          <Input
            id="event-source-timezone"
            onChange={(event) => onChange({ ...form, source_timezone: event.target.value })}
            placeholder="Australia/Sydney"
            value={form.source_timezone}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-source-timezone-label">Source label</Label>
          <Input
            id="event-source-timezone-label"
            onChange={(event) => onChange({ ...form, source_timezone_label: event.target.value })}
            placeholder="AEST / AEDT"
            value={form.source_timezone_label}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-time-display-mode">Display mode</Label>
          <Select value={form.time_display_mode} onValueChange={(value) => onChange({ ...form, time_display_mode: value === 'source' ? 'source' : 'visitor' })}>
            <SelectTrigger id="event-time-display-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="visitor">Visitor local time</SelectItem>
              <SelectItem value="source">Source timezone</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-import-review-state">Review state</Label>
          <Input
            id="event-import-review-state"
            onChange={(event) => onChange({ ...form, import_review_state: event.target.value })}
            placeholder="needs_review"
            value={form.import_review_state}
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            checked={form.all_day}
            id="event-all-day"
            onCheckedChange={(checked) => onChange({ ...form, all_day: checked === true })}
          />
          <Label htmlFor="event-all-day">All day (show the date only, no time)</Label>
        </div>
      </CardContent>
      <CardFooter>
        <Button disabled={saving} onClick={onSave} size="sm" type="button">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
          Save timezone
        </Button>
      </CardFooter>
    </Card>
  );
}

function TagsEditor({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg tracking-normal">Event Tags</CardTitle>
        <CardDescription>
          Separate tags with commas. An events list block set to a tag shows only events with that tag.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="event-tags">Tags</Label>
        <Input id="event-tags" onChange={(event) => onChange(event.target.value)} placeholder="paddling, cycling" value={value} />
      </CardContent>
      <CardFooter>
        <Button disabled={saving} onClick={onSave} size="sm" type="button">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
          Save tags
        </Button>
      </CardFooter>
    </Card>
  );
}

function RegistrationEditor({
  drafts,
  onAdd,
  onChange,
  onSave,
  saving,
}: {
  drafts: RegistrationDraft[];
  onAdd: () => void;
  onChange: (drafts: RegistrationDraft[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  function updateDraft(id: number, patch: Partial<RegistrationDraft>) {
    onChange(drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg tracking-normal">Registration Options</CardTitle>
          <CardDescription>Structured source registration data shown above the RSVP panel.</CardDescription>
        </div>
        <Button disabled={saving} onClick={onAdd} size="sm" type="button" variant="secondary">
          <Plus className="h-4 w-4" />
          Add option
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {drafts.length === 0 ? <p className="text-sm text-muted-foreground">No structured registration options yet.</p> : null}
        {drafts.map((draft) => (
          <Card key={draft.id} className="shadow-none">
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-4 md:grid-cols-[5rem_1fr_8rem_8rem]">
                <div className="space-y-2">
                  <Label htmlFor={`reg-${draft.id}-position`}>Order</Label>
                  <Input
                    id={`reg-${draft.id}-position`}
                    onChange={(event) => updateDraft(draft.id, { position: event.target.value })}
                    type="number"
                    value={draft.position}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`reg-${draft.id}-label`}>Label</Label>
                  <Input id={`reg-${draft.id}-label`} onChange={(event) => updateDraft(draft.id, { label: event.target.value })} value={draft.label} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`reg-${draft.id}-amount`}>Amount</Label>
                  <Input
                    id={`reg-${draft.id}-amount`}
                    onChange={(event) => updateDraft(draft.id, { price_amount: event.target.value })}
                    step="0.01"
                    type="number"
                    value={draft.price_amount}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`reg-${draft.id}-currency`}>Currency</Label>
                  <Input
                    id={`reg-${draft.id}-currency`}
                    onChange={(event) => updateDraft(draft.id, { currency: event.target.value })}
                    placeholder="AUD"
                    value={draft.currency}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`reg-${draft.id}-raw-price-label`}>Raw price label</Label>
                <Input
                  id={`reg-${draft.id}-raw-price-label`}
                  onChange={(event) => updateDraft(draft.id, { raw_price_label: event.target.value })}
                  value={draft.raw_price_label}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`reg-${draft.id}-description`}>Description</Label>
                <Textarea
                  id={`reg-${draft.id}-description`}
                  onChange={(event) => updateDraft(draft.id, { description: event.target.value })}
                  value={draft.description}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_8rem_8rem_10rem]">
                <div className="space-y-2">
                  <Label htmlFor={`reg-${draft.id}-guest-policy`}>Guest policy</Label>
                  <Input
                    id={`reg-${draft.id}-guest-policy`}
                    onChange={(event) => updateDraft(draft.id, { guest_policy: event.target.value })}
                    value={draft.guest_policy}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`reg-${draft.id}-capacity`}>Capacity</Label>
                  <Input
                    id={`reg-${draft.id}-capacity`}
                    onChange={(event) => updateDraft(draft.id, { capacity: event.target.value })}
                    type="number"
                    value={draft.capacity}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`reg-${draft.id}-spaces-left`}>Spaces left</Label>
                  <Input
                    id={`reg-${draft.id}-spaces-left`}
                    onChange={(event) => updateDraft(draft.id, { spaces_left: event.target.value })}
                    type="number"
                    value={draft.spaces_left}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`reg-${draft.id}-availability`}>Availability</Label>
                  <Select value={draft.availability_status} onValueChange={(value) => updateDraft(draft.id, { availability_status: value })}>
                    <SelectTrigger id={`reg-${draft.id}-availability`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABILITY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`reg-${draft.id}-cancellation-note`}>Cancellation note</Label>
                <Input
                  id={`reg-${draft.id}-cancellation-note`}
                  onChange={(event) => updateDraft(draft.id, { cancellation_note: event.target.value })}
                  value={draft.cancellation_note}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`reg-${draft.id}-source-url`}>Source registration URL</Label>
                <Input
                  id={`reg-${draft.id}-source-url`}
                  onChange={(event) => updateDraft(draft.id, { source_registration_url: event.target.value })}
                  value={draft.source_registration_url}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={`reg-${draft.id}-reviewed`}
                    checked={draft.review_state === 'reviewed'}
                    onCheckedChange={(checked) => updateDraft(draft.id, { review_state: checked ? 'reviewed' : 'needs_review' })}
                  />
                  <Label htmlFor={`reg-${draft.id}-reviewed`} className="leading-5">
                    Reviewed
                  </Label>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={`reg-${draft.id}-disabled`}
                    checked={draft.is_disabled}
                    onCheckedChange={(checked) => updateDraft(draft.id, { is_disabled: checked === true })}
                  />
                  <Label htmlFor={`reg-${draft.id}-disabled`} className="leading-5">
                    Hidden/disabled
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
      <CardFooter>
        <Button disabled={saving || drafts.length === 0} onClick={onSave} size="sm" type="button">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save registration options
        </Button>
      </CardFooter>
    </Card>
  );
}

interface EventDetailPageAppProps {
  /**
   * The requested event as `event.astro` read it server-side with the
   * anonymous `events.get`, or null when that read found nothing (missing
   * or members-only id) or failed. When present the first render, on the
   * server and at hydration, is the event itself rather than a skeleton.
   * `loadEvent()` still runs after mount for RSVPs, registration options,
   * the visitor's locale, admin edits, and members-only events.
   */
  initialEvent?: Event | null;
  /**
   * Request-time manifest entries for `initialEvent`'s hero and description
   * images (`pickAssetManifestEntries`), so `/assets/<name>` resolves in the
   * server render, where no window manifest exists.
   */
  assetManifest?: AssetManifest | null;
}

export default function EventDetailPageApp({ initialEvent, assetManifest }: EventDetailPageAppProps = {}) {
  const globalManifest = useGlobalManifest();
  const hydrated = useHydrated();
  const [event, setEvent] = useState<Event | null>(initialEvent ?? null);
  const [rsvps, setRsvps] = useState<EventRSVPWithMember[]>([]);
  const [registrationOptions, setRegistrationOptions] = useState<EventRegistrationOption[]>([]);
  const [registrationDrafts, setRegistrationDrafts] = useState<RegistrationDraft[]>([]);
  const [timezoneForm, setTimezoneForm] = useState<TimezoneForm>(() =>
    initialEvent ? timezoneFormFromEvent(initialEvent) : EMPTY_TIMEZONE_FORM,
  );
  const [tagsDraft, setTagsDraft] = useState(() => (initialEvent ? formatEventTags(initialEvent.tags) : ''));
  const [savingTags, setSavingTags] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(!initialEvent);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadEvent = useCallback(async () => {
    // Don't unconditionally flip `loading=true` — `event` may already hold
    // the server-rendered `initialEvent`, and toggling the skeleton would
    // re-paint over it on every locale/auth change. Without one, the
    // first-mount skeleton comes from the `useState` initializer.
    setError('');
    setAccessDenied(false);
    try {
      await ready;
      const id = eventIdFromLocation();
      if (!id) {
        setEvent(null);
        setError('Event not found.');
        return;
      }

      const rows = await get(`events?id=eq.${encodeURIComponent(id)}&limit=1`);
      if (!rows.length) {
        setEvent(null);
        setError('Event not found.');
        return;
      }

      const translated = await translateItems('event', [rows[0]], ['title', 'description']);
      const loadedEvent = translated[0] as Event;
      const authenticated = isAuthenticated();
      setSignedIn(authenticated);
      setAdmin(isAdmin());
      setEvent(loadedEvent);
      setTimezoneForm(timezoneFormFromEvent(loadedEvent));
      setTagsDraft(formatEventTags(loadedEvent.tags));

      if (loadedEvent.is_members_only && !authenticated) {
        setAccessDenied(true);
        setRsvps([]);
        setRegistrationOptions([]);
        setRegistrationDrafts([]);
        return;
      }

      // Fetch event_rsvps + registration_options as best-effort; failing the
      // whole `loadEvent` would replace the SSR-baked hero with an error
      // alert, which is worse UX than a missing attendee list. RSVPs need an
      // active member (`rsvps.listForEvent`), so anonymous visitors skip the
      // request instead of logging a 403 on every public event page.
      const [loadedRsvps, loadedOptions] = await Promise.all([
        authenticated
          ? get(`event_rsvps?event_id=eq.${encodeURIComponent(id)}&select=*,members(display_name,avatar_url)`).catch(() => [])
          : Promise.resolve([]),
        getEventRegistrationOptions(Number(id)).catch(() => []),
      ]);
      setRsvps(loadedRsvps as EventRSVPWithMember[]);
      setRegistrationOptions(loadedOptions);
      setRegistrationDrafts(loadedOptions.map(optionToDraft));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error loading event.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvent();
    document.addEventListener('wl-auth-changed', loadEvent);
    document.addEventListener('wl-locale-changed', loadEvent);
    return () => {
      document.removeEventListener('wl-auth-changed', loadEvent);
      document.removeEventListener('wl-locale-changed', loadEvent);
    };
  }, [loadEvent]);

  const counts = useMemo(() => {
    return {
      going: rsvps.filter((rsvp) => rsvp.status === 'going').length,
      maybe: rsvps.filter((rsvp) => rsvp.status === 'maybe').length,
    };
  }, [rsvps]);

  const myRsvp = useMemo(() => {
    const memberId = memberIdFromSession();
    return memberId ? rsvps.find((rsvp) => rsvp.member_id === memberId) || null : null;
  }, [rsvps]);

  async function updateRsvp(status: 'going' | 'maybe' | 'cancel') {
    if (!event || busyAction) return;
    setBusyAction(status);
    try {
      if (status === 'cancel' && myRsvp) {
        await del(`event_rsvps?id=eq.${myRsvp.id}`);
        showToast('RSVP cancelled', 'info');
      } else if (myRsvp) {
        await patch(`event_rsvps?id=eq.${myRsvp.id}`, { event_id: event.id, status });
        showToast(status === 'going' ? "You're going!" : 'Marked as maybe', 'success');
      } else {
        await post('event_rsvps', { event_id: event.id, status });
        showToast(status === 'going' ? "You're going!" : 'Marked as maybe', 'success');
      }

      if (status !== 'cancel') {
        await post('activity_log', {
          action: 'rsvp',
          metadata: { event_title: event.title, event_id: event.id },
        });
      }
      await loadEvent();
    } catch {
      showToast('Could not update RSVP', 'error');
    } finally {
      setBusyAction('');
    }
  }

  async function saveTimezone() {
    if (!event) return;
    setSavingTimezone(true);
    try {
      await updateEventTimezone(event.id, { ...eventTimezonePayload(timezoneForm), all_day: timezoneForm.all_day });
      showToast('Timezone saved', 'success');
      await loadEvent();
    } catch {
      showToast('Could not save timezone', 'error');
    } finally {
      setSavingTimezone(false);
    }
  }

  async function saveTags() {
    if (!event) return;
    setSavingTags(true);
    try {
      await patch(`events?id=eq.${event.id}`, { tags: normalizeEventTags(tagsDraft) });
      showToast('Tags saved', 'success');
      await loadEvent();
    } catch {
      showToast('Could not save tags', 'error');
    } finally {
      setSavingTags(false);
    }
  }

  async function addRegistrationOption() {
    if (!event) return;
    setSavingRegistration(true);
    try {
      await createEventRegistrationOption({
        event_id: event.id,
        position: registrationDrafts.length + 1,
        label: 'New registration option',
        availability_status: 'unknown',
        review_state: 'needs_review',
      });
      showToast('Registration option added', 'success');
      await loadEvent();
    } catch {
      showToast('Could not add registration option', 'error');
    } finally {
      setSavingRegistration(false);
    }
  }

  async function saveRegistrationOptions() {
    setSavingRegistration(true);
    try {
      for (const draft of registrationDrafts) {
        await updateEventRegistrationOption(draft.id, draftToPayload(draft));
      }
      showToast('Registration options saved', 'success');
      await loadEvent();
    } catch {
      showToast('Could not save registration options', 'error');
    } finally {
      setSavingRegistration(false);
    }
  }

  async function deleteEvent() {
    if (!event) return;
    setDeleting(true);
    try {
      await del(`events?id=eq.${event.id}`);
      showToast('Event deleted', 'success');
      const { navigate } = await import('astro:transitions/client');
      navigate('/events');
    } catch {
      showToast('Could not delete event', 'error');
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Button asChild size="sm" variant="ghost">
          <a href="/events">
            <ArrowLeft className="h-4 w-4" />
            All Events
          </a>
        </Button>
        <Card>
          <div className="aspect-[16/7] bg-muted" />
          <CardHeader>
            <div className="h-7 w-2/3 rounded-md bg-muted" />
            <div className="h-4 w-1/2 rounded-md bg-muted" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-4 rounded-md bg-muted" />
            <div className="h-4 w-5/6 rounded-md bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button asChild size="sm" variant="ghost">
          <a href="/events">
            <ArrowLeft className="h-4 w-4" />
            All Events
          </a>
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!event) return null;

  // Stable zone until hydrated (server HTML and hydration must agree), then
  // the visitor's zone and the site's display settings.
  const dateTime = hydrated
    ? formatEventDateTime(event, undefined, siteConfig, { dateStyle: 'long' })
    : formatEventDateTimeStable(event, undefined, { dateStyle: 'long' });

  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="ghost">
        <a href="/events">
          <ArrowLeft className="h-4 w-4" />
          All Events
        </a>
      </Button>

      {accessDenied ? (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>This event is for members only. Please sign in.</AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        {(() => {
          if (!event.image_url) {
            return (
              <div className="flex aspect-[16/7] items-center justify-center bg-muted text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
              </div>
            );
          }
          // Manifest hit → `<Run402Image>` (variant ladder + v1.54 placeholder;
          // `priority` because the event hero is above-the-fold on event detail
          // pages and drives LCP). Miss → plain `<img>` for admin-uploaded
          // images not in the build-time assetsDir.
          // `className` lands on `<picture>` (outermost), `style` on `<img>`
          // (always). Aspect-ratio box on the wrapper, cover-fit on the img;
          // otherwise non-16:7 source images stretch into the 16:7 box.
          const asset =
            lookupAssetRef(event.image_url, assetManifest) ?? lookupAssetRef(event.image_url, globalManifest);
          if (asset) {
            return (
              <Run402Image
                asset={asset}
                alt=""
                className="block aspect-[16/7] w-full"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
                data-editable-image={admin ? `events.${event.id}.image_url` : undefined}
              />
            );
          }
          return (
            <img
              alt=""
              className="aspect-[16/7] w-full object-cover"
              data-editable-image={admin ? `events.${event.id}.image_url` : undefined}
              height={360}
              src={event.image_url}
              width={960}
            />
          );
        })()}
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {event.is_members_only ? (
              <Badge>
                <Lock className="mr-1 h-3 w-3" />
                Members only
              </Badge>
            ) : null}
            {normalizeEventTags(event.tags).map((tag) => (
              <Badge data-event-tag={tag} key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
          <CardTitle className="break-words text-3xl tracking-normal" data-editable={admin ? `events.${event.id}.title` : undefined}>
            {event.title}
          </CardTitle>
          <CardDescription className="space-y-2 text-base">
            <span className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{dateTime.dateTimeLabel}</span>
            </span>
            {event.location ? (
              <span className="flex items-start gap-2" data-editable={admin ? `events.${event.id}.location` : undefined}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{event.location}</span>
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Description admin={admin} event={event} manifest={globalManifest ?? assetManifest ?? null} />
        </CardContent>
      </Card>

      {!accessDenied ? (
        <>
          <RegistrationOptions admin={admin} options={registrationOptions} />
          <RsvpPanel
            busyAction={busyAction}
            event={event}
            goingCount={counts.going}
            maybeCount={counts.maybe}
            myRsvp={myRsvp}
            onRsvp={(status) => void updateRsvp(status)}
            options={registrationOptions}
            signedIn={signedIn}
          />
          <Attendees rsvps={rsvps} />
        </>
      ) : null}

      {admin ? (
        <section className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setDeleteOpen(true)} size="sm" type="button" variant="destructive">
              <Trash2 className="h-4 w-4" />
              Delete Event
            </Button>
          </div>
          <TagsEditor onChange={setTagsDraft} onSave={() => void saveTags()} saving={savingTags} value={tagsDraft} />
          <TimezoneEditor form={timezoneForm} onChange={setTimezoneForm} onSave={() => void saveTimezone()} saving={savingTimezone} />
          <RegistrationEditor
            drafts={registrationDrafts}
            onAdd={() => void addRegistrationOption()}
            onChange={setRegistrationDrafts}
            onSave={() => void saveRegistrationOptions()}
            saving={savingRegistration}
          />
        </section>
      ) : null}

      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event?</DialogTitle>
            <DialogDescription>This removes the event from the portal.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={deleting} onClick={() => setDeleteOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={deleting} onClick={() => void deleteEvent()} type="button" variant="destructive">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
