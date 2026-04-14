## ADDED Requirements

### Requirement: Reaction pop animation on toggle

When a user adds a reaction, the emoji badge SHALL play a "pop" animation — a brief scale-up and bounce-back. The animation SHALL use CSS `@keyframes reaction-pop` lasting ~300ms. The animation class SHALL be removed on `animationend` so it can replay on subsequent clicks.

#### Scenario: User adds a reaction
- **WHEN** an authenticated user clicks a reaction emoji
- **THEN** the reaction badge plays a pop animation (scale 1 → 1.3 → 1) over ~300ms
- **THEN** the animation class is removed after completion

#### Scenario: User removes a reaction
- **WHEN** an authenticated user clicks a reaction they already added (toggle off)
- **THEN** no pop animation plays (the badge simply updates its count or disappears)

### Requirement: Floating emoji animation on react

When a user adds a reaction, a copy of the emoji SHALL float upward from the click position and fade out. The animation SHALL use CSS `@keyframes reaction-float` (translateY -40px + opacity 0) over ~800ms. The floating element SHALL be removed from the DOM after animation completes.

#### Scenario: Floating emoji appears on react
- **WHEN** a user adds a reaction
- **THEN** a floating emoji appears above the clicked badge, drifts upward ~40px, and fades out over ~800ms
- **THEN** the floating element is removed from the DOM after the animation ends

#### Scenario: Multiple rapid reactions
- **WHEN** a user rapidly clicks different reaction emojis
- **THEN** each click produces its own floating emoji independently
- **THEN** animations do not interfere with each other

### Requirement: Reaction animations respect reduced motion

Reaction animations SHALL be disabled when `prefers-reduced-motion: reduce` is active. Reactions still function (toggle on/off) but without visual animation feedback.

#### Scenario: Reduced motion enabled
- **WHEN** `prefers-reduced-motion: reduce` is active and a user adds a reaction
- **THEN** the reaction count updates without pop or float animations
