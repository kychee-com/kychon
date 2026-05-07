import { describe, expect, it } from 'vitest';

import {
  checklistProgress,
  dismissChecklist,
  FRESH_START_CHECKLIST_ITEMS,
  normalizeChecklistState,
  shouldShowChecklist,
  toggleChecklistItem,
} from '../../src/lib/fresh-start-checklist';

describe('fresh start checklist', () => {
  it('includes the expected launch items', () => {
    expect(FRESH_START_CHECKLIST_ITEMS.map((item) => item.id)).toEqual([
      'logo',
      'colors',
      'homepage_intro',
      'feature_choices',
      'another_admin',
      'first_event',
      'first_resource',
      'member_signup',
      'launch',
    ]);
  });

  it('normalizes persisted state and drops unknown items', () => {
    expect(
      normalizeChecklistState({
        completed: ['logo', 'logo', 'unknown', 'first_event'],
        dismissed: true,
      }),
    ).toEqual({
      completed: ['logo', 'first_event'],
      dismissed: true,
    });
  });

  it('persists completion state across normalized reloads', () => {
    const afterLogo = toggleChecklistItem({ completed: [], dismissed: false }, 'logo', true);
    const afterEvent = toggleChecklistItem(afterLogo, 'first_event', true);
    const reloaded = normalizeChecklistState(JSON.parse(JSON.stringify(afterEvent)));

    expect(reloaded.completed).toEqual(['logo', 'first_event']);
    expect(checklistProgress(reloaded)).toEqual({
      completed: 2,
      total: 9,
      percent: 22,
    });
  });

  it('tracks dismissal visibility separately from completion', () => {
    const state = dismissChecklist({
      completed: ['logo'],
      dismissed: false,
    });

    expect(shouldShowChecklist(state)).toBe(false);
    expect(state.completed).toEqual(['logo']);
  });
});
