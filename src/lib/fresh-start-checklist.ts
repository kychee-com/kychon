export const FRESH_START_CHECKLIST_KEY = 'fresh_start_checklist';

export interface FreshStartChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
}

export interface FreshStartChecklistState {
  completed: string[];
  dismissed: boolean;
}

export const FRESH_START_CHECKLIST_ITEMS: FreshStartChecklistItem[] = [
  {
    id: 'logo',
    label: 'Add your logo',
    description: 'Upload the mark members will recognize first.',
    href: '/admin-settings.html',
  },
  {
    id: 'colors',
    label: 'Choose colors',
    description: 'Set a primary color and theme that fits your organization.',
    href: '/admin-settings.html',
  },
  {
    id: 'homepage_intro',
    label: 'Write the homepage intro',
    description: 'Tell members what this portal is for and what to do first.',
    href: '/',
  },
  {
    id: 'feature_choices',
    label: 'Choose features',
    description: 'Turn on the sections your community actually needs.',
    href: '/admin-settings.html',
  },
  {
    id: 'another_admin',
    label: 'Invite another admin',
    description: 'Add a backup owner before launch work starts piling up.',
    href: '/admin-members.html',
  },
  {
    id: 'first_event',
    label: 'Create the first event',
    description: 'Publish the next meeting, service, game, workshop, or gathering.',
    href: '/events.html',
  },
  {
    id: 'first_resource',
    label: 'Add the first resource',
    description: 'Share a document, link, handbook, form, or common reference.',
    href: '/resources.html',
  },
  {
    id: 'member_signup',
    label: 'Review member signup',
    description: 'Confirm approval mode, directory visibility, and member fields.',
    href: '/admin-settings.html',
  },
  {
    id: 'launch',
    label: 'Launch',
    description: 'Review the public pages and send the portal to your first members.',
    href: '/',
  },
];

const ITEM_IDS = new Set(FRESH_START_CHECKLIST_ITEMS.map((item) => item.id));

export const DEFAULT_FRESH_START_CHECKLIST_STATE: FreshStartChecklistState = {
  completed: [],
  dismissed: false,
};

export function normalizeChecklistState(value: unknown): FreshStartChecklistState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_FRESH_START_CHECKLIST_STATE };
  }

  const raw = value as Partial<FreshStartChecklistState>;
  const completed = Array.isArray(raw.completed)
    ? raw.completed.filter((id): id is string => typeof id === 'string' && ITEM_IDS.has(id))
    : [];

  return {
    completed: Array.from(new Set(completed)),
    dismissed: raw.dismissed === true,
  };
}

export function toggleChecklistItem(
  state: FreshStartChecklistState,
  itemId: string,
  checked: boolean,
): FreshStartChecklistState {
  const normalized = normalizeChecklistState(state);
  if (!ITEM_IDS.has(itemId)) return normalized;

  const completed = new Set(normalized.completed);
  if (checked) completed.add(itemId);
  else completed.delete(itemId);

  return {
    ...normalized,
    completed: Array.from(completed),
  };
}

export function dismissChecklist(state: FreshStartChecklistState): FreshStartChecklistState {
  return {
    ...normalizeChecklistState(state),
    dismissed: true,
  };
}

export function checklistProgress(state: FreshStartChecklistState): {
  completed: number;
  total: number;
  percent: number;
} {
  const completed = normalizeChecklistState(state).completed.length;
  const total = FRESH_START_CHECKLIST_ITEMS.length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function shouldShowChecklist(state: FreshStartChecklistState): boolean {
  return !normalizeChecklistState(state).dismissed;
}
