import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  eventTimezonePayload,
  registrationAvailabilityLabel,
  registrationOptionPayload,
  registrationPriceLabel,
  visibleRegistrationOptions,
} from '../../src/lib/event-registration';

const EVENT_REGISTRATION_SOURCE = resolve(process.cwd(), 'src/lib/event-registration.ts');

describe('event registration options', () => {
  it('preserves raw price labels when amount normalization is incomplete', () => {
    expect(
      registrationPriceLabel({
        label: 'Depends on selected options',
        raw_price_label: 'Registration (depends on selected options)',
        availability_status: 'unknown',
      }),
    ).toBe('Registration (depends on selected options)');
  });

  it('does not present closed options as freely available', () => {
    expect(registrationAvailabilityLabel({ label: 'Late registration', availability_status: 'closed' })).toBe(
      'Registration closed',
    );
  });

  it('hides disabled or ignored imported options', () => {
    const options = visibleRegistrationOptions([
      { label: 'Visible', availability_status: 'available' },
      { label: 'Disabled', is_disabled: true, availability_status: 'available' },
      { label: 'Ignored', review_state: 'ignored', availability_status: 'available' },
    ]);

    expect(options.map((o) => o.label)).toEqual(['Visible']);
  });

  it('sorts visible registration options by position', () => {
    const options = visibleRegistrationOptions([
      { label: 'Second', position: 2, availability_status: 'available' },
      { label: 'First', position: 1, availability_status: 'available' },
    ]);

    expect(options.map((o) => o.label)).toEqual(['First', 'Second']);
  });

  it('builds admin payloads for registration edits', () => {
    const payload = registrationOptionPayload({
      position: '3',
      label: ' Non-member ',
      price_amount: '12.5',
      currency: 'aud',
      capacity: '20',
      spaces_left: '4',
      availability_status: 'available',
      review_state: 'reviewed',
      is_disabled: true,
    });

    expect(payload).toMatchObject({
      position: 3,
      label: 'Non-member',
      price_amount: 12.5,
      currency: 'AUD',
      capacity: 20,
      spaces_left: 4,
      availability_status: 'available',
      review_state: 'reviewed',
      is_disabled: true,
    });
  });

  it('builds admin payloads for event timezone overrides', () => {
    expect(
      eventTimezonePayload({
        source_timezone: ' Australia/Sydney ',
        source_timezone_label: ' AEDT ',
        time_display_mode: 'source',
        import_review_state: 'reviewed',
      }),
    ).toEqual({
      source_timezone: 'Australia/Sydney',
      source_timezone_label: 'AEDT',
      time_display_mode: 'source',
      import_review_state: 'reviewed',
    });
  });

  it('keeps rendering in the event detail shadcn island, not legacy HTML helpers', async () => {
    const source = await readFile(EVENT_REGISTRATION_SOURCE, 'utf8');

    expect(source).not.toContain('renderRegistrationOptions');
    expect(source).not.toContain('safeExternalLinkAttrs');
    expect(source).not.toContain('class="btn');
    expect(source).not.toContain('class="card');
    expect(source).not.toContain('ky-text-muted');
  });
});
