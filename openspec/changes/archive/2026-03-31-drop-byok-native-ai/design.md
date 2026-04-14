## Context

Kychon currently implements six AI features using a BYOK (Bring Your Own Key) architecture. Portal operators set `AI_API_KEY` and `AI_PROVIDER` secrets, and edge functions call OpenAI or Anthropic APIs directly. Run402 1.25.0 introduces native `ai.moderate()` (free) and `ai.translate()` (quota-tracked) runtime helpers that replace two of these features. The remaining four generative features (insights, onboarding, newsletter, event recaps) have no native equivalent yet — Run402 plans a generic LLM endpoint later.

Current state of the six AI functions:

| Function | Type | BYOK call | Native replacement |
|----------|------|-----------|-------------------|
| `moderate-content.js` | classify | `callAI()` → JSON parse | `ai.moderate()` |
| `translate-content.js` | translate | `callAI()` → raw text | `ai.translate()` |
| `on-signup.js` | generative | `callAI()` → welcome msg | none (hide) |
| `check-expirations.js` | generative | `callAI()` → insights | none (hide) |
| `ai-content.js` | generative | `callAI()` → newsletter/recap | none (hide) |

## Goals / Non-Goals

**Goals:**
- Replace moderation and translation with Run402 native helpers
- Remove all BYOK wiring (secrets, provider branching, raw HTTP calls)
- Hide generative AI features from the admin UI while preserving the code
- Simplify admin settings to just two toggles (moderation, translation)

**Non-Goals:**
- Reimplementing generative features (wait for Run402 LLM endpoint)
- Changing the moderation review queue or translation display UX
- Modifying database schema (all tables stay)
- Deleting function files (generative functions stay as dead code)

## Decisions

### D1: Map `ai.moderate()` response to existing confidence model

The current system uses a single `confidence` float (0-1) with thresholds at 0.3 and 0.7. The native `ai.moderate()` returns a different shape:

```json
{
  "flagged": true,
  "categories": { "harassment": true, "violence": false, ... },
  "category_scores": { "harassment": 0.85, "violence": 0.02, ... }
}
```

**Decision**: Use `Math.max(...Object.values(category_scores))` as the confidence score. Use `flagged` as the primary signal, but preserve the confidence thresholds for logging granularity:
- `flagged: true` AND max score > 0.7 → auto-hide
- `flagged: true` AND max score <= 0.7 → flag for review
- `flagged: false` → approved

The `reason` field (currently from LLM output) becomes the name of the highest-scoring category (e.g., "harassment").

**Alternative considered**: Use only `flagged` boolean. Rejected because we lose the graduated response (auto-hide vs. flag for review) that admins rely on.

### D2: Use `ai.translate()` with context hints

The native helper accepts an optional `context` string (max 200 chars) that improves translation quality.

**Decision**: Pass a context hint derived from content type: `"${content_type} on a community portal"`. This gives the translation model register/tone awareness without any configuration.

**Alternative considered**: Let admins configure context hints per content type. Rejected as over-engineering — the generic hint is good enough.

### D3: Hide generative features via feature flags + UI removal

**Decision**: Three-layer approach:
1. **Feature flags** stay in `site_config` with default `false` — no change
2. **Admin UI** removes toggles, panels, and buttons for the four generative features
3. **Function code** stays intact but becomes unreachable (no API key, flag off, UI hidden)

The functions don't need modification — they already early-return when `AI_API_KEY` is missing. With the secret removed, they're inert.

**Alternative considered**: Add a `/* HIDDEN: waiting for Run402 LLM endpoint */` guard at the top of each generative function. Rejected — the existing `AI_API_KEY` guard already handles this, and adding comments that need to be removed later is churn.

### D4: Kill the entire AI provider/key config section

**Decision**: Remove from admin settings:
- Provider selector (OpenAI/Anthropic dropdown)
- API key input field
- Test button
- The "AI activity summary" section that includes insights count (keep moderation + translation counts)

Replace with a simpler panel that just shows moderation and translation toggles plus activity counts for those two features.

### D5: Import `ai` from `@run402/functions`

Both rewritten functions import the `ai` helper alongside `db`:

```js
import { db, ai } from '@run402/functions';
```

No new dependencies — `ai` is already available in the Run402 runtime.

## Risks / Trade-offs

**[Risk] `ai.moderate()` categorization differs from LLM-based classification** → The current BYOK approach used an LLM to classify as spam/toxic/off_topic/appropriate. The native moderation API uses OpenAI's moderation categories (harassment, violence, sexual, etc.). The `reason` field in `moderation_log` will change from freetext to category names. Existing moderation_log entries keep their old format. This is acceptable — the admin review queue just shows the reason string.

**[Risk] Translation quota limits** → BYOK had no quota (user paid provider directly). Native translation is quota-tracked. If a portal operator does heavy translation, they may hit limits. Mitigation: `ai.usage()` can be checked, and Run402 returns clear errors when quota is exceeded. The function should handle quota errors gracefully.

**[Risk] Generative features become invisible but code stays** → Future developers may not realize the code exists. Mitigation: STRUCTURE.md and CUSTOMIZING.md will document that these features are paused pending the Run402 LLM endpoint.

**[Trade-off] No AI onboarding welcome email** → New members get the standard signup flow. This is acceptable — the AI welcome message was the weakest feature (just name + tier in a template prompt).
