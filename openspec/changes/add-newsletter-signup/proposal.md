# Add first-class newsletter signup (Wild Apricot subscription-form parity)

## Why

Email capture is table-stakes for the club/association market. Wild Apricot
ships an "Email subscription form gadget": visitors submit contact fields
(email mandatory), a contact is created/updated stamped with a per-form
"Subscription source", an optional confirmation email goes to the subscriber
and/or administrator, and admins build blast lists by searching on that
source. Kychon has no subscribers concept at all, so ported sites that use
the native gadget must drop their form (the rich-text sanitizer rightly
strips form controls from page content), and native Kychon sites can't
capture interest from non-members.

Sites that embed a third-party form (Mailchimp — e.g. WSMTA) are already
served by the `mailchimp` embed provider; this change covers the
WA-native-gadget case and gives Kychon its own capture surface.

## What Changes

- `subscribers` table: email (unique), optional name fields,
  `subscription_source`, `status` (`subscribed` | `unsubscribed`), consent
  provenance (source page, timestamps), unsubscribe token.
- `newsletter_signup` block: configurable heading/blurb/button and field
  subset (email always), per-instance `subscription_source`; honeypot field;
  posts to a `newsletter-subscribe` function (anonymous capability,
  rate-limited in-function).
- Optional confirmation email to subscriber and/or admin per block config
  (single opt-in, matching WA; double opt-in is a later option).
- Capability ops: `subscribers.create` (anon), `subscribers.list` filtered
  by source (admin), tokened `subscribers.unsubscribe`; CSV export via the
  admin surface.

## Impact

- Affected specs: `newsletter-signup` (new)
- Affected code: `schema.sql`, `src/lib/blocks.ts` (+ block view),
  `functions/newsletter-subscribe.js`, `functions/kychon-api.js`
  (capability registry), admin surface, seeds/tests.
- Out of scope: campaign/bulk sending (admins export and blast from their
  existing tool, mirroring WA's manual-blast model); run402 needs nothing —
  the `email` runtime helper covers confirmations.
