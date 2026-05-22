'use client';

import { ChevronDown, Eye, Globe, Plus, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from "@/components/kychon/ui";
import { Button } from "@/components/kychon/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/kychon/ui";
import { get } from '@/lib/api';
import { getRole } from '@/lib/auth';
import { getLocale, setLanguage } from '@/lib/i18n';
import { LOCALE_LABELS, LOCALE_POOL, localeLabel } from '@/lib/locale-pool';
import { ready, siteConfig } from '@/lib/config';

import { AddLanguageDialog } from './AddLanguageIsland';
import { PageCreatorDialog, PageDeleteDialog } from './PageManagementDialogs';

const LS_HIDDEN_KEY = 'wl_admin_bar_hidden';
const ZONE_ADD_EVENT = 'kychon:admin-editor-zone-add';
const ADMIN_PREVIEW_ATTR = 'data-admin-preview';

interface PageRow {
  id: number;
  slug: string;
  title: string;
  show_in_nav?: boolean;
  requires_auth?: boolean;
}

function isAdminRole(role: string | null): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return lower === 'admin' || lower === 'project_admin';
}

function currentSlug(): string {
  if (typeof window === 'undefined') return 'index';
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '') return 'index';
  // Match the existing clean-routes convention: drop leading slash + .html suffix.
  return path.replace(/^\/+/, '').replace(/\.html$/, '');
}

function readEnabledLocales(): string[] {
  const raw = (siteConfig as Record<string, unknown>).languages_enabled ?? (siteConfig as Record<string, unknown>).languages;
  if (Array.isArray(raw)) return raw.filter((entry): entry is string => typeof entry === 'string');
  return ['en'];
}

function readDefaultLocale(): string {
  const value = (siteConfig as Record<string, unknown>).default_language;
  return typeof value === 'string' && value ? value : 'en';
}

