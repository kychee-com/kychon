import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { KeyRound } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/components/kychon/ui';
import type { AuthModalOpenDetail } from '@/lib/auth-modal-events';
import {
  passkeysSupported,
  requestGoogleConnectionLink,
  signIn,
  signInWithGoogle,
  signInWithPasskey,
  signUp,
} from '@/lib/auth';
import { AUTH_OPEN_EVENT, consumePendingAuthModalOpen } from '@/lib/auth-modal-events';
import { init } from '@/lib/config';

type Mode = 'sign-in' | 'sign-up';
type Flow = 'standard' | 'connect-google';
type Message = { type: 'error' | 'success'; text: string } | null;
type OpenHandler = (detail?: AuthModalOpenDetail) => void;

let authRoot: Root | null = null;
let openHandler: OpenHandler | null = null;
let pendingOpen: AuthModalOpenDetail | null = null;

interface AuthModalLauncherState {
  listener?: EventListener;
}

const launcherStateKey = '__kychonAuthModalLauncher';

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function AuthModalIsland({ onReady }: { onReady: (open: OpenHandler) => void }) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>('sign-in');
  const [flow, setFlow] = React.useState<Flow>('standard');
  const [message, setMessage] = React.useState<Message>(null);
  const [busy, setBusy] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  const isSignUp = mode === 'sign-up';
  const isConnectGoogleFlow = flow === 'connect-google';
  const secureLinkSent = isConnectGoogleFlow && message?.type === 'success';
  const title = isConnectGoogleFlow ? 'Connect Google' : isSignUp ? 'Sign Up' : 'Sign In';

  const openModal = React.useCallback((detail: AuthModalOpenDetail = {}) => {
    const active = document.activeElement;
    returnFocusRef.current = detail.trigger || (active instanceof HTMLElement ? active : null);
    setMode(detail.mode === 'sign-up' ? 'sign-up' : 'sign-in');
    setFlow(detail.flow === 'connect-google' ? 'connect-google' : 'standard');
    setShowPassword(false);
    setMessage(detail.error && detail.flow !== 'connect-google' ? { type: 'error', text: detail.error } : null);
    setBusy(false);
    setOpen(true);
  }, []);

  React.useEffect(() => {
    onReady(openModal);
    return () => {
      openHandler = null;
    };
  }, [onReady, openModal]);

  async function refreshAfterSignIn(): Promise<void> {
    await init();
    document.dispatchEvent(new CustomEvent('wl-auth-changed'));
  }

  async function onGoogleSignIn(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setBusy(false);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Google sign-in failed' });
    }
  }

  async function finishVerifiedSignIn(connectGoogle: boolean): Promise<void> {
    await refreshAfterSignIn();
    if (connectGoogle) {
      await signInWithGoogle();
      return;
    }
    setOpen(false);
  }

  async function onPasskeySignIn(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await signInWithPasskey(email.trim() || undefined);
      await finishVerifiedSignIn(isConnectGoogleFlow);
    } catch (err) {
      setBusy(false);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Passkey sign-in failed' });
    }
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      if (isConnectGoogleFlow && !showPassword) {
        await requestGoogleConnectionLink(email);
        setMessage({
          type: 'success',
          text: 'Check your email. The secure link will sign you in and finish connecting Google.',
        });
      } else if (isSignUp) {
        await signUp(email, password);
        setMessage({ type: 'success', text: 'Account created! Please check your email to verify.' });
      } else {
        await signIn(email, password);
        await finishVerifiedSignIn(isConnectGoogleFlow);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Authentication failed' });
    } finally {
      setBusy(false);
    }
  }

  function toggleMode(): void {
    setFlow('standard');
    setShowPassword(false);
    setMode((current) => (current === 'sign-in' ? 'sign-up' : 'sign-in'));
    setMessage(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef.current;
          if (target?.isConnected) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isConnectGoogleFlow
              ? 'That email already belongs to an account here. First verify the account, then we will connect Google sign-in.'
              : 'Use Google or your email and password to continue.'}
          </DialogDescription>
        </DialogHeader>

        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {!isConnectGoogleFlow && (
          <Button type="button" variant="outline" onClick={() => void onGoogleSignIn()} disabled={busy}>
            <GoogleIcon />
            Sign in with Google
          </Button>
        )}

        {passkeysSupported() && (
          <Button type="button" variant="outline" onClick={() => void onPasskeySignIn()} disabled={busy}>
            <KeyRound className="size-4" aria-hidden="true" />
            {isConnectGoogleFlow ? 'Verify with passkey' : 'Sign in with passkey'}
          </Button>
        )}

        {!isConnectGoogleFlow && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        )}

        {isConnectGoogleFlow && showPassword && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or use password</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        )}

        {isConnectGoogleFlow && !showPassword && (
          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Sending...' : secureLinkSent ? 'Send link again' : 'Send secure link'}
            </Button>
          </form>
        )}

        {isConnectGoogleFlow && !showPassword && (
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" onClick={() => setShowPassword(true)} disabled={busy}>
              Use password instead
            </Button>
          </div>
        )}

        {isConnectGoogleFlow && showPassword && (
          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Working...' : 'Verify and connect Google'}
            </Button>
          </form>
        )}

        {!isConnectGoogleFlow && (
          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Working...' : title}
            </Button>
          </form>
        )}

        {!isConnectGoogleFlow && (
          <DialogFooter className="sm:justify-center">
            <Button type="button" variant="link" className="h-auto px-0" onClick={toggleMode}>
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function openOrQueue(detail: AuthModalOpenDetail = {}) {
  if (openHandler) {
    openHandler(detail);
    return;
  }
  pendingOpen = detail;
}

function bindAuthModalLauncher() {
  const win = window as Window & typeof globalThis & { [launcherStateKey]?: AuthModalLauncherState };
  const state = (win[launcherStateKey] ??= {});

  if (state.listener) document.removeEventListener(AUTH_OPEN_EVENT, state.listener);

  state.listener = ((event: CustomEvent<AuthModalOpenDetail>) => {
    openOrQueue(consumePendingAuthModalOpen() || event.detail || {});
  }) as EventListener;

  document.addEventListener(AUTH_OPEN_EVENT, state.listener);
  return () => {
    if (state.listener) document.removeEventListener(AUTH_OPEN_EVENT, state.listener);
    state.listener = undefined;
  };
}

export default function AuthModalLauncher() {
  React.useEffect(() => {
    const unbind = bindAuthModalLauncher();
    const pending = consumePendingAuthModalOpen();
    if (pending) openOrQueue(pending);
    return unbind;
  }, []);

  return (
    <AuthModalIsland
      onReady={(open) => {
        openHandler = open;
        const next = pendingOpen;
        pendingOpen = null;
        if (next) open(next);
      }}
    />
  );
}

export function mountAuthModalIsland(root: HTMLElement, detail: AuthModalOpenDetail = {}): void {
  pendingOpen = detail;

  if (!authRoot) {
    authRoot = createRoot(root);
    authRoot.render(
      <AuthModalIsland
        onReady={(open) => {
          openHandler = open;
          const next = pendingOpen;
          pendingOpen = null;
          open(next ?? {});
        }}
      />,
    );
    return;
  }

  if (openHandler) {
    openHandler(detail);
  }
}
