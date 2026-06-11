# Tasks — add-newsletter-signup

## 1. Schema + function

- [ ] 1.1 `subscribers` table in schema.sql (+ RLS) with unsubscribe token
- [ ] 1.2 `functions/newsletter-subscribe.js`: validate, honeypot, throttle,
      upsert, optional confirmation email (subscriber and/or admin), no-JS
      form-POST response page
- [ ] 1.3 Capability registry: `subscribers.create` (anon),
      `subscribers.list` (admin, filter by source), `subscribers.unsubscribe`

## 2. Block + admin

- [ ] 2.1 `newsletter_signup` block (registry + view): heading/blurb/button,
      field subset, `subscription_source`, honeypot; SSR-baked markup
- [ ] 2.2 Unsubscribe route + token flow
- [ ] 2.3 Admin surface: subscribers list filtered by source + CSV export

## 3. Acceptance

- [ ] 3.1 Unit tests: function validation/throttle/honeypot; block source
      tests; capability visibility
- [ ] 3.2 Demo seed gains a newsletter_signup block; demo smoke passes
- [ ] 3.3 Concierge: port WA-native subscription gadgets onto
      `newsletter_signup` (skill update lands with this change's release)
