## 1. Rewrite moderation to use native ai.moderate()

- [x] 1.1 Rewrite `functions/moderate-content.js`: import `ai` from `@run402/functions`, replace `classifyContent()` with `ai.moderate()`, map `category_scores` to confidence float, map `flagged` boolean to action (hidden/flagged/approved), set reason to highest-scoring category name
- [x] 1.2 Remove `AI_API_KEY` check from `moderate-content.js` — function should only check `feature_ai_moderation` flag
- [x] 1.3 Add error handling: catch `ai.moderate()` failures, treat content as approved with reason "moderation unavailable"

## 2. Rewrite translation to use native ai.translate()

- [x] 2.1 Rewrite `functions/translate-content.js`: import `ai` from `@run402/functions`, replace `translateText()` with `ai.translate(text, lang, { context })`, use context hint `"{content_type} on a community portal"`
- [x] 2.2 Remove `AI_API_KEY` and `AI_PROVIDER` checks from `translate-content.js`
- [x] 2.3 Add quota error handling: catch quota exceeded errors, save successful translations, skip remaining, return partial completion count

## 3. Remove BYOK from on-signup.js

- [x] 3.1 Remove the AI personalized onboarding block (lines 102-163) from `functions/on-signup.js` — keep all member creation, first-admin, and activity logging logic intact

## 4. Hide generative AI features from admin UI

- [x] 4.1 Remove AI provider selector, API key input, and test button from `site/admin-settings.html` and `site/js/admin-settings.js`
- [x] 4.2 Remove toggles for insights, onboarding, newsletter, and event recaps from admin settings — keep only moderation and translation toggles
- [x] 4.3 Remove insights count from AI activity summary — keep only moderation and translation counts
- [x] 4.4 Remove insights panel (id: `insights-section`) from `site/admin.html` and `site/js/admin.js`
- [x] 4.5 Remove newsletter editor section (id: `newsletter-section`) from `site/admin.html` and `site/js/admin.js`
- [x] 4.6 Remove "Generate Recap" button and its handler from `site/event.html` and `site/js/event.js`

## 5. Update documentation

- [x] 5.1 Update `CUSTOMIZING.md`: remove BYOK AI configuration section, document that moderation and translation are platform-native, note that generative features are paused pending Run402 LLM endpoint
- [x] 5.2 Update `docs/spec.md`: remove BYOK references, update AI features section to reflect native moderation/translation and hidden generative features
- [x] 5.3 Update `STRUCTURE.md`: reflect that AI functions use `@run402/functions` native helpers, note which functions are dormant

## 6. Verify and deploy

- [x] 6.1 Run existing tests — ensure no regressions from removed code
- [x] 6.2 Deploy updated functions (`moderate-content.js`, `translate-content.js`, `on-signup.js`) and site files
- [x] 6.3 Verify admin settings page in Chrome — confirm only moderation and translation toggles visible, no API key section
