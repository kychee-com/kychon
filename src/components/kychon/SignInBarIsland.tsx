import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Languages, LogOut, Moon, Sun, UserRound } from 'lucide-react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/kychon/ui';
import { getSession } from '@/lib/auth';
import { openAuthModal } from '@/lib/auth-modal-events';
import { getAvailableLocales, getLocale, setLanguage, t } from '@/lib/i18n';

interface SignInBarProps {
  showLangToggle: boolean;
  showThemeToggle: boolean;
}

interface PortalSession {
  user?: {
    avatar_url?: string | null;
    display_name?: string | null;
    email?: string | null;
    member?: {
      display_name?: string | null;
      email?: string | null;
    } | null;
  } | null;
}

type ThemeChoice = 'dark' | 'light';

const roots = new WeakMap<HTMLElement, Root>();
const localeLabels: Record<string, string> = {
  de: 'DE',
  en: 'EN',
  es: 'ES',
  fr: 'FR',
  ja: 'JA',
  ko: 'KO',
  pt: 'PT',
  zh: 'ZH',
};

function readSession(): PortalSession | null {
  try {
    return getSession() as PortalSession | null;
  } catch {
    return null;
  }
}

function readTheme(): ThemeChoice {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function accountLabel(session: PortalSession): string {
  return (
    session.user?.display_name ||
    session.user?.member?.display_name ||
    session.user?.email ||
    session.user?.member?.email ||
    'Account'
  );
}

function localeLabel(locale: string): string {
  return localeLabels[locale] || locale.toUpperCase();
}

function SignInBarIsland({ showLangToggle, showThemeToggle }: SignInBarProps) {
  const [session, setSession] = React.useState<PortalSession | null>(() => readSession());
  const [theme, setTheme] = React.useState<ThemeChoice>(() => readTheme());
  const [locale, setLocale] = React.useState(() => getLocale());
  const [locales, setLocales] = React.useState(() => getAvailableLocales());

  React.useEffect(() => {
    const sync = () => {
      setSession(readSession());
      setTheme(readTheme());
      setLocale(getLocale());
      setLocales(getAvailableLocales());
    };

    document.addEventListener('wl-auth-changed', sync);
    document.addEventListener('wl-locale-changed', sync);
    return () => {
      document.removeEventListener('wl-auth-changed', sync);
      document.removeEventListener('wl-locale-changed', sync);
    };
  }, []);

  function toggleTheme(): void {
    const next: ThemeChoice = readTheme() === 'dark' ? 'light' : 'dark';
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('wl_theme', next);
    setTheme(next);
  }

  async function cycleLanguage(): Promise<void> {
    const index = locales.indexOf(locale);
    const next = locales[(index + 1) % locales.length] || locales[0];
    if (!next) return;
    await setLanguage(next);
    setLocale(next);
    document.dispatchEvent(new CustomEvent('wl-locale-changed', { detail: { locale: next } }));
  }

  function signOut(): void {
    localStorage.removeItem('wl_session');
    document.dispatchEvent(new CustomEvent('wl-auth-changed'));
    window.location.href = '/';
  }

  const showLanguage = showLangToggle && locales.length >= 2;

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      {showLanguage && (
        <Button
          aria-label="Switch language"
          className="h-8 w-8 px-0 text-xs"
          id="lang-toggle"
          onClick={() => void cycleLanguage()}
          size="icon"
          title="Switch language"
          type="button"
          variant="outline"
        >
          <Languages className="sr-only" aria-hidden="true" />
          {localeLabel(locale)}
        </Button>
      )}

      {showThemeToggle && (
        <Button
          aria-label="Toggle dark mode"
          className="h-8 w-8"
          id="theme-toggle"
          onClick={toggleTheme}
          size="icon"
          title="Toggle dark mode"
          type="button"
          variant="outline"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      )}

      {session ? (
        <AccountMenu session={session} onSignOut={signOut} />
      ) : (
        <Button
          className="h-8 whitespace-nowrap px-3 text-xs"
          id="login-btn"
          onClick={(event) => openAuthModal({ trigger: event.currentTarget })}
          size="sm"
          type="button"
        >
          {t('nav.sign_in')}
        </Button>
      )}
    </div>
  );
}

function AccountMenu({
  session,
  onSignOut,
}: {
  session: PortalSession;
  onSignOut: () => void;
}) {
  const label = accountLabel(session);
  const avatarUrl = session.user?.avatar_url || '';
  const fallback = (label[0] || '?').toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`${label} account menu`}
          className="h-8 w-8 overflow-hidden rounded-full p-0"
          size="icon"
          type="button"
          variant="ghost"
        >
          {avatarUrl ? (
            <img className="h-8 w-8 rounded-full object-cover" src={avatarUrl} alt="" width="32" height="32" />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              data-nav-avatar-fallback
            >
              {fallback}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <a href="/profile">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            {t('nav.profile')}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem id="logout-btn" onSelect={onSignOut}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t('nav.sign_out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function mountSignInBarIsland(element: HTMLElement, props: SignInBarProps): void {
  let root = roots.get(element);
  if (!root) {
    root = createRoot(element);
    roots.set(element, root);
  }
  root.render(<SignInBarIsland {...props} />);
}
