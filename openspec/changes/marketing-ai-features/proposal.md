## Why

The marketing site's AI section still says "Six AI features. Your API key." with BYOK messaging throughout. After drop-byok-native-ai, moderation and translation are platform-native (no API key), and four generative features are dormant. The marketing copy is now wrong and undersells the value — "works out of the box" is a stronger pitch than "bring your own key." Don't advertise features that don't exist yet.

## What Changes

- Rewrite the AI section heading and tagline: shift from BYOK/control messaging to "built-in AI, zero setup" messaging
- Remove the four generative feature cards (Newsletter Writer, Smart Onboarding, Member Insights, Event Recaps) — only show moderation and translation
- Remove the BYOK badge ("Your API key. Your AI, your cost, your control.")
- Update the compare.html feature table: remove AI newsletter row, keep moderation + translation
- Update niche pages (churches, associations, sports, hoa) AI mentions to remove BYOK references
- Update pricing section: AI mentions should say "built-in" not "bring your own"

## Capabilities

### New Capabilities

- `marketing-ai-messaging`: New AI marketing copy across all marketing pages — updated section heading, two feature cards (moderation + translation), comparison table, and niche page AI mentions

### Modified Capabilities

None (this is marketing copy only, no application behavior changes)

## Impact

- **Files**: `marketing/index.html`, `marketing/compare.html`, `marketing/churches.html`, `marketing/associations.html`, `marketing/sports.html`, `marketing/hoa.html`
- **CSS**: Possible layout tweak to `marketing/css/marketing.css` for 2-card AI grid
- **No backend/app changes**: purely static marketing content
