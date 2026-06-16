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

type MenuOpenMode = 'click' | 'hover' | 'keyboard';
type FocusTarget = 'first' | 'last';
type FocusableElement = HTMLAnchorElement | HTMLButtonElement;

interface MenuMeta {
  parentId: string | null;
}

interface NavRuntime {
  closeMenu: (menuId: string, returnFocus?: boolean) => void;
  hoverEnter: (menuId: string) => void;
  hoverLeave: (menuId: string, currentTarget: HTMLElement) => void;
  isMenuOpen: (menuId: string) => boolean;
  isOverflowCopyVisible: (index: number) => boolean;
  isOverflowed: (index: number) => boolean;
  menuItemKeyDown: (menuId: string, index: number, event: React.KeyboardEvent<FocusableElement>) => void;
  openMenu: (menuId: string, focusTarget?: FocusTarget | null, mode?: MenuOpenMode) => void;
  overflowActive: boolean;
  overflowMenuOpen: boolean;
  registerMenuItem: (menuId: string, index: number, node: FocusableElement | null) => void;
  registerTopItem: (index: number, node: HTMLElement | null) => void;
  registerTrigger: (menuId: string, node: HTMLButtonElement | null) => void;
  sourceMobile: boolean;
  toggleMenu: (menuId: string) => void;
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

const navParentWrapClass = cn(
  'relative inline-flex',
  '[[data-nav-overflow-menu]_&]:w-full [[data-nav-overflow-menu]_&]:flex-col [[data-nav-overflow-menu]_&]:items-stretch',
  '[[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:w-full [[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:flex-col [[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:items-stretch',
  '[[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:w-full [[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:flex-col [[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:items-stretch',
);

const menuListClass = cn(
  'absolute left-0 top-full z-50 m-0 ml-[var(--nav-dropdown-offset-x,0)] mt-[var(--nav-dropdown-offset-y,0)] min-w-[var(--nav-dropdown-width,12rem)] list-none rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md',
  '[[data-nav-overflow-menu]_&]:static [[data-nav-overflow-menu]_&]:ml-0 [[data-nav-overflow-menu]_&]:mt-0 [[data-nav-overflow-menu]_&]:w-full [[data-nav-overflow-menu]_&]:min-w-0 [[data-nav-overflow-menu]_&]:border-0 [[data-nav-overflow-menu]_&]:bg-transparent [[data-nav-overflow-menu]_&]:pl-6 [[data-nav-overflow-menu]_&]:shadow-none',
  '[[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:static [[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:ml-0 [[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:mt-0 [[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:w-full [[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:border-0 [[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:bg-transparent [[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:pl-6 [[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:shadow-none',
  '[[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:static [[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:ml-0 [[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:mt-0 [[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:w-full [[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:border-0 [[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:bg-transparent [[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:pl-6 [[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:shadow-none',
);

const nestedMenuListClass = cn(
  menuListClass,
  'left-full top-0 ml-1 mt-0',
  '[[data-nav-overflow-menu]_&]:pl-6',
  '[[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]:pl-6',
  '[[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]:pl-6',
);

// No base text-color utility here: globals.css imports public.css into
// `@layer components` and Tailwind utilities into the later `@layer
// utilities`, so a `text-muted-foreground` utility would win over the
// config-driven dropdown/mobile color rules in public.css regardless of
// their specificity (that shadowing is why the nav dropdown_* config was
// dead on deploy). The resting color is owned by public.css
// `[data-nav-menu] [data-nav-menuitem]` (desktop = --nav-dropdown-color,
// mobile/overflow = --nav-link-color); the hover/focus accent utilities
// stay as a deliberate legible pairing.
const navMenuItemClass = 'block rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none';

function Chevron() {
  return (
    <span className="inline-block text-xs leading-none transition-transform" data-nav-chevron="" aria-hidden="true">
      ▾
    </span>
  );
}

function suffixedMenuId(menuId: string, suffix?: string): string {
  return suffix ? `${menuId}-${suffix}` : menuId;
}

function focusableCount(item: NavBlockItem): number {
  if (!item.children.length) return 1;
  return item.hasHref ? 2 : 1;
}

function collectMenuMeta(items: NavBlockItem[], idSuffix: string | undefined, parentId: string | null, out: Map<string, MenuMeta>): void {
  items.forEach((item, index) => {
    if (!item.children.length) return;
    const baseMenuId = item.menuId || `nav-menu-top-${index}`;
    const menuId = suffixedMenuId(baseMenuId, idSuffix);
    out.set(menuId, { parentId });
    collectMenuMeta(item.children, idSuffix, menuId, out);
  });
}

function menuMetaForItems(items: NavBlockItem[]): Map<string, MenuMeta> {
  const out = new Map<string, MenuMeta>();
  collectMenuMeta(items, undefined, null, out);
  items.forEach((item, index) => collectMenuMeta([item], `overflow-${index}`, null, out));
  return out;
}

function isDescendantMenu(menuMeta: Map<string, MenuMeta>, menuId: string, ancestorId: string): boolean {
  let parentId = menuMeta.get(menuId)?.parentId ?? null;
  while (parentId) {
    if (parentId === ancestorId) return true;
    parentId = menuMeta.get(parentId)?.parentId ?? null;
  }
  return false;
}

function ancestorMenus(menuMeta: Map<string, MenuMeta>, menuId: string): Set<string> {
  const out = new Set<string>();
  let parentId = menuMeta.get(menuId)?.parentId ?? null;
  while (parentId) {
    out.add(parentId);
    parentId = menuMeta.get(parentId)?.parentId ?? null;
  }
  return out;
}

function readGap(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  return Number.parseFloat(style.columnGap || style.gap || '0') || 0;
}

function MenuButton({
  active,
  children,
  className,
  controls,
  menuItem,
  parentTrigger,
  label,
  runtime,
}: {
  active?: boolean;
  children: React.ReactNode;
  className: string;
  controls: string;
  menuItem?: { index: number; menuId: string };
  parentTrigger?: boolean;
  label?: string;
  runtime: NavRuntime;
}) {
  const expanded = runtime.isMenuOpen(controls);
  return (
    <Button
      aria-controls={controls}
      aria-expanded={expanded ? 'true' : 'false'}
      aria-haspopup="menu"
      aria-label={label}
      className={cn(
        'border-0 bg-transparent font-[inherit] text-inherit shadow-none hover:bg-accent hover:text-accent-foreground [&[aria-expanded=true]_[data-nav-chevron]]:rotate-180',
        className,
      )}
      data-nav-active={active ? 'true' : undefined}
      data-nav-parent-trigger={parentTrigger ? '' : undefined}
      data-nav-trigger=""
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        runtime.toggleMenu(controls);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          runtime.openMenu(controls, 'first', 'keyboard');
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          runtime.openMenu(controls, 'last', 'keyboard');
        } else if (event.key === 'Escape') {
          event.preventDefault();
          runtime.closeMenu(controls);
        }
      }}
      ref={(node) => {
        runtime.registerTrigger(controls, node);
        if (menuItem) runtime.registerMenuItem(menuItem.menuId, menuItem.index, node);
      }}
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );
}