export default function AdminBarIsland() {
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [enabledLocales, setEnabledLocales] = useState<string[]>(['en']);
  const [defaultLocale, setDefaultLocale] = useState<string>('en');
  const [activeLocale, setActiveLocale] = useState<string>('en');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PageRow | null>(null);
  const [addLangOpen, setAddLangOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string>('index');

  // Initial mount: wait for site_config to load, then resolve role + locales.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ready;
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      setMounted(true);
      setIsAdmin(isAdminRole(getRole()));
      setEnabledLocales(readEnabledLocales());
      setDefaultLocale(readDefaultLocale());
      setActiveLocale(getLocale() || readDefaultLocale());
      setActiveSlug(currentSlug());
      setHidden(typeof localStorage !== 'undefined' && localStorage.getItem(LS_HIDDEN_KEY) === '1');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh on auth / config / locale changes.
  useEffect(() => {
    function refreshAuth() {
      setIsAdmin(isAdminRole(getRole()));
    }
    function refreshConfig() {
      setEnabledLocales(readEnabledLocales());
      setDefaultLocale(readDefaultLocale());
    }
    function refreshLocale() {
      setActiveLocale(getLocale() || readDefaultLocale());
    }
    function refreshSlug() {
      setActiveSlug(currentSlug());
    }
    document.addEventListener('wl-auth-changed', refreshAuth);
    document.addEventListener('wl-config-changed', refreshConfig);
    document.addEventListener('wl-locale-changed', refreshLocale);
    document.addEventListener('astro:after-swap', refreshSlug);
    return () => {
      document.removeEventListener('wl-auth-changed', refreshAuth);
      document.removeEventListener('wl-config-changed', refreshConfig);
      document.removeEventListener('wl-locale-changed', refreshLocale);
      document.removeEventListener('astro:after-swap', refreshSlug);
    };
  }, []);

  // Load page list lazily when the Pages dropdown opens. We refresh on every
  // open so admins see new/deleted pages without a hard reload.
  const loadPages = useCallback(async () => {
    try {
      const rows = (await get('pages?order=slug.asc')) as PageRow[];
      if (Array.isArray(rows)) setPages(rows);
    } catch (err) {
      console.warn('AdminBar: failed to load pages', err);
    }
  }, []);

  const handleAddBlock = useCallback(() => {
    window.dispatchEvent(new CustomEvent(ZONE_ADD_EVENT, { detail: { zone: 'main' } }));
  }, []);

  const handleTogglePreview = useCallback(() => {
    const next = !previewing;
    setPreviewing(next);
    if (next) {
      document.body.setAttribute(ADMIN_PREVIEW_ATTR, 'true');
    } else {
      document.body.removeAttribute(ADMIN_PREVIEW_ATTR);
    }
  }, [previewing]);

  const handleExit = useCallback(() => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_HIDDEN_KEY, '1');
    setHidden(true);
  }, []);

  const handleSelectLocale = useCallback(async (locale: string) => {
    setActiveLocale(locale);
    try {
      await setLanguage(locale);
      document.dispatchEvent(new CustomEvent('wl-locale-changed'));
    } catch (err) {
      console.warn('AdminBar: setLanguage failed', err);
    }
  }, []);

  const handleNavigate = useCallback((slug: string) => {
    const href = slug === 'index' ? '/' : `/${slug}`;
    window.location.assign(href);
  }, []);

  const localesForSwitcher = useMemo(() => {
    return enabledLocales.length ? enabledLocales : ['en'];
  }, [enabledLocales]);

  const inTranslationMode = activeLocale !== defaultLocale;
  const showLanguageSwitcher = localesForSwitcher.length > 1;

  if (!mounted || !isAdmin || hidden) return null;

  return (
    <div
      className={[
        'sticky top-0 z-[9999] flex h-9 items-center gap-1 border-b border-slate-800 px-3 text-sm',
        inTranslationMode ? 'bg-indigo-950 text-indigo-100' : 'bg-slate-900 text-slate-200',
      ].join(' ')}
      data-admin-bar
      role="toolbar"
      aria-label="Admin bar"
    >
      <span className="mr-2 hidden font-semibold text-white sm:inline">⚡ Kychon</span>

      <DropdownMenu
        onOpenChange={(open) => {
          if (open) void loadPages();
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            Pages
            <ChevronDown className="ml-1 h-3 w-3" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Pages</DropdownMenuLabel>
          {pages.length === 0 ? (
            <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
          ) : (
            pages.map((page) => (
              <DropdownMenuItem
                key={page.id}
                className={[
                  'group flex items-center gap-2',
                  page.slug === activeSlug ? 'font-semibold text-primary' : '',
                ].join(' ')}
                onSelect={() => handleNavigate(page.slug)}
              >
                <span className="flex-1 truncate">{page.title || page.slug}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${page.title || page.slug}`}
                  className="ml-2 h-6 w-6 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  onClick={(event) => {
                    // Stop the click from reaching DropdownMenuItem's onSelect.
                    event.preventDefault();
                    event.stopPropagation();
                    setDeleteTarget(page);
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            New Page
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-slate-200 hover:bg-slate-800 hover:text-white"
        onClick={handleAddBlock}
      >
        <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
        Add Block
      </Button>

      <div className="ml-auto flex items-center gap-1">
        {inTranslationMode ? (
          <Badge variant="secondary" className="h-6 bg-indigo-700 text-indigo-50 hover:bg-indigo-700">
            <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
            Translating: {localeLabel(activeLocale)}
          </Badge>
        ) : null}

        {showLanguageSwitcher ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                <Globe className="mr-1 h-3 w-3" aria-hidden="true" />
                {LOCALE_LABELS[activeLocale] ?? activeLocale.toUpperCase()}
                <ChevronDown className="ml-1 h-3 w-3" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Editing language
              </DropdownMenuLabel>
              {localesForSwitcher.map((code) => (
                <DropdownMenuItem
                  key={code}
                  onSelect={() => {
                    void handleSelectLocale(code);
                  }}
                  className={code === activeLocale ? 'font-semibold text-primary' : ''}
                >
                  {LOCALE_LABELS[code] ?? code}
                  {code === defaultLocale ? (
                    <span className="ml-auto text-xs text-muted-foreground">default</span>
                  ) : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setAddLangOpen(true)}>
                <Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                Add language…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-slate-200 hover:bg-slate-800 hover:text-white"
          onClick={handleTogglePreview}
          aria-pressed={previewing}
        >
          <Eye className="mr-1 h-3 w-3" aria-hidden="true" />
          {previewing ? 'Exit Preview' : 'Preview'}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-white"
          aria-label="Hide admin bar until next login"
          onClick={handleExit}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      <PageCreatorDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(slug) => {
          setCreateOpen(false);
          handleNavigate(slug);
        }}
      />
      <PageDeleteDialog
        page={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={() => {
          setDeleteTarget(null);
          void loadPages();
          // If we just deleted the current page, navigate home.
          if (deleteTarget && deleteTarget.slug === activeSlug) {
            handleNavigate('index');
          }
        }}
      />
      <AddLanguageDialog
        open={addLangOpen}
        onOpenChange={setAddLangOpen}
        currentLocales={enabledLocales}
        pool={LOCALE_POOL}
        onAdded={(code) => {
          setAddLangOpen(false);
          setEnabledLocales((prev) => (prev.includes(code) ? prev : [...prev, code]));
        }}
      />
    </div>
  );
}
