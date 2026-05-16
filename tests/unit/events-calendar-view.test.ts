// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type EventsCalendarMonthCell,
  EventsCalendarMonthView,
} from '../../src/components/kychon/EventsCalendarBlockView';
import { appendBodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function monthCell(day: string, label: string, focused = false): EventsCalendarMonthCell {
  return {
    ariaLabel: `${label}, 0 events`,
    chips: [],
    day,
    dayLabel: label,
    focused,
    inMonth: true,
    isToday: false,
    moreButton: null,
  };
}

beforeEach(() => {
  [host] = appendBodyFixture('<div></div>') as [HTMLDivElement];
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  clearBodyFixture();
});

describe('EventsCalendarMonthView', () => {
  it('focuses requested grid cells through React refs', async () => {
    const rows = [[monthCell('2026-05-01', '1'), monthCell('2026-05-02', '2', true)]];

    await act(async () => {
      root.render(
        createElement(EventsCalendarMonthView, {
          density: 'light',
          focusDay: '2026-05-02',
          label: 'May 2026',
          liveText: 'May 2026, 0 events',
          rows,
          weekdays: ['Fri', 'Sat'],
        }),
      );
    });

    expect(document.activeElement?.getAttribute('data-day')).toBe('2026-05-02');

    await act(async () => {
      root.render(
        createElement(EventsCalendarMonthView, {
          density: 'light',
          focusDay: '2026-05-01',
          label: 'May 2026',
          liveText: 'May 2026, 0 events',
          rows: [[monthCell('2026-05-01', '1', true), monthCell('2026-05-02', '2')]],
          weekdays: ['Fri', 'Sat'],
        }),
      );
    });

    expect(document.activeElement?.getAttribute('data-day')).toBe('2026-05-01');
  });
});
