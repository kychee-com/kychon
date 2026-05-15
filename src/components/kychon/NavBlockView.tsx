import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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

function Chevron() {
  return (
    <span className="nav-chevron" aria-hidden="true">
      ▾
    </span>
  );
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
      className={cn(className, active ? 'active' : '')}
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );
}

function NavMenuItem({ item, nested = false }: { item: NavBlockItem; nested?: boolean }) {
  if (!item.children.length) {
    return (
      <li role="none">
        <a className={cn('nav-menuitem', item.active ? 'active' : '')} href={item.href} role="menuitem">
          {item.label}
        </a>
      </li>
    );
  }

  const menuId = item.menuId || `nav-menu-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <li className="nav-dropdown-parent" role="none">
      {item.hasHref ? (
        <a className={cn('nav-menuitem', item.active ? 'active' : '')} href={item.href} role="menuitem">
          {item.label}
        </a>
      ) : (
        <span className="nav-menuitem nav-menuitem-parent">{item.label}</span>
      )}
      <MenuButton className="nav-chevron-toggle" controls={menuId} label={`Open ${item.label} submenu`}>
        <Chevron />
      </MenuButton>
      <ul className={cn('nav-dropdown', nested ? 'nav-dropdown-nested' : '')} role="menu" hidden id={menuId}>
        {item.children.map((child) => (
          <NavMenuItem item={child} key={`${menuId}-${child.label}-${child.href}`} nested />
        ))}
      </ul>
    </li>
  );
}

function NavTopItem({ item, index }: { item: NavBlockItem; index: number }) {
  if (!item.children.length) {
    return (
      <a className={cn('nav-link', item.active ? 'active' : '')} href={item.href}>
        {item.label}
      </a>
    );
  }

  const menuId = item.menuId || `nav-menu-top-${index}`;
  const childList = (
    <ul className="nav-dropdown" role="menu" hidden id={menuId}>
      {item.children.map((child) => (
        <NavMenuItem item={child} key={`${menuId}-${child.label}-${child.href}`} nested />
      ))}
    </ul>
  );

  if (item.hasHref) {
    return (
      <div className="nav-item-wrap">
        <a className={cn('nav-link nav-parent', item.active ? 'active' : '')} href={item.href}>
          {item.label}
        </a>
        <MenuButton className="nav-chevron-toggle" controls={menuId} label={`Open ${item.label} submenu`}>
          <Chevron />
        </MenuButton>
        {childList}
      </div>
    );
  }

  return (
    <div className="nav-item-wrap">
      <MenuButton active={item.active} className="nav-link nav-parent nav-parent-button" controls={menuId}>
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
      <button className="nav-toggle" id="nav-toggle" aria-label="Menu" aria-controls="nav-links" aria-expanded="false" type="button">
        ☰
      </button>
      <div
        className="nav-links"
        id="nav-links"
        data-block-nav
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
    </>
  );
}

export function renderNavBlockHtml(props: NavBlockProps): string {
  return renderToStaticMarkup(<NavBlock {...props} />);
}
