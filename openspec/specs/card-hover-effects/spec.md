## ADDED Requirements

### Requirement: Cards lift on hover

Interactive Kychon card surfaces SHALL use shadcn/Kychon Card components or semantic card-specific `data-*` hooks for hover behavior rather than a retired global primitive class selector. When a card surface opts into lift-on-hover treatment, it SHALL transition `transform` to `--card-hover-transform` (default `translateY(-2px)`) and `box-shadow` to `--card-hover-shadow` (default `--shadow-md`) using `--interaction-duration` with `--interaction-easing` timing.

#### Scenario: User hovers over a card
- **WHEN** the user hovers over a card surface that opts into card hover treatment
- **THEN** the card visually lifts using the configured card hover transform and its shadow increases using the configured card hover shadow
- **THEN** the transition uses the configured interaction duration and easing
- **THEN** the rendered markup does not require the retired card primitive class token

#### Scenario: User moves mouse away
- **WHEN** the user stops hovering over an opted-in card surface
- **THEN** the card returns to its original position and shadow with the same configured transition
