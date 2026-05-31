'use client';

import { ExternalLink, Loader2, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button } from '@/components/kychon/ui';
import { get } from '@/lib/api';
import { getRole, getSession, signIn } from '@/lib/auth';

const DEMO_CREDS = {
  admin: { email: 'demo-admin@kychon.com', password: 'demo123' },
  member: { email: 'demo-member@kychon.com', password: 'demo123' },
} as const;

type DemoLoginRole = keyof typeof DEMO_CREDS;
type DemoRole = 'visitor' | 'admin' | 'member';

interface DemoState {
  visible: boolean;
  lastReset: string | null;
}

function readCachedDemoState(): DemoState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('wl_cache_site_config');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.data) ? parsed.data : [];
    let visible = false;
    let lastReset: string | null = null;

    for (const row of rows) {
      if (row?.key === 'demo_mode' && (row.value === true || row.value === 'true')) visible = true;
      if (row?.key === 'last_reset' && typeof row.value === 'string') lastReset = row.value;
    }

    return visible ? { visible, lastReset } : null;
  } catch {
    return null;
  }
}

function resolveDemoRole(): DemoRole {
  const session = getSession();
  if (!session) return 'visitor';

  const email = session.user?.email || '';
  const role = getRole() || (email === DEMO_CREDS.admin.email ? 'admin' : email === DEMO_CREDS.member.email ? 'member' : null);
  return role === 'admin' ? 'admin' : 'member';
}

function nextResetFrom(lastReset: string | null): number | null {
  if (!lastReset) return null;
  const value = new Date(lastReset).getTime();
  return Number.isFinite(value) ? value + 60 * 60 * 1000 : null;
}

interface Props {
  defaultVisible?: boolean;
}

