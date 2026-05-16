import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Menu } from 'lucide-react';

import { Button } from '@/components/kychon/ui';
import { cn } from '@/lib/ui/cn';

export interface NavBlockItem {
  active: boolean;
  children: NavBlockItem[];
  hasHref: boolean;
  href: string;
  label: string;
  menuId?: string;
}

export type NavBlockStyle = React.CSSProperties & Record<`--${string}`, string>;

export interface NavBlockProps {
  blockId?: number | string | null;
  desktopOpen?: string;
  items: NavBlockItem[];
  mobileBreakpoint?: number | null;
  mobileClosedLayout?: string;
  mobileOpenLayout?: string;
  presentationStyle?: NavBlockStyle;
  useFullRow?: boolean;
}

const navParentWrapClass = cn(
  'nav-item-wrap relative inline-flex',
  '[.nav-overflow-menu_&]:w-full [.nav-overflow-menu_&]:flex-col [.nav-overflow-menu_&]:items-stretch',
  '[.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:w-full [.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:flex-col [.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:items-stretch',
);

const menuListClass = cn(
  'nav-dropdown absolute left-0 top-full z-50 m-0 ml-[var(--nav-dropdown-offset-x,0)] mt-[var(--nav-dropdown-offset-y,0)] min-w-[var(--nav-dropdown-width,12rem)] list-none rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md',
  '[.nav-overflow-menu_&]:static [.nav-overflow-menu_&]:ml-0 [.nav-overflow-menu_&]:mt-0 [.nav-overflow-menu_&]:w-full [.nav-overflow-menu_&]:min-w-0 [.nav-overflow-menu_&]:border-0 [.nav-overflow-menu_&]:bg-transparent [.nav-overflow-menu_&]:pl-6 [.nav-overflow-menu_&]:shadow-none',
  '[.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:static [.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:ml-0 [.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:mt-0 [.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:w-full [.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:border-0 [.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:bg-transparent [.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:pl-6 [.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:shadow-none',
);

const nestedMenuListClass = cn(
  menuListClass,
  'nav-dropdown-nested left-full top-0 ml-1 mt-0',
  '[.nav-overflow-menu_&]:pl-6',
  '[.nav[data-nav-source-mobile=true]_.nav-links[data-nav-mobile-open=true]_&]:pl-6',
);

const navMenuItemClass = 'nav-menuitem block rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none';

function Chevron() {
  return (
    <span className="nav-chevron inline-block text-xs leading-none transition-transform" aria-hidden="true">
      ▾
    </span>
  );
}

function suffixedMenuId(menuId: string, suffix?: string): string {
  return suffix ? `${menuId}-${suffix}` : menuId;
}

function MenuButton({
  active,
  children,
  className,
  controls,
  label,
}: {
  active?: boolean;
  children: React.ReactNode;
  className: string;
  controls: string;
  label?: string;
}) {
  return (
    <Button
      aria-controls={controls}
      aria-expanded="false"
      aria-haspopup="menu"
      aria-label={label}
      className={cn(
        'border-0 bg-transparent font-[inherit] text-inherit shadow-none hover:bg-accent hover:text-accent-foreground [&[aria-expanded=true]_.nav-chevron]:rotate-180',
        className,
        active ? 'active' : '',
      )}
      data-nav-trigger=""
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );
}

