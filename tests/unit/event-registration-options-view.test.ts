// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RegistrationOptions, RsvpPanel } from '../../src/components/kychon/EventRegistrationPanels';
import type { Event, EventRegistrationOption } from '../../src/schemas/event';
import { appendBodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function option(overrides: Partial<EventRegistrationOption> = {}): EventRegistrationOption {
  return {
    id: 1,
    event_id: 7,
    position: 0,
    label: 'General admission',
    description: null,
    price_amount: null,
    currency: null,
    raw_price_label: null,
    guest_policy: null,
    capacity: null,
    spaces_left: null,
    availability_status: 'closed',
    cancellation_note: null,
    source_registration_url: 'https://tickets.example.org/register',
    review_state: 'reviewed',
    is_disabled: false,
    ...overrides,
  };
}

const event: Event = {
  id: 7,
  title: 'Spring Gala',
  description: null,
  location: null,
  starts_at: '2026-11-01T18:00:00Z',
  ends_at: null,
  capacity: null,
  image_url: null,
  is_members_only: false,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
};

function render(element: ReturnType<typeof createElement>) {
  act(() => root.render(element));
}

beforeEach(() => {
  [host] = appendBodyFixture('<div></div>') as [HTMLDivElement];
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  clearBodyFixture();
});

describe('RegistrationOptions (public event page)', () => {
  it('hides import review_state from non-admin viewers', () => {
    render(createElement(RegistrationOptions, { admin: false, options: [option()] }));
    expect(host.textContent).toContain('Registration closed');
    expect(host.textContent).not.toContain('reviewed');
  });

  it('still shows review_state to admins', () => {
    render(createElement(RegistrationOptions, { admin: true, options: [option()] }));
    expect(host.textContent).toContain('reviewed');
  });

  it.each(['closed', 'full'] as const)('does not offer a Register link when availability is %s', (status) => {
    render(createElement(RegistrationOptions, { admin: false, options: [option({ availability_status: status })] }));
    expect(host.querySelector('a[href="https://tickets.example.org/register"]')).toBeNull();
    expect(host.textContent).not.toContain('Register');
  });

  it('keeps the Register link for open registration', () => {
    render(
      createElement(RegistrationOptions, { admin: false, options: [option({ availability_status: 'available' })] }),
    );
    expect(host.querySelector('a[href="https://tickets.example.org/register"]')).not.toBeNull();
  });
});

describe('RsvpPanel copy alongside source registration options', () => {
  it('uses visitor-facing copy without porter/operator language', () => {
    render(
      createElement(RsvpPanel, {
        busyAction: '',
        event,
        goingCount: 0,
        maybeCount: 0,
        myRsvp: null,
        onRsvp: () => {},
        options: [option()],
        signedIn: false,
      }),
    );
    const text = host.textContent || '';
    expect(text).toContain('RSVP');
    expect(text).not.toContain('Kychon');
    expect(text.toLowerCase()).not.toContain('source');
    expect(text.toLowerCase()).not.toContain('attendance tracking');
  });
});
