'use client';

import {
  ArrowLeft,
  CalendarDays,
  Check,
  ExternalLink,
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
import { openAuthModal } from '@/lib/auth-modal-events';
import { ready, siteConfig, translateItems } from '@/lib/config';
import { formatEventDateTime } from '@/lib/event-display';
import {
  eventTimezonePayload,
  registrationAvailabilityLabel,
  registrationOptionPayload,
  registrationPriceLabel,
  visibleRegistrationOptions,
} from '@/lib/event-registration';
import { getGlobalManifest, lookupAssetRef, onManifestChanged } from '@/lib/kychon-image';
import { Run402Image } from '@/lib/run402-image-react';
import { sanitizeRichHtml } from '@/lib/sanitize-html';
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
}

const EMPTY_TIMEZONE_FORM: TimezoneForm = {
  source_timezone: '',
  source_timezone_label: '',
  time_display_mode: 'visitor',
  import_review_state: '',
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
  };
}

function safeExternalUrl(value: string | null | undefined): string {
  return value && /^https?:\/\//i.test(value) ? value : '';
}

function attendeeName(rsvp: EventRSVPWithMember): string {
  return rsvp.members?.display_name || 'Member';
}

function Description({ admin, event }: { admin: boolean; event: Event }) {
  const html = sanitizeRichHtml(event.description);
  if (!html) return null;
  return (
    <div
      className="prose prose-sm max-w-none text-foreground"
      data-editable-rich={admin ? `events.${event.id}.description` : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function RegistrationOptions({ options }: { options: EventRegistrationOption[] }) {
  const visible = visibleRegistrationOptions(options);
  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl tracking-normal">Registration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.map((option) => {
          const price = registrationPriceLabel(option);
          const availability = registrationAvailabilityLabel(option);
          const url = safeExternalUrl(option.source_registration_url);
          return (
            <Card key={option.id} className="shadow-none">
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <CardTitle className="break-words text-base tracking-normal">{option.label}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {price ? <Badge>{price}</Badge> : null}
                    {availability ? <Badge variant="secondary">{availability}</Badge> : null}
                    {option.review_state ? <Badge variant="outline">{option.review_state}</Badge> : null}
                  </div>
                </div>
                {option.description ? <CardDescription className="break-words">{option.description}</CardDescription> : null}
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {option.guest_policy ? <p className="break-words">{option.guest_policy}</p> : null}
                {option.cancellation_note ? <p className="break-words">{option.cancellation_note}</p> : null}
              </CardContent>
              {url ? (
                <CardFooter>
                  <Button asChild size="sm">
                    <a href={url} rel="noopener noreferrer" target="_blank">
                      <ExternalLink className="h-4 w-4" />
                      Register
                    </a>
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RsvpPanel({
  busyAction,
  event,
  goingCount,
  maybeCount,
  myRsvp,
  onRsvp,
  options,
  signedIn,
}: {
  busyAction: string;
  event: Event;
  goingCount: number;
  maybeCount: number;
  myRsvp: EventRSVPWithMember | null;
  onRsvp: (status: 'going' | 'maybe' | 'cancel') => void;
  options: EventRegistrationOption[];
  signedIn: boolean;
}) {
  const visibleOptions = visibleRegistrationOptions(options);
  const capacity = Number(event.capacity || 0);
  const capacityPct = capacity ? Math.min(100, Math.round((goingCount / capacity) * 100)) : 0;
  const spotsLeft = capacity ? Math.max(0, capacity - goingCount) : null;
  const isFull = capacity > 0 && goingCount >= capacity;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg tracking-normal">{visibleOptions.length ? 'Kychon RSVP' : `${goingCount} going${maybeCount ? `, ${maybeCount} maybe` : ''}`}</CardTitle>
          {capacity ? (
            <Badge variant="outline">
              {spotsLeft} of {capacity} spots left
            </Badge>
          ) : null}
        </div>
        {visibleOptions.length ? (
          <CardDescription>Source registration options are listed above. Use RSVP here only for Kychon attendance tracking.</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {capacity ? (
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={capacityPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${capacityPct}%` }} />
          </div>
        ) : null}

        {signedIn ? (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busyAction !== '' || (isFull && myRsvp?.status !== 'going')}
              onClick={() => onRsvp('going')}
              size="sm"
              type="button"
              variant={myRsvp?.status === 'going' ? 'default' : 'secondary'}
            >
              {busyAction === 'going' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Going
            </Button>
            <Button
              disabled={busyAction !== ''}
              onClick={() => onRsvp('maybe')}
              size="sm"
              type="button"
              variant={myRsvp?.status === 'maybe' ? 'default' : 'secondary'}
            >
              {busyAction === 'maybe' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Maybe
            </Button>
            {myRsvp ? (
              <Button disabled={busyAction !== ''} onClick={() => onRsvp('cancel')} size="sm" type="button" variant="outline">
                {busyAction === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cancel RSVP
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">Sign in to RSVP.</p>
            <Button onClick={() => openAuthModal({ mode: 'sign-in' })} size="sm" type="button">
              Sign in
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
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
          <CardDescription>Structured source registration data shown above the Kychon RSVP panel.</CardDescription>
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

export default function EventDetailPageApp() {
  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<EventRSVPWithMember[]>([]);
  const [registrationOptions, setRegistrationOptions] = useState<EventRegistrationOption[]>([]);
  const [registrationDrafts, setRegistrationDrafts] = useState<RegistrationDraft[]>([]);
  const [timezoneForm, setTimezoneForm] = useState<TimezoneForm>(EMPTY_TIMEZONE_FORM);
  const [admin, setAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Force re-render when the manifest arrives via the async fetch path
  // (see `kychon-image.ts:setGlobalManifest`) — without this, the hero
  // `<img>` baked into DOM on first visit never upgrades to the v1.54
  // `<picture>` ladder.
  const [, setManifestVersion] = useState(0);
  useEffect(() => onManifestChanged(() => setManifestVersion((v) => v + 1)), []);

  const loadEvent = useCallback(async () => {
    setLoading(true);
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

      if (loadedEvent.is_members_only && !authenticated) {
        setAccessDenied(true);
        setRsvps([]);
        setRegistrationOptions([]);
        setRegistrationDrafts([]);
        return;
      }

      const [loadedRsvps, loadedOptions] = await Promise.all([
        get(`event_rsvps?event_id=eq.${encodeURIComponent(id)}&select=*,members(display_name,avatar_url)`),
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
      await updateEventTimezone(event.id, eventTimezonePayload(timezoneForm));
      showToast('Timezone saved', 'success');
      await loadEvent();
    } catch {
      showToast('Could not save timezone', 'error');
    } finally {
      setSavingTimezone(false);
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

  const dateTime = formatEventDateTime(event, undefined, siteConfig, { dateStyle: 'long' });

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
          const asset = lookupAssetRef(event.image_url, getGlobalManifest());
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
          <Description admin={admin} event={event} />
        </CardContent>
      </Card>

      {!accessDenied ? (
        <>
          <RegistrationOptions options={registrationOptions} />
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
