## Context

The marketing site's AI section (index.html lines 228-274) currently shows six AI features with BYOK messaging. After drop-byok-native-ai, only moderation and translation work. The four generative features are dormant — don't advertise them.

## Goals / Non-Goals

**Goals:**
- Reposition AI as a zero-friction, built-in differentiator
- Show only the two active features: moderation and translation
- Remove all BYOK/API key messaging from every marketing page
- Make the AI section feel like a strong, honest pitch

**Non-Goals:**
- Redesigning the overall AI section layout or CSS
- Adding new sections or pages
- Changing any portal application code

## Decisions

### D1: Show only two AI feature cards

**Decision**: Remove the four generative feature cards entirely. The AI grid shows only Content Moderation and Auto-Translation. Two strong features that actually work beats six where four are vaporware.

**Alternative considered**: Show generative features as "Coming Soon." Rejected — don't advertise what doesn't exist.

### D2: New heading and tagline

**Decision**: Change from BYOK messaging to built-in messaging:
- Heading: "AI that works from day one."
- Tagline: "Content moderation and auto-translation are built into every portal. No API keys. No setup. Just toggle them on."

### D3: Two-column grid for two cards

**Decision**: The current 3-column `.ai-grid` will naturally handle 2 cards, but they'll sit left-aligned with a gap on the right. Instead, center the two cards using a 2-column max-width constraint or adjust grid to `repeat(2, 1fr)` for this section.

### D4: Remove BYOK badge entirely

**Decision**: Delete the `.ai-byok` div. The "no API keys, no setup" message is in the tagline.

### D5: Compare page — remove AI newsletter row

**Decision**: Delete the AI newsletter row from the feature comparison table. Keep AI moderation and AI translation rows with checkmarks.

## Risks / Trade-offs

**[Trade-off] Fewer features in the pitch** → Honest marketing. Two features that work are more credible than six where four don't.

**[Trade-off] Less visual impact with 2 cards vs 6** → Mitigated by making the two cards larger/more prominent and keeping the dark premium styling.
