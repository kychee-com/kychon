# Design — newsletter signup

## Context

Wild Apricot parity target (gethelp.wildapricot.com article 420): per-form
subscription source, contact-field reuse, optional confirmation email,
admin search by source, manual blasts. Kychon equivalents: block registry,
functions + capability registry, admin surface, run402 `email` helper.

## Decisions

1. **Separate `subscribers` table, not `members`.** WA piggybacks on
   contacts; Kychon's members table carries membership semantics (tiers,
   status, auth) that newsletter subscribers must not inherit. A dedicated
   table keeps RLS simple: anon INSERT via the function only, admin SELECT.
2. **Block + function, not PostgREST insert.** The function owns honeypot
   checking, per-IP throttling, normalization (lowercase email), idempotent
   re-subscribe, and the optional confirmation email — none of which belong
   client-side.
3. **Single opt-in v1** (WA parity). `status` starts `subscribed`;
   `confirmed_at` column reserved for a future double-opt-in option.
4. **Unsubscribe**: tokened GET route (`/unsubscribe?t=…`) flips status;
   token stored per subscriber; included in confirmation email footer.
5. **No-JS path**: the block renders a real form; the function accepts form
   POSTs and returns a friendly thanks/error page server-side; JS enhances
   inline.

## Risks / Trade-offs

- Spam without CAPTCHA: honeypot + throttle first; provider CAPTCHA only if
  observed abuse demands it (WA itself ships none on this gadget).
- The SSR-baked form must not break parity gates: block markup is engine
  HTML (not sanitized user content), so form controls survive.
