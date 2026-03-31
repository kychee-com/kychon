## Why

Run402 1.25.0 ships native `ai.moderate()` and `ai.translate()` runtime helpers. These replace our hand-rolled BYOK (Bring Your Own Key) architecture where portal operators had to supply their own OpenAI or Anthropic API keys. Moderation is free; translation is quota-tracked by the platform. Dropping BYOK eliminates the most complex onboarding step ("go get an API key") and removes ~200 lines of provider-branching code.

Four generative AI features (insights, onboarding, newsletter, event recaps) cannot migrate yet — Run402 doesn't have a generic LLM endpoint. We hide these from the UI but keep the code for future re-enablement.

## What Changes

- **BREAKING**: `AI_API_KEY` and `AI_PROVIDER` project secrets are removed. Existing keys become unused.
- Replace `moderate-content.js` internals with `ai.moderate()` from `@run402/functions`
- Replace `translate-content.js` internals with `ai.translate()` from `@run402/functions`
- Remove `callAI()` helper and raw OpenAI/Anthropic HTTP calls from all functions
- Hide 4 generative feature toggles from admin settings UI (flags stay in DB, default `false`)
- Hide admin UI panels: insights, newsletter editor, event recap button
- Remove AI provider/key configuration section from admin settings
- Update CUSTOMIZING.md and spec.md to remove BYOK references
- Update agent-docs (STRUCTURE.md) to reflect native AI

## Capabilities

### New Capabilities

- `native-ai-moderation`: Content moderation via Run402's built-in `ai.moderate()` — replaces BYOK moderation
- `native-ai-translation`: Content translation via Run402's built-in `ai.translate()` — replaces BYOK translation

### Modified Capabilities

- `ai-moderation`: Requirements change from BYOK provider call to native platform call; confidence scoring and admin review flow unchanged
- `ai-translation`: Requirements change from BYOK provider call to native platform call; content_translations table and locale display unchanged
- `ai-admin`: Remove provider/key config UI; hide generative feature toggles; keep moderation + translation toggles

## Impact

- **Functions**: `moderate-content.js`, `translate-content.js` rewritten; `on-signup.js`, `check-expirations.js`, `ai-content.js` have AI blocks disabled
- **Admin UI**: `admin-settings.js`, `admin-settings.html`, `admin.js`, `admin.html`, `event.js` — hide generative panels
- **Schema**: No table changes (newsletter_drafts, member_insights kept for future use)
- **Secrets**: `AI_API_KEY`, `AI_PROVIDER` removed from deployed projects
- **Docs**: CUSTOMIZING.md, spec.md, STRUCTURE.md updated
- **Dependencies**: No new deps; removes implicit dependency on OpenAI/Anthropic APIs
