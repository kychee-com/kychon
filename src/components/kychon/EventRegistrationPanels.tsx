'use client';

import { Check, ExternalLink, Loader2 } from 'lucide-react';
import * as React from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/kychon/ui';
import { openAuthModal } from '@/lib/auth-modal-events';
import {
  registrationAvailabilityLabel,
  registrationPriceLabel,
  visibleRegistrationOptions,
} from '@/lib/event-registration';
import type { Event, EventRegistrationOption, EventRSVP } from '@/schemas/event';

/** Source registration statuses where an outbound "Register" CTA would be a dead end. */
const NON_REGISTRABLE_STATUSES = new Set(['closed', 'full']);

function safeExternalUrl(value: string | null | undefined): string {
  return value && /^https?:\/\//i.test(value) ? value : '';
}

export function RegistrationOptions({ admin, options }: { admin: boolean; options: EventRegistrationOption[] }) {
  const visible = visibleRegistrationOptions(options);
  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl tracking-normal">Registration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.map((option) => {
          const price = registrationPriceLabel(option);
          const availability = registrationAvailabilityLabel(option);
          const url = NON_REGISTRABLE_STATUSES.has(option.availability_status ?? '') ? '' : safeExternalUrl(option.source_registration_url);
          return (
            <Card key={option.id} className="shadow-none">
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <CardTitle className="break-words text-base tracking-normal">{option.label}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {price ? <Badge>{price}</Badge> : null}
                    {availability ? <Badge variant="secondary">{availability}</Badge> : null}
                    {admin && option.review_state ? <Badge variant="outline">{option.review_state}</Badge> : null}
                  </div>
                </div>
                {option.description ? <CardDescription className="break-words">{option.description}</CardDescription> : null}
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {option.guest_policy ? <p className="break-words">{option.guest_policy}</p> : null}
                {option.cancellation_note ? <p className="break-words">{option.cancellation_note}</p> : null}
              </CardContent>
              {url ? (
                <CardFooter>
                  <Button asChild size="sm">
                    <a href={url} rel="noopener noreferrer" target="_blank">
                      <ExternalLink className="h-4 w-4" />
                      Register
                    </a>
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function RsvpPanel({
  busyAction,
  event,
  goingCount,
  maybeCount,
  myRsvp,
  onRsvp,
  options,
  signedIn,
}: {
  busyAction: string;
  event: Event;
  goingCount: number;
  maybeCount: number;
  myRsvp: EventRSVP | null;
  onRsvp: (status: 'going' | 'maybe' | 'cancel') => void;
  options: EventRegistrationOption[];
  signedIn: boolean;
}) {
  const visibleOptions = visibleRegistrationOptions(options);
  const capacity = Number(event.capacity || 0);
  const capacityPct = capacity ? Math.min(100, Math.round((goingCount / capacity) * 100)) : 0;
  const spotsLeft = capacity ? Math.max(0, capacity - goingCount) : null;
  const isFull = capacity > 0 && goingCount >= capacity;
  const countLabel = `${goingCount} going${maybeCount ? `, ${maybeCount} maybe` : ''}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg tracking-normal">{visibleOptions.length ? 'RSVP' : countLabel}</CardTitle>
          {capacity ? (
            <Badge variant="outline">
              {spotsLeft} of {capacity} spots left
            </Badge>
          ) : null}
        </div>
        {visibleOptions.length ? <CardDescription>Let us know if you plan to attend.</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {capacity ? (
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={capacityPct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${capacityPct}%` }}
            />
          </div>
        ) : null}

        {signedIn ? (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busyAction !== '' || (isFull && myRsvp?.status !== 'going')}
              onClick={() => onRsvp('going')}
              size="sm"
              type="button"
              variant={myRsvp?.status === 'going' ? 'default' : 'secondary'}
            >
              {busyAction === 'going' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Going
            </Button>
            <Button
              disabled={busyAction !== ''}
              onClick={() => onRsvp('maybe')}
              size="sm"
              type="button"
              variant={myRsvp?.status === 'maybe' ? 'default' : 'secondary'}
            >
              {busyAction === 'maybe' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Maybe
            </Button>
            {myRsvp ? (
              <Button disabled={busyAction !== ''} onClick={() => onRsvp('cancel')} size="sm" type="button" variant="outline">
                {busyAction === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cancel RSVP
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">Sign in to RSVP.</p>
            <Button onClick={() => openAuthModal({ mode: 'sign-in' })} size="sm" type="button">
              Sign in
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