function MenuAnchor({
  children,
  className,
  href,
  index,
  menuId,
  active,
  runtime,
}: {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  href: string;
  index: number;
  menuId: string;
  runtime: NavRuntime;
}) {
  return (
    <a
      className={cn(navMenuItemClass, className)}
      data-nav-active={active ? 'true' : undefined}
      data-nav-menuitem=""
      href={href}
      onKeyDown={(event) => runtime.menuItemKeyDown(menuId, index, event)}
      ref={(node) => runtime.registerMenuItem(menuId, index, node)}
      role="menuitem"
    >
      {children}
    </a>
  );
}

function NavMenuList({
  childrenItems,
  idSuffix,
  menuId,
  nested = false,
  runtime,
}: {
  childrenItems: NavBlockItem[];
  idSuffix?: string;
  menuId: string;
  nested?: boolean;
  runtime: NavRuntime;
}) {
  let focusIndex = 0;
  return (
    <ul
      className={nested ? nestedMenuListClass : menuListClass}
      data-nav-menu=""
      data-nav-nested-menu={nested ? '' : undefined}
      role="menu"
      hidden={!runtime.isMenuOpen(menuId)}
      id={menuId}
    >
      {childrenItems.map((child) => {
        const itemFocusIndex = focusIndex;
        focusIndex += focusableCount(child);
        return (
          <NavMenuItem
            idSuffix={idSuffix}
            item={child}
            key={`${menuId}-${child.label}-${child.href}`}
            menuId={menuId}
            focusIndex={itemFocusIndex}
            nested
            runtime={runtime}
          />
        );
      })}
    </ul>
  );
}

