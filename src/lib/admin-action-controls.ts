import { badgeVariants, buttonVariants } from '@/components/kychon/ui';

function attr(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const iconButtonClass = buttonVariants({
  variant: 'outline',
  size: 'icon',
  className: 'h-7 w-7 bg-background/90 text-foreground shadow-sm',
});

const destructiveIconButtonClass = buttonVariants({
  variant: 'outline',
  size: 'icon',
  className: 'h-7 w-7 bg-background/90 text-destructive shadow-sm hover:text-destructive',
});

const scopeButtonClass = buttonVariants({
  variant: 'outline',
  size: 'sm',
  className: 'h-7 rounded-full bg-background/90 px-2 text-[0.6875rem] shadow-sm',
});

const dragHandleButtonClass = buttonVariants({
  variant: 'outline',
  size: 'icon',
  className:
    'absolute right-2 top-2 z-10 hidden h-7 w-7 cursor-grab bg-background/90 text-muted-foreground shadow-sm transition-transform hover:scale-105 active:cursor-grabbing',
});

const sectionActionsClass = 'absolute left-2 top-2 z-10 hidden gap-1 [body.admin_[data-sortable-group]>[data-sortable-id]:hover>&]:flex';

export const adminScopePillClass = badgeVariants({
  className: 'h-7 rounded-full uppercase tracking-wide shadow-sm',
});

export function adminScopePillHtml(): string {
  return `<span class="${attr(adminScopePillClass)}" data-admin-scope-pill>Global</span>`;
}

export function adminScopeToggleHtml(sectionId: number, nextScope: 'global' | 'page', label: string): string {
  return `<button class="${attr(scopeButtonClass)}" data-scope-toggle="${sectionId}" data-scope-next="${nextScope}" title="${attr(label)}">${attr(label)}</button>`;
}

export function adminSectionEditButtonHtml(sectionId: number): string {
  return `<button class="${attr(iconButtonClass)}" data-section-edit="${sectionId}" title="Edit block" aria-label="Edit block"><span aria-hidden="true">⚙</span></button>`;
}

export function adminEmbedEditButtonHtml(sectionId: number): string {
  return `<button class="${attr(iconButtonClass)}" data-embed-edit="${sectionId}" title="Edit embed" aria-label="Edit embed"><span aria-hidden="true">✎</span></button>`;
}

export function adminNavEditButtonHtml(sectionId: number): string {
  const navEditButtonClass = buttonVariants({
    variant: 'outline',
    size: 'icon',
    className: 'ml-2 h-7 w-7 bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity [&:focus]:opacity-100 [nav:hover_&]:opacity-100',
  });
  return `<button class="${attr(navEditButtonClass)}" data-nav-edit="${sectionId}" title="Edit navigation" aria-label="Edit navigation"><span aria-hidden="true">✎</span></button>`;
}

export function adminSectionRemoveButtonHtml(sectionId: number): string {
  return `<button class="${attr(destructiveIconButtonClass)}" data-section-remove="${sectionId}" title="Remove section" aria-label="Remove section"><span aria-hidden="true">&times;</span></button>`;
}

export function adminSectionActionsHtml(content: string): string {
  return `<div class="${attr(sectionActionsClass)}">${content}</div>`;
}

export function adminDragHandleHtml(): string {
  return `<button class="${attr(dragHandleButtonClass)}" type="button" draggable="true" data-admin-drag-handle aria-label="Drag to reorder"><span aria-hidden="true">☰</span></button>`;
}
