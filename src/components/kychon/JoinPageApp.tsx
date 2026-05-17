'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@/components/kychon/ui';
import { getRole, getSessionEmail, isAuthenticated, signIn, signInWithGoogle, signUp } from '@/lib/auth';
import { refreshMemberRecord } from '@/lib/config';

interface SubmitEventLike {
  preventDefault(): void;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
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

export function signedInJoinDestination(role: string | null): { href: string; label: string } {
  return role === 'admin'
    ? { href: '/admin', label: 'Open admin dashboard' }
    : { href: '/profile', label: 'View profile' };
}

export default function JoinPageApp() {
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPasswordValue] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refreshSignedInState(): Promise<void> {
      const authenticated = isAuthenticated();
      if (!authenticated) {
        if (!cancelled) setSignedIn(false);
        return;
      }

      await refreshMemberRecord();
      if (cancelled) return;
      setRole(getRole());
      setSessionEmail(getSessionEmail());
      setSignedIn(true);
    }

    void refreshSignedInState();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: SubmitEventLike) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignUpMode) {
        await signUp(email, password);
        setMessageTone('success');
        setMessage('Account created! Check your email to verify.');
      } else {
        await signIn(email, password);
        const { navigate } = await import('astro:transitions/client');
        navigate('/');
      }
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  const title = isSignUpMode ? 'Sign Up' : 'Sign In';
  const signedInDestination = signedInJoinDestination(role);

  if (signedIn === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl tracking-normal">Join</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking account
        </CardContent>
      </Card>
    );
  }

  if (signedIn) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl tracking-normal">Already Signed In</CardTitle>
          <CardDescription>
            {sessionEmail ? `You are signed in as ${sessionEmail}.` : 'You are signed in on this site.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <a href={signedInDestination.href}>{signedInDestination.label}</a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href="/">Return home</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl tracking-normal">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <Alert variant={messageTone === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="button" variant="outline" className="w-full" onClick={() => signInWithGoogle()}>
          <GoogleMark />
          Sign in with Google
        </Button>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="join-email">Email</Label>
            <Input
              id="join-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="join-password">Password</Label>
            <Input
              id="join-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPasswordValue(event.target.value)}
              autoComplete={isSignUpMode ? 'new-password' : 'current-password'}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {title}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <Button type="button" variant="link" onClick={() => setIsSignUpMode((value) => !value)}>
          {isSignUpMode ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </Button>
      </CardFooter>
    </Card>
  );
}
