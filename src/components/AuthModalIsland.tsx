import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';

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
import { signIn, signInWithGoogle, signUp } from '@/lib/auth';

type Mode = 'sign-in' | 'sign-up';
type Message = { type: 'error' | 'success'; text: string } | null;
type OpenHandler = (detail?: AuthModalOpenDetail) => void;

let authRoot: Root | null = null;
let openHandler: OpenHandler | null = null;
let pendingOpen: AuthModalOpenDetail | null = null;

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
  const [message, setMessage] = React.useState<Message>(null);
  const [busy, setBusy] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  const isSignUp = mode === 'sign-up';
  const title = isSignUp ? 'Sign Up' : 'Sign In';

  const openModal = React.useCallback((detail: AuthModalOpenDetail = {}) => {
    const active = document.activeElement;
    returnFocusRef.current = detail.trigger || (active instanceof HTMLElement ? active : null);
    setMode(detail.mode === 'sign-up' ? 'sign-up' : 'sign-in');
    setMessage(detail.error ? { type: 'error', text: detail.error } : null);
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
    const { init } = await import('../lib/config');
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

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      if (isSignUp) {
        await signUp(email, password);
        setMessage({ type: 'success', text: 'Account created! Please check your email to verify.' });
      } else {
        await signIn(email, password);
        setOpen(false);
        await refreshAfterSignIn();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Authentication failed' });
    } finally {
      setBusy(false);
    }
  }

  function toggleMode(): void {
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
          <DialogDescription>Use Google or your email and password to continue.</DialogDescription>
        </DialogHeader>

        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Button type="button" variant="outline" onClick={() => void onGoogleSignIn()} disabled={busy}>
          <GoogleIcon />
          Sign in with Google
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

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

        <DialogFooter className="sm:justify-center">
          <Button type="button" variant="link" className="h-auto px-0" onClick={toggleMode}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