function NavMenuItem({
  focusIndex = 0,
  idSuffix,
  item,
  menuId,
  nested = false,
  runtime,
}: {
  focusIndex?: number;
  idSuffix?: string;
  item: NavBlockItem;
  menuId: string;
  nested?: boolean;
  runtime: NavRuntime;
}) {
  if (!item.children.length) {
    return (
      <li role="none">
        <MenuAnchor active={item.active} href={item.href} index={focusIndex} menuId={menuId} runtime={runtime}>
          {item.label}
        </MenuAnchor>
      </li>
    );
  }

  const baseMenuId = item.menuId || `nav-menu-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const childMenuId = suffixedMenuId(baseMenuId, idSuffix);
  const triggerIndex = item.hasHref ? focusIndex + 1 : focusIndex;
  return (
    <li
      className="relative list-none"
      data-nav-dropdown-parent=""
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) runtime.closeMenu(childMenuId);
      }}
      onMouseEnter={() => runtime.hoverEnter(childMenuId)}
      onMouseLeave={(event) => runtime.hoverLeave(childMenuId, event.currentTarget)}
      role="none"
    >
      {item.hasHref ? (
        <MenuAnchor active={item.active} href={item.href} index={focusIndex} menuId={menuId} runtime={runtime}>
          {item.label}
        </MenuAnchor>
      ) : (
        <span className={navMenuItemClass} data-nav-menuitem-parent="">{item.label}</span>
      )}
      <MenuButton
        className="absolute right-1 top-1 h-8 min-h-8 min-w-8 px-2 py-1"
        controls={childMenuId}
        label={`Open ${item.label} submenu`}
        menuItem={{ menuId, index: triggerIndex }}
        runtime={runtime}
      >
        <Chevron />
      </MenuButton>
      <NavMenuList childrenItems={item.children} idSuffix={idSuffix} menuId={childMenuId} nested={nested} runtime={runtime} />
    </li>
  );
}

function NavTopItem({
  item,
  index,
  overflowCopy = false,
  runtime,
}: {
  item: NavBlockItem;
  index: number;
  overflowCopy?: boolean;
  runtime: NavRuntime;
}) {
  const hidden = overflowCopy ? !runtime.isOverflowCopyVisible(index) : undefined;
  const overflowed = !overflowCopy && runtime.isOverflowed(index);
  const indexAttrs = {
    'data-nav-item-index': overflowCopy ? undefined : index,
    'data-nav-overflow-source-index': overflowCopy ? index : undefined,
    'data-nav-overflowed': overflowed ? 'true' : undefined,
    hidden,
  };
  const idSuffix = overflowCopy ? `overflow-${index}` : undefined;
  const topItemRef = overflowCopy ? undefined : (node: HTMLElement | null) => runtime.registerTopItem(index, node);

  if (!item.children.length) {
    return (
      <a
        data-nav-active={item.active ? 'true' : undefined}
        data-nav-link=""
        href={item.href}
        ref={topItemRef as React.Ref<HTMLAnchorElement>}
        {...indexAttrs}
      >
        {item.label}
      </a>
    );
  }

  const baseMenuId = item.menuId || `nav-menu-top-${index}`;
  const menuId = suffixedMenuId(baseMenuId, idSuffix);
  const childList = (
    <NavMenuList childrenItems={item.children} idSuffix={idSuffix} menuId={menuId} runtime={runtime} />
  );

  if (item.hasHref) {
    return (
      <div
        className={navParentWrapClass}
        data-nav-item-wrap=""
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) runtime.closeMenu(menuId);
        }}
        onMouseEnter={() => runtime.hoverEnter(menuId)}
        onMouseLeave={(event) => runtime.hoverLeave(menuId, event.currentTarget)}
        ref={topItemRef as React.Ref<HTMLDivElement>}
        {...indexAttrs}
      >
        <a className="border-0 bg-transparent font-[inherit]" data-nav-active={item.active ? 'true' : undefined} data-nav-link="" data-nav-parent-link="" href={item.href}>
          {item.label}
        </a>
        <MenuButton className="h-8 min-h-8 min-w-8 self-center px-2 py-1" controls={menuId} label={`Open ${item.label} submenu`} runtime={runtime}>
          <Chevron />
        </MenuButton>
        {childList}
      </div>
    );
  }

  return (
    <div
      className={navParentWrapClass}
      data-nav-item-wrap=""
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) runtime.closeMenu(menuId);
      }}
      onMouseEnter={() => runtime.hoverEnter(menuId)}
      onMouseLeave={(event) => runtime.hoverLeave(menuId, event.currentTarget)}
      ref={topItemRef as React.Ref<HTMLDivElement>}
      {...indexAttrs}
    >
      <MenuButton active={item.active} className="inline-flex items-center gap-1" controls={menuId} parentTrigger runtime={runtime}>
        {item.label}
        <Chevron />
      </MenuButton>
      {childList}
    </div>
  );
}

function useNavRuntime(
  hostRef: React.RefObject<HTMLDivElement | null>,
  linksRef: React.RefObject<HTMLDivElement | null>,
  toggleRef: React.RefObject<HTMLButtonElement | null>,
  items: NavBlockItem[],
  mobileBreakpoint?: number | null,
) {
  const menuMeta = React.useMemo(() => menuMetaForItems(items), [items]);
  const [openMenus, setOpenMenus] = React.useState<Record<string, MenuOpenMode>>({});
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [sourceMobile, setSourceMobile] = React.useState(false);
  const [overflow, setOverflow] = React.useState(false);
  const [overflowOpen, setOverflowOpen] = React.useState(false);
  const [overflowedIndexes, setOverflowedIndexes] = React.useState<Set<number>>(() => new Set());
  const [pendingFocus, setPendingFocus] = React.useState<{ menuId: string; target: FocusTarget } | null>(null);
  const topItemRefs = React.useRef(new Map<number, HTMLElement>());
  const topItemWidths = React.useRef(new Map<number, number>());
  const triggerRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const menuItemRefs = React.useRef(new Map<string, FocusableElement[]>());

  const removeMenuAndDescendants = React.useCallback((current: Record<string, MenuOpenMode>, menuId: string): Record<string, MenuOpenMode> => {
    const next: Record<string, MenuOpenMode> = {};
    for (const [id, mode] of Object.entries(current)) {
      if (id === menuId || isDescendantMenu(menuMeta, id, menuId)) continue;
      next[id] = mode;
    }
    return next;
  }, [menuMeta]);

  const openMenu = React.useCallback((menuId: string, focusTarget: FocusTarget | null = null, mode: MenuOpenMode = focusTarget ? 'keyboard' : 'click') => {
    const ancestors = ancestorMenus(menuMeta, menuId);
    setOpenMenus((current) => {
      const next: Record<string, MenuOpenMode> = {};
      for (const [id, openMode] of Object.entries(current)) {
        if (ancestors.has(id)) next[id] = openMode;
      }
      next[menuId] = mode;
      return next;
    });
    if (focusTarget) setPendingFocus({ menuId, target: focusTarget });
  }, [menuMeta]);

  const closeMenu = React.useCallback((menuId: string, returnFocus = false) => {
    setOpenMenus((current) => removeMenuAndDescendants(current, menuId));
    if (returnFocus) triggerRefs.current.get(menuId)?.focus();
  }, [removeMenuAndDescendants]);

  const closeAllMenus = React.useCallback(() => {
    setOpenMenus({});
  }, []);

  const toggleMenu = React.useCallback((menuId: string) => {
    setOpenMenus((current) => {
      if (current[menuId] && current[menuId] !== 'hover') {
        return removeMenuAndDescendants(current, menuId);
      }
      const ancestors = ancestorMenus(menuMeta, menuId);
      const next: Record<string, MenuOpenMode> = {};
      for (const [id, openMode] of Object.entries(current)) {
        if (ancestors.has(id)) next[id] = openMode;
      }
      next[menuId] = 'click';
      return next;
    });
  }, [menuMeta, removeMenuAndDescendants]);

  const hoverEnter = React.useCallback((menuId: string) => {
    setOpenMenus((current) => {
      if (current[menuId] === 'click') return current;
      const ancestors = ancestorMenus(menuMeta, menuId);
      const next: Record<string, MenuOpenMode> = {};
      for (const [id, openMode] of Object.entries(current)) {
        if (ancestors.has(id) || openMode === 'click') next[id] = openMode;
      }
      next[menuId] = 'hover';
      return next;
    });
  }, [menuMeta]);

  const hoverLeave = React.useCallback((menuId: string, currentTarget: HTMLElement) => {
    const active = document.activeElement;
    if (active && currentTarget.contains(active)) return;
    setOpenMenus((current) => current[menuId] === 'click' ? current : removeMenuAndDescendants(current, menuId));
  }, [removeMenuAndDescendants]);

  const registerTopItem = React.useCallback((index: number, node: HTMLElement | null) => {
    if (node) {
      topItemRefs.current.set(index, node);
      const width = node.getBoundingClientRect().width;
      if (width > 0) topItemWidths.current.set(index, width);
    } else {
      topItemRefs.current.delete(index);
    }
  }, []);

  const registerTrigger = React.useCallback((menuId: string, node: HTMLButtonElement | null) => {
    if (node) triggerRefs.current.set(menuId, node);
    else triggerRefs.current.delete(menuId);
  }, []);

  const registerMenuItem = React.useCallback((menuId: string, index: number, node: FocusableElement | null) => {
    const current = menuItemRefs.current.get(menuId) || [];
    if (node) current[index] = node;
    else delete current[index];
    menuItemRefs.current.set(menuId, current);
  }, []);

  const focusMenuItem = React.useCallback((menuId: string, target: FocusTarget) => {
    const candidates = (menuItemRefs.current.get(menuId) || []).filter(Boolean);
    const node = target === 'first' ? candidates[0] : candidates[candidates.length - 1];
    node?.focus();
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!pendingFocus) return;
    focusMenuItem(pendingFocus.menuId, pendingFocus.target);
    setPendingFocus(null);
  }, [focusMenuItem, pendingFocus]);

  const focusSibling = React.useCallback((menuId: string, index: number, direction: 1 | -1) => {
    const candidates = (menuItemRefs.current.get(menuId) || []).filter(Boolean);
    const currentIndex = candidates.findIndex((node) => node === document.activeElement);
    const baseIndex = currentIndex >= 0 ? currentIndex : candidates.findIndex((node) => node === menuItemRefs.current.get(menuId)?.[index]);
    if (baseIndex < 0 || candidates.length === 0) return;
    candidates[(baseIndex + direction + candidates.length) % candidates.length]?.focus();
  }, []);

  const menuItemKeyDown = React.useCallback((menuId: string, index: number, event: React.KeyboardEvent<FocusableElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusSibling(menuId, index, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusSibling(menuId, index, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusMenuItem(menuId, 'first');
    } else if (event.key === 'End') {
      event.preventDefault();
      focusMenuItem(menuId, 'last');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(menuId, true);
    } else if (event.key === 'Tab') {
      closeMenu(menuId);
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (event.currentTarget.tagName.toLowerCase() === 'a') {
        if (event.key === ' ') {
          event.preventDefault();
          event.currentTarget.click();
        }
        closeAllMenus();
      }
    }
  }, [closeAllMenus, closeMenu, focusMenuItem, focusSibling]);

  const measureResponsiveState = React.useCallback(() => {
    const links = linksRef.current;
    if (!links) return;
    const nextSourceMobile = !!mobileBreakpoint && window.innerWidth <= mobileBreakpoint;
    const nextOverflowed = new Set<number>();
    let nextOverflow = false;

    if (!nextSourceMobile) {
      const linksWidth = links.getBoundingClientRect().width;
      let available = linksWidth;
      let container = links.parentElement;
      while (container) {
        const width = container.getBoundingClientRect().width;
        if (width > 0) available = Math.min(available, width);
        container = container.parentElement;
      }
      const orderedItems = items.map((_, index) => {
        const node = topItemRefs.current.get(index);
        return node ? { index, node } : null;
      }).filter((item): item is { index: number; node: HTMLElement } => !!item);
      if (available > 0 && orderedItems.length) {
        const gap = readGap(links);
        const widthForItem = (item: { index: number; node: HTMLElement }): number => {
          const width = item.node.getBoundingClientRect().width;
          if (width > 0) {
            topItemWidths.current.set(item.index, width);
            return width;
          }
          return topItemWidths.current.get(item.index) || 0;
        };
        const total = orderedItems.reduce((sum, item, index) => sum + widthForItem(item) + (index > 0 ? gap : 0), 0);
        if (total > available) {
          nextOverflow = true;
          const reserved = (toggleRef.current?.getBoundingClientRect().width || 36) + gap;
          const fitWidth = Math.max(0, available - reserved);
          let used = 0;
          let overflowing = false;
          orderedItems.forEach((item, index) => {
            const width = widthForItem(item) + (index > 0 ? gap : 0);
            if (!overflowing && used + width <= fitWidth) {
              used += width;
            } else {
              overflowing = true;
              nextOverflowed.add(index);
            }
          });
        }
      }
    }

    setSourceMobile(nextSourceMobile);
    setOverflow(nextOverflow && nextOverflowed.size > 0);
    setOverflowedIndexes(nextOverflowed);
    if (!nextSourceMobile) setMobileOpen(false);
    if (nextSourceMobile || !nextOverflow || nextOverflowed.size === 0) setOverflowOpen(false);
  }, [items, linksRef, mobileBreakpoint, toggleRef]);

  useIsomorphicLayoutEffect(() => {
    measureResponsiveState();
    const onResize = () => measureResponsiveState();
    window.addEventListener('resize', onResize);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
    if (resizeObserver && linksRef.current) resizeObserver.observe(linksRef.current);
    return () => {
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
    };
  }, [measureResponsiveState, linksRef]);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && host.contains(target)) return;
      closeAllMenus();
      setOverflowOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, [closeAllMenus, hostRef]);

  const overflowActive = overflow && !sourceMobile && overflowedIndexes.size > 0;

  const runtime = React.useMemo<NavRuntime>(() => ({
    closeMenu,
    hoverEnter,
    hoverLeave,
    isMenuOpen: (menuId) => !!openMenus[menuId],
    isOverflowCopyVisible: (index) => overflowActive && overflowedIndexes.has(index),
    isOverflowed: (index) => overflowActive && overflowedIndexes.has(index),
    menuItemKeyDown,
    openMenu,
    overflowActive,
    overflowMenuOpen: overflowOpen,
    registerMenuItem,
    registerTopItem,
    registerTrigger,
    sourceMobile,
    toggleMenu,
  }), [
    closeMenu,
    hoverEnter,
    hoverLeave,
    menuItemKeyDown,
    openMenu,
    openMenus,
    overflowActive,
    overflowOpen,
    overflowedIndexes,
    registerMenuItem,
    registerTopItem,
    registerTrigger,
    sourceMobile,
    toggleMenu,
  ]);

  return {
    mobileOpen,
    overflowActive,
    overflowMenuOpen: overflowOpen,
    runtime,
    setMobileOpen,
    setOverflowOpen,
    sourceMobile,
  };
}

export function NavBlockContent({
  blockId,
  desktopOpen,
  items,
  mobileBreakpoint,
  mobileClosedLayout,
  mobileOpenLayout,
  presentationStyle,
  useFullRow,
}: NavBlockProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const linksRef = React.useRef<HTMLDivElement | null>(null);
  const toggleRef = React.useRef<HTMLButtonElement | null>(null);
  const { mobileOpen, overflowActive, overflowMenuOpen, runtime, setMobileOpen, setOverflowOpen, sourceMobile } =
    useNavRuntime(hostRef, linksRef, toggleRef, items, mobileBreakpoint);
  const blockAttrs = blockId != null
    ? { 'data-block-id': String(blockId), 'data-block-type': 'nav' }
    : {};
  const overflowMenuId = 'nav-links-overflow-menu';
  const toggleControls = overflowActive ? overflowMenuId : 'nav-links';
  const toggleExpanded = overflowActive ? overflowMenuOpen : mobileOpen;

  return (
    <div className="contents" data-nav-react-root ref={hostRef}>
      <Button
        id="nav-toggle"
        aria-label="Menu"
        aria-controls={toggleControls}
        aria-expanded={toggleExpanded ? 'true' : 'false'}
        data-nav-overflow={overflowActive ? 'true' : undefined}
        data-nav-source-mobile={sourceMobile ? 'true' : undefined}
        data-nav-toggle=""
        onClick={(event) => {
          event.preventDefault();
          if (overflowActive) {
            setMobileOpen(false);
            setOverflowOpen((open) => !open);
            return;
          }
          setOverflowOpen(false);
          setMobileOpen((open) => !open);
        }}
        ref={toggleRef}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </Button>
      <div
        id="nav-links"
        data-block-nav
        data-nav-links
        data-desktop-open={desktopOpen || undefined}
        data-mobile-breakpoint={mobileBreakpoint || undefined}
        data-mobile-closed-layout={mobileClosedLayout || undefined}
        data-mobile-open-layout={mobileOpenLayout || undefined}
        data-nav-full-row={useFullRow ? 'true' : undefined}
        data-nav-mobile-open={mobileOpen ? 'true' : undefined}
        data-nav-overflow={overflowActive ? 'true' : undefined}
        data-nav-source-mobile={sourceMobile ? 'true' : undefined}
        ref={linksRef}
        style={presentationStyle}
        {...blockAttrs}
      >
        {items.map((item, index) => (
          <NavTopItem item={item} index={index} key={`${item.label}-${item.href}-${index}`} runtime={runtime} />
        ))}
      </div>
      <div data-nav-overflow-menu="" hidden={!overflowMenuOpen} id={overflowMenuId}>
        {items.map((item, index) => (
          <NavTopItem item={item} index={index} key={`overflow-${item.label}-${item.href}-${index}`} overflowCopy runtime={runtime} />
        ))}
      </div>
    </div>
  );
}

function NavBlock(props: NavBlockProps) {
  return (
    <div className="contents" data-block-hydrate="nav" data-nav-props={JSON.stringify(props)}>
      <NavBlockContent {...props} />
    </div>
  );
}

export function renderNavBlockHtml(props: NavBlockProps): string {
  return renderToStaticMarkup(<NavBlock {...props} />);
}
