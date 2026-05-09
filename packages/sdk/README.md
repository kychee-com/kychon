# @kychon/sdk

Typed client for the Kychon Capability API.

```ts
import { createKychonClient } from '@kychon/sdk';

const kychon = createKychonClient({
  portalUrl: 'https://eagles.kychon.com',
  authToken: process.env.KYCHON_AUTH_TOKEN,
});

const me = await kychon.auth.whoami();
const events = await kychon.events.list();
```

`portalUrl` is enough for anonymous reads. The SDK discovers the portal's Capability API endpoint from `/.well-known/kychon.json` and the public Run402 `apikey` from `/js/env.js`.

For mutations, validate before execute:

```ts
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

Use `authToken` for logged-in user/admin actions. Pass `apiEndpoint` or `apiKey` only when overriding discovery.

The same package works against the official demo portals:

- `https://eagles.kychon.com`
- `https://silver-pines.kychon.com`
- `https://barrio.kychon.com`