function NavMenuItem({ idSuffix, item, nested = false }: { idSuffix?: string; item: NavBlockItem; nested?: boolean }) {
  if (!item.children.length) {
    return (
      <li role="none">
        <a className={cn(navMenuItemClass, item.active ? 'active bg-primary/10 text-primary' : '')} data-nav-menuitem="" href={item.href} role="menuitem">
          {item.label}
        </a>
      </li>
    );
  }

  const baseMenuId = item.menuId || `nav-menu-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const menuId = suffixedMenuId(baseMenuId, idSuffix);
  return (
    <li className="nav-dropdown-parent relative list-none" data-nav-dropdown-parent="" role="none">
      {item.hasHref ? (
        <a className={cn(navMenuItemClass, item.active ? 'active bg-primary/10 text-primary' : '')} data-nav-menuitem="" href={item.href} role="menuitem">
          {item.label}
        </a>
      ) : (
        <span className={cn(navMenuItemClass, 'nav-menuitem-parent')}>{item.label}</span>
      )}
      <MenuButton className="nav-chevron-toggle absolute right-1 top-1 h-8 min-h-8 min-w-8 px-2 py-1" controls={menuId} label={`Open ${item.label} submenu`}>
        <Chevron />
      </MenuButton>
      <ul className={nested ? nestedMenuListClass : menuListClass} data-nav-menu="" data-nav-nested-menu={nested ? '' : undefined} role="menu" hidden id={menuId}>
        {item.children.map((child) => (
          <NavMenuItem idSuffix={idSuffix} item={child} key={`${menuId}-${child.label}-${child.href}`} nested />
        ))}
      </ul>
    </li>
  );
}

function NavTopItem({ item, index, overflowCopy = false }: { item: NavBlockItem; index: number; overflowCopy?: boolean }) {
  const indexAttrs = {
    'data-nav-item-index': overflowCopy ? undefined : index,
    'data-nav-overflow-source-index': overflowCopy ? index : undefined,
    hidden: overflowCopy ? true : undefined,
  };
  const idSuffix = overflowCopy ? `overflow-${index}` : undefined;

  if (!item.children.length) {
    return (
      <a className={cn('nav-link', item.active ? 'active' : '')} data-nav-link="" href={item.href} {...indexAttrs}>
        {item.label}
      </a>
    );
  }

  const baseMenuId = item.menuId || `nav-menu-top-${index}`;
  const menuId = suffixedMenuId(baseMenuId, idSuffix);
  const childList = (
    <ul className={menuListClass} data-nav-menu="" role="menu" hidden id={menuId}>
      {item.children.map((child) => (
        <NavMenuItem idSuffix={idSuffix} item={child} key={`${menuId}-${child.label}-${child.href}`} nested />
      ))}
    </ul>
  );

  if (item.hasHref) {
    return (
      <div className={navParentWrapClass} data-nav-item-wrap="" {...indexAttrs}>
        <a className={cn('nav-link nav-parent border-0 bg-transparent font-[inherit]', item.active ? 'active' : '')} data-nav-link="" href={item.href}>
          {item.label}
        </a>
        <MenuButton className="nav-chevron-toggle h-8 min-h-8 min-w-8 self-center px-2 py-1" controls={menuId} label={`Open ${item.label} submenu`}>
          <Chevron />
        </MenuButton>
        {childList}
      </div>
    );
  }

  return (
    <div className={navParentWrapClass} data-nav-item-wrap="" {...indexAttrs}>
      <MenuButton active={item.active} className="nav-link nav-parent nav-parent-button inline-flex items-center gap-1" controls={menuId}>
        {item.label}
        <Chevron />
      </MenuButton>
      {childList}
    </div>
  );
}

function NavBlock({
  blockId,
  desktopOpen,
  items,
  mobileBreakpoint,
  mobileClosedLayout,
  mobileOpenLayout,
  presentationStyle,
  useFullRow,
}: NavBlockProps) {
  const blockAttrs = blockId != null
    ? { 'data-block-id': String(blockId), 'data-block-type': 'nav' }
    : {};

  return (
    <>
      <Button className="nav-toggle" id="nav-toggle" aria-label="Menu" aria-controls="nav-links" aria-expanded="false" data-nav-toggle="" size="icon" type="button" variant="ghost">
        <Menu aria-hidden="true" className="h-5 w-5" />
      </Button>
      <div
        className="nav-links"
        id="nav-links"
        data-block-nav
        data-nav-links
        data-desktop-open={desktopOpen || undefined}
        data-mobile-breakpoint={mobileBreakpoint || undefined}
        data-mobile-closed-layout={mobileClosedLayout || undefined}
        data-mobile-open-layout={mobileOpenLayout || undefined}
        data-nav-full-row={useFullRow ? 'true' : undefined}
        style={presentationStyle}
        {...blockAttrs}
      >
        {items.map((item, index) => (
          <NavTopItem item={item} index={index} key={`${item.label}-${item.href}-${index}`} />
        ))}
      </div>
      <div className="nav-overflow-menu" data-nav-overflow-menu="" hidden id="nav-links-overflow-menu">
        {items.map((item, index) => (
          <NavTopItem item={item} index={index} key={`overflow-${item.label}-${item.href}-${index}`} overflowCopy />
        ))}
      </div>
    </>
  );
}

export function renderNavBlockHtml(props: NavBlockProps): string {
  return renderToStaticMarkup(<NavBlock {...props} />);
}
