export type RegistrationAvailability = 'available' | 'waitlist' | 'full' | 'closed' | 'unknown';
export type RegistrationReviewState = 'needs_review' | 'reviewed' | 'ignored';

export interface EventRegistrationOption {
  id?: number;
  event_id?: number;
  position?: number | string | null;
  label: string;
  description?: string | null;
  price_amount?: number | string | null;
  currency?: string | null;
  raw_price_label?: string | null;
  guest_policy?: string | null;
  capacity?: number | string | null;
  spaces_left?: number | string | null;
  availability_status?: RegistrationAvailability | string | null;
  cancellation_note?: string | null;
  source_registration_url?: string | null;
  review_state?: RegistrationReviewState | string | null;
  is_disabled?: boolean | null;
  raw_source_metadata?: unknown;
}

function escHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(value: unknown): string {
  return escHtml(value);
}

export function isVisibleRegistrationOption(option: EventRegistrationOption): boolean {
  return option.is_disabled !== true && option.review_state !== 'ignored';
}

export function visibleRegistrationOptions(
  options: EventRegistrationOption[] | null | undefined,
): EventRegistrationOption[] {
  return (options || [])
    .filter(isVisibleRegistrationOption)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
}

export function registrationPriceLabel(option: EventRegistrationOption): string {
  if (option.raw_price_label) return String(option.raw_price_label);
  if (option.price_amount == null || option.price_amount === '') return '';
  const amount = Number(option.price_amount);
  if (!Number.isFinite(amount)) return String(option.price_amount);
  const currency = option.currency || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function registrationAvailabilityLabel(option: EventRegistrationOption): string {
  const status = option.availability_status || 'unknown';
  if (status === 'available') {
    if (typeof option.spaces_left === 'number') return `${option.spaces_left} spaces left`;
    return '';
  }
  if (status === 'waitlist') return 'Waitlist available';
  if (status === 'full') return 'Full';
  if (status === 'closed') return 'Registration closed';
  if (typeof option.spaces_left === 'number') return `${option.spaces_left} spaces left`;
  return '';
}

export function safeExternalLinkAttrs(url: string | null | undefined): string {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  return ' target="_blank" rel="noopener noreferrer"';
}

export function registrationOptionPayload(input: Partial<EventRegistrationOption>): Partial<EventRegistrationOption> {
  return {
    position: Number(input.position ?? 0) || 0,
    label: String(input.label || '').trim() || 'Registration option',
    description: input.description ? String(input.description) : null,
    price_amount: input.price_amount === '' || input.price_amount == null ? null : Number(input.price_amount),
    currency: input.currency ? String(input.currency).trim().toUpperCase() : null,
    raw_price_label: input.raw_price_label ? String(input.raw_price_label).trim() : null,
    guest_policy: input.guest_policy ? String(input.guest_policy).trim() : null,
    capacity: input.capacity == null || input.capacity === '' ? null : Number(input.capacity),
    spaces_left: input.spaces_left == null || input.spaces_left === '' ? null : Number(input.spaces_left),
    availability_status: input.availability_status || 'unknown',
    cancellation_note: input.cancellation_note ? String(input.cancellation_note).trim() : null,
    source_registration_url: input.source_registration_url ? String(input.source_registration_url).trim() : null,
    review_state: input.review_state || 'needs_review',
    is_disabled: input.is_disabled === true,
  };
}

export function eventTimezonePayload(input: {
  source_timezone?: string | null;
  source_timezone_label?: string | null;
  time_display_mode?: string | null;
  import_review_state?: string | null;
}): Record<string, string | null> {
  return {
    source_timezone: input.source_timezone ? String(input.source_timezone).trim() : null,
    source_timezone_label: input.source_timezone_label ? String(input.source_timezone_label).trim() : null,
    time_display_mode: input.time_display_mode === 'source' ? 'source' : 'visitor',
    import_review_state: input.import_review_state ? String(input.import_review_state).trim() : null,
  };
}

export function renderRegistrationOptions(
  options: EventRegistrationOption[] | null | undefined,
  opts: { heading?: string; showReviewState?: boolean } = {},
): string {
  const visible = visibleRegistrationOptions(options);
  if (!visible.length) return '';
  const heading = opts.heading || 'Registration';
  const cards = visible.map((option) => {
    const price = registrationPriceLabel(option);
    const availability = registrationAvailabilityLabel(option);
    const statusClass = option.availability_status ? ` event-registration__status--${escAttr(option.availability_status)}` : '';
    const cta = option.source_registration_url
      ? `<a class="btn btn-primary btn-sm event-registration__cta" href="${escAttr(option.source_registration_url)}"${safeExternalLinkAttrs(option.source_registration_url)}>Register</a>`
      : '';
    const review = opts.showReviewState && option.review_state
      ? `<span class="badge badge-secondary">${escHtml(option.review_state)}</span>`
      : '';
    return `
      <article class="event-registration__option" data-registration-option-id="${escAttr(option.id ?? '')}">
        <div class="event-registration__option-head">
          <h4>${escHtml(option.label)}</h4>
          <div class="event-registration__badges">
            ${price ? `<span class="badge badge-primary">${escHtml(price)}</span>` : ''}
            ${availability ? `<span class="badge badge-warning${statusClass}">${escHtml(availability)}</span>` : ''}
            ${review}
          </div>
        </div>
        ${option.description ? `<p class="text-sm">${escHtml(option.description)}</p>` : ''}
        ${option.guest_policy ? `<p class="text-sm text-muted">${escHtml(option.guest_policy)}</p>` : ''}
        ${option.cancellation_note ? `<p class="text-sm text-muted">${escHtml(option.cancellation_note)}</p>` : ''}
        ${cta}
      </article>
    `;
  }).join('');
  return `
    <section class="card event-registration mt-2">
      <h3 class="mb-1">${escHtml(heading)}</h3>
      <div class="event-registration__options">${cards}</div>
    </section>
  `;
}