export default function DemoBannerIsland({ defaultVisible = false }: Props) {
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const [demo, setDemo] = useState<DemoState>(() => {
    const cached = typeof localStorage !== 'undefined' ? readCachedDemoState() : null;
    return cached ?? { visible: defaultVisible, lastReset: null };
  });
  const [role, setRole] = useState<DemoRole>('visitor');
  const [pendingRole, setPendingRole] = useState<DemoLoginRole | null>(null);
  const [failedRole, setFailedRole] = useState<DemoLoginRole | null>(null);
  const [countdown, setCountdown] = useState('Resets hourly');

  const refreshRole = useCallback(() => {
    setRole(resolveDemoRole());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadDemoState() {
      try {
        const rows = await get('site_config?key=in.(demo_mode,last_reset)');
        let visible = false;
        let lastReset: string | null = null;

        for (const row of rows) {
          if (row.key === 'demo_mode' && (row.value === true || row.value === 'true')) visible = true;
          if (row.key === 'last_reset' && typeof row.value === 'string') lastReset = row.value;
        }

        if (!cancelled) setDemo({ visible, lastReset });
      } catch {
        // Preserve whatever visibility the initial cached state showed on
        // mount (line 65 useState initializer). Only flip to invisible when
        // no cached state was found — otherwise a transient fetch failure
        // would flash the banner away.
        if (!cancelled) {
          setDemo((current) => (current.visible ? current : { visible: false, lastReset: null }));
        }
      }
    }

    void loadDemoState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refreshRole();
    document.addEventListener('wl-auth-changed', refreshRole);
    document.addEventListener('astro:after-swap', refreshRole);
    return () => {
      document.removeEventListener('wl-auth-changed', refreshRole);
      document.removeEventListener('astro:after-swap', refreshRole);
    };
  }, [refreshRole]);

  useEffect(() => {
    if (!demo.visible) {
      document.documentElement.style.removeProperty('--demo-banner-height');
      return;
    }

    const updateHeight = () => {
      document.documentElement.style.setProperty('--demo-banner-height', `${bannerRef.current?.offsetHeight || 0}px`);
    };
    updateHeight();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateHeight);
    if (bannerRef.current) observer?.observe(bannerRef.current);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [demo.visible]);

  useEffect(() => {
    if (!demo.visible) return;

    let nextResetTime = nextResetFrom(demo.lastReset);
    let cancelled = false;

    async function updateCountdown() {
      if (!nextResetTime) {
        setCountdown('Resets hourly');
        return;
      }

      const now = Date.now();
      const remaining = nextResetTime - now;
      if (remaining > 0) {
        setCountdown(`Resets in ${Math.ceil(remaining / 60000)}m`);
        return;
      }

      try {
        const rows = await get('site_config?key=eq.last_reset');
        const fresh = rows[0]?.value;
        const freshReset = typeof fresh === 'string' ? nextResetFrom(fresh) : null;
        if (freshReset && freshReset > now) {
          nextResetTime = freshReset;
          setCountdown(`Resets in ${Math.ceil((freshReset - now) / 60000)}m`);
          return;
        }
      } catch {
        // Keep the banner usable when demo status checks are unavailable.
      }

      if (!cancelled) setCountdown('Resets hourly');
    }

    void updateCountdown();
    const interval = window.setInterval(() => void updateCountdown(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [demo.visible, demo.lastReset]);

  async function switchRole(nextRole: DemoLoginRole) {
    setPendingRole(nextRole);
    setFailedRole(null);
    try {
      localStorage.removeItem('wl_session');
      await signIn(DEMO_CREDS[nextRole].email, DEMO_CREDS[nextRole].password);
      window.location.reload();
    } catch {
      setFailedRole(nextRole);
      setPendingRole(null);
    }
  }

  function browseAsVisitor() {
    localStorage.removeItem('wl_session');
    window.location.reload();
  }

  if (!demo.visible) return null;

  const busy = pendingRole !== null;
  const showAdmin = role !== 'admin';
  const showMember = role !== 'member';
  const showBrowse = role !== 'visitor';

  const adminLabel = failedRole === 'admin' ? 'Error - retry' : role === 'visitor' ? 'Try as Admin' : 'Switch to Admin';
  const memberLabel = failedRole === 'member' ? 'Error - retry' : role === 'visitor' ? 'Try as Member' : 'Switch to Member';

  return (
    <div
      ref={bannerRef}
      role="banner"
      aria-label="Demo mode"
      className="border-b border-white/10 bg-slate-950 text-slate-50 shadow-sm"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-3 py-2 text-xs sm:flex-nowrap sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Badge className="border-amber-300/60 bg-amber-400 text-slate-950 hover:bg-amber-400">DEMO</Badge>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold">
            {role === 'admin' ? <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> : null}
            {role === 'member' ? <UserRound aria-hidden="true" className="h-3.5 w-3.5" /> : null}
            {role === 'visitor' ? <UsersRound aria-hidden="true" className="h-3.5 w-3.5" /> : null}
            {role === 'visitor' ? 'Visitor' : role === 'admin' ? 'Admin' : 'Member'}
          </span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
          {showAdmin ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 border border-white/20 bg-white/10 px-3 text-xs text-white hover:bg-white/20"
              disabled={busy}
              onClick={() => void switchRole('admin')}
            >
              {pendingRole === 'admin' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ShieldCheck aria-hidden="true" />}
              {pendingRole === 'admin' ? 'Signing in...' : adminLabel}
            </Button>
          ) : null}

          {showMember ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 border border-white/20 bg-white/10 px-3 text-xs text-white hover:bg-white/20"
              disabled={busy}
              onClick={() => void switchRole('member')}
            >
              {pendingRole === 'member' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <UserRound aria-hidden="true" />}
              {pendingRole === 'member' ? 'Signing in...' : memberLabel}
            </Button>
          ) : null}

          {showBrowse ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-xs text-white hover:bg-white/15 hover:text-white"
              disabled={busy}
              onClick={browseAsVisitor}
            >
              Just Browse
            </Button>
          ) : null}
        </div>

        {/*
          The whole right group sits at a fixed width via `basis-[16rem]` +
          `grow-0` + `shrink-0` so it's positionally identical across every
          countdown text change (SSR `Resets hourly` → hydrate `Resets in 38m`
          → 30-second tick → 30-second tick…). With justify-between on the
          outer banner, a fixed-width right group means the middle Admin/Member
          buttons never shift either. Internal `justify-end` keeps countdown +
          CTA hugging the right edge regardless of which is rendered.
        */}
        <div className="flex shrink-0 grow-0 basis-[16rem] items-center justify-end gap-2">
          <span className="inline-block whitespace-nowrap tabular-nums text-white/70">{countdown}</span>
          <Button
            asChild
            size="sm"
            className="hidden h-7 bg-amber-400 px-3 text-xs text-slate-950 hover:bg-amber-500 md:inline-flex"
          >
            <a href="https://kychon.com" target="_blank" rel="noopener noreferrer">
              Get Your Own Portal
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
