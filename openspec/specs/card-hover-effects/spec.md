## ADDED Requirements

### Requirement: Cards lift on hover

All `.card` elements SHALL have a hover transition that moves the card up 2px (`translateY(-2px)`) and increases the box-shadow from `--shadow-sm` to `--shadow-md`. The transition SHALL take 200ms with ease timing.

#### Scenario: User hovers over a card
- **WHEN** the user hovers over any element with class `card`
- **THEN** the card visually lifts (translateY -2px) and its shadow increases
- **THEN** the transition takes 200ms

#### Scenario: User moves mouse away
- **WHEN** the user stops hovering over a card
- **THEN** the card returns to its original position and shadow with the same 200ms transition
