import { describe, expect, it } from 'vitest';
import {
  eventTimezonePayload,
  registrationOptionPayload,
  renderRegistrationOptions,
  visibleRegistrationOptions,
} from '../../src/lib/event-registration';

describe('event registration options', () => {
  it('renders multi-option registration details and safe source links', () => {
    const html = renderRegistrationOptions([
      {
        id: 1,
        label: 'Member registration',
        position: 2,
        raw_price_label: '$25.00',
        availability_status: 'available',
        spaces_left: 8,
        guest_policy: 'Guests allowed',
        cancellation_note: 'Cancel by Friday',
        source_registration_url: 'https://club.example/register',
      },
      {
        id: 2,
        label: 'Waitlist',
        position: 1,
        raw_price_label: 'Free',
        availability_status: 'waitlist',
      },
    ]);

    expect(html.indexOf('Waitlist')).toBeLessThan(html.indexOf('Member registration'));
    expect(html).toContain('$25.00');
    expect(html).toContain('8 spaces left');
    expect(html).toContain('Guests allowed');
    expect(html).toContain('Cancel by Friday');
    expect(html).toContain('href="https://club.example/register"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
  });

  it('preserves raw price labels when amount normalization is incomplete', () => {
    const html = renderRegistrationOptions([
      {
        label: 'Depends on selected options',
        raw_price_label: 'Registration (depends on selected options)',
        availability_status: 'unknown',
      },
    ]);

    expect(html).toContain('Registration (depends on selected options)');
  });

  it('renders no registration panel when an event has no options', () => {
    expect(renderRegistrationOptions([])).toBe('');
  });

  it('does not present closed options as freely available', () => {
    const html = renderRegistrationOptions([{ label: 'Late registration', availability_status: 'closed' }]);

    expect(html).toContain('Registration closed');
    expect(html).not.toContain('spaces left');
  });

  it('hides disabled or ignored imported options', () => {
    const options = visibleRegistrationOptions([
      { label: 'Visible', availability_status: 'available' },
      { label: 'Disabled', is_disabled: true, availability_status: 'available' },
      { label: 'Ignored', review_state: 'ignored', availability_status: 'available' },
    ]);

    expect(options.map((o) => o.label)).toEqual(['Visible']);
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
});
