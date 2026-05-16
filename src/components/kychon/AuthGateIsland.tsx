'use client';

import { Home, LockKeyhole, ShieldAlert } from 'lucide-react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/kychon/ui';
import { openAuthModal } from '../../lib/auth-modal-events';
import type { AuthGateKind } from '../../lib/auth-gate';
import { constrainedContainerClass } from '../../lib/ui/container';

interface GateCopy {
  title: string;
  body: string;
  showSignIn: boolean;
}

interface AuthGateProps {
  backLabel: string;
  copy: GateCopy;
  kind: AuthGateKind;
  signInLabel: string;
}

const roots = new WeakMap<HTMLElement, Root>();

export function AuthGate({ backLabel, copy, kind, signInLabel }: AuthGateProps) {
  const Icon = kind === 'admin' ? ShieldAlert : LockKeyhole;

  function openSignIn(event: React.MouseEvent<HTMLButtonElement>) {
    openAuthModal({ trigger: event.currentTarget });
    // The gate replaces the page's interactive content, so the page's own
    // wl-auth-changed listener cannot repaint it. Reload once sign-in finishes.
    document.addEventListener('wl-auth-changed', () => window.location.reload(), {
      once: true,
    });
  }

  return (
    <div className={`${constrainedContainerClass} flex justify-center py-8`} data-auth-gate={kind} data-layout-container>
      <Card className="w-full max-w-lg text-center" role="status" aria-live="polite">
        <CardHeader className="items-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon aria-hidden="true" className="h-6 w-6" />
          </span>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.body}</CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="flex flex-wrap justify-center gap-2">
          {copy.showSignIn ? (
            <Button type="button" onClick={openSignIn}>
              {signInLabel}
            </Button>
          ) : null}
          <Button asChild type="button" variant="secondary">
            <a href="/">
              <Home aria-hidden="true" />
              {backLabel}
            </a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export function mountAuthGate(targetSelector: string, props: AuthGateProps): void {
  const target = document.querySelector<HTMLElement>(targetSelector);
  if (!target) return;

  let root = roots.get(target);
  if (!root) {
    root = createRoot(target);
    roots.set(target, root);
  }

  flushSync(() => {
    root.render(<AuthGate {...props} />);
  });
}
