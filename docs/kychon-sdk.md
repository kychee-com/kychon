# Kychon SDK

Use the SDK before the CLI when writing agents or integrations.

```ts
import { createKychonClient } from '@kychon/sdk';

const kychon = createKychonClient({
  portalUrl: 'https://example.kychon.com',
  authToken: process.env.KYCHON_AUTH_TOKEN,
});

const me = await kychon.auth.whoami();
const events = await kychon.events.list();

const plan = await kychon.events.create.validate({
  title: 'Board meeting',
  starts_at: '2026-06-01T18:00:00Z',
});

if (plan.accepted) {
  await kychon.events.create.execute(
    { title: 'Board meeting', starts_at: '2026-06-01T18:00:00Z' },
    { confirmed: true },
  );
}
```

`portalUrl` is enough for public reads: the SDK discovers the Run402 function endpoint and public `apikey` from the portal. Pass `apiEndpoint` or `apiKey` only when you need to override discovery.

Domain namespaces include `portal`, `auth`, `search`, `config`, `pages`, `sections`, `members`, `tiers`, `memberFields`, `events`, `registrationOptions`, `rsvps`, `announcements`, `resources`, `assets`, `forum`, `polls`, `committees`, `committeeMembers`, `reactions`, `moderation`, `translations`, `newsletters`, `insights`, `exports`, `activity`, `jobs`, and `raw`.

Use `raw` only for low-level data/config customization or migrations. Product workflows should use capability helpers so permissions, side effects, idempotency, and audit references stay intact.
