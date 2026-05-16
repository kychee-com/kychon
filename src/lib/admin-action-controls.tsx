import * as React from 'react';
import type { ComponentProps, ComponentType, ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GripVertical, Pencil, Settings, X } from 'lucide-react';

import { Badge, Button } from '@/components/kychon/ui';

function attr(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const iconButtonClass = 'h-7 w-7 bg-background/90 text-foreground shadow-sm';
const destructiveIconButtonClass = 'h-7 w-7 bg-background/90 text-destructive shadow-sm hover:text-destructive';
const scopeButtonClass = 'h-7 rounded-full bg-background/90 px-2 text-[0.6875rem] shadow-sm';
const dragHandleButtonClass =
  'absolute right-2 top-2 z-10 hidden h-7 w-7 cursor-grab bg-background/90 text-muted-foreground shadow-sm transition-transform hover:scale-105 active:cursor-grabbing';
const navEditButtonClass =
  'ml-2 h-7 w-7 bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity [&:focus]:opacity-100 [nav:hover_&]:opacity-100';

const sectionActionsClass = 'absolute left-2 top-2 z-10 hidden gap-1 [[data-admin=true]_[data-sortable-group]>[data-sortable-id]:hover>&]:flex';

type IconComponent = ComponentType<{
  'aria-hidden'?: boolean;
  className?: string;
}>;
type DataAttributes = Record<`data-${string}`, string | number | boolean | undefined>;
type StaticButtonProps = ComponentProps<typeof Button> & DataAttributes;
type StaticBadgeProps = ComponentProps<typeof Badge> & DataAttributes;

function icon(Icon: IconComponent): ReactElement {
  return <Icon aria-hidden={true} className="h-4 w-4" />;
}

function staticChildren(children: ReactNode[]): ReactNode {
  if (children.length === 1) return children[0];
  return children.map((child, index) => <React.Fragment key={index}>{child}</React.Fragment>);
}

function buttonHtml(props: StaticButtonProps, ...children: ReactNode[]): string {
  return renderToStaticMarkup(<Button {...props}>{staticChildren(children)}</Button>);
}

function badgeHtml(props: StaticBadgeProps, ...children: ReactNode[]): string {
  return renderToStaticMarkup(<Badge {...props}>{staticChildren(children)}</Badge>);
}

export function adminScopePillHtml(): string {
  return badgeHtml(
    {
      className: 'h-7 rounded-full uppercase tracking-wide shadow-sm',
      'data-admin-scope-pill': true,
    },
    'Global',
  );
}

export function adminScopeToggleHtml(sectionId: number, nextScope: 'global' | 'page', label: string): string {
  return buttonHtml(
    {
      className: scopeButtonClass,
      'data-scope-toggle': sectionId,
      'data-scope-next': nextScope,
      size: 'sm',
      title: label,
      type: 'button',
      variant: 'outline',
    },
    label,
  );
}

export function adminSectionEditButtonHtml(sectionId: number): string {
  return buttonHtml(
    {
      'aria-label': 'Edit block',
      className: iconButtonClass,
      'data-section-edit': sectionId,
      size: 'icon',
      title: 'Edit block',
      type: 'button',
      variant: 'outline',
    },
    icon(Settings),
  );
}

export function adminEmbedEditButtonHtml(sectionId: number): string {
  return buttonHtml(
    {
      'aria-label': 'Edit embed',
      className: iconButtonClass,
      'data-embed-edit': sectionId,
      size: 'icon',
      title: 'Edit embed',
      type: 'button',
      variant: 'outline',
    },
    icon(Pencil),
  );
}

export function adminNavEditButtonHtml(sectionId: number): string {
  return buttonHtml(
    {
      'aria-label': 'Edit navigation',
      className: navEditButtonClass,
      'data-nav-edit': sectionId,
      size: 'icon',
      title: 'Edit navigation',
      type: 'button',
      variant: 'outline',
    },
    icon(Pencil),
  );
}

export function adminSectionRemoveButtonHtml(sectionId: number): string {
  return buttonHtml(
    {
      'aria-label': 'Remove section',
      className: destructiveIconButtonClass,
      'data-section-remove': sectionId,
      size: 'icon',
      title: 'Remove section',
      type: 'button',
      variant: 'outline',
    },
    icon(X),
  );
}

export function adminSectionActionsHtml(content: string): string {
  return `<div class="${attr(sectionActionsClass)}">${content}</div>`;
}

export function adminDragHandleHtml(): string {
  return buttonHtml(
    {
      'aria-label': 'Drag to reorder',
      className: dragHandleButtonClass,
      'data-admin-drag-handle': true,
      draggable: true,
      size: 'icon',
      type: 'button',
      variant: 'outline',
    },
    icon(GripVertical),
  );
}
