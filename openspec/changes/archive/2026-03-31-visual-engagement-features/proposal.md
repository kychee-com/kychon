## Why

Kychon portals are functional but visually static. Sections appear instantly without animation, stats are plain text, reactions toggle without feedback, and the hero image has no depth. Adding scroll animations, animated counters, reaction effects, parallax, and an event countdown transforms the perceived quality from "template" to "polished product" — with minimal code added to the core `site/` files so every portal built on Kychon benefits.

## What Changes

- **Scroll-triggered fade-in animations**: Sections animate in (fade-up) as they enter the viewport via `IntersectionObserver`. Applies to all homepage sections and page content.
- **Animated stat counters**: Stats section numbers count up from 0 when scrolled into view instead of appearing statically.
- **Reaction emoji animations**: Clicking a reaction triggers a pop/float-up CSS animation on the emoji, replacing the current instant toggle.
- **Hero parallax**: Subtle parallax scroll effect on hero sections that have a `bg_image`, adding depth.
- **Event countdown on homepage**: Prominent countdown ("Next event in 3d 14h 22m") displayed on the homepage when upcoming events exist, creating urgency.

## Capabilities

### New Capabilities
- `scroll-animations`: IntersectionObserver-based fade-in animations for page sections and animated stat counters
- `reaction-animations`: CSS keyframe animations for emoji reaction feedback (pop, float-up)
- `hero-parallax`: Parallax scroll effect on hero background images
- `event-countdown`: Homepage countdown widget showing time until next upcoming event

### Modified Capabilities
- `reactions`: Adding visual animation feedback when toggling reactions (currently instant)
- `config-driven-ui`: Hero section gains parallax behavior; stats section gains count-up animation; new event-countdown section type

## Impact

- **Files modified**: `site/css/styles.css`, `site/index.html` (section renderer + homepage JS), `site/events.js` (countdown data)
- **Files added**: Possibly `site/js/animations.js` if extracted (or inline in index.html)
- **No new dependencies**: Pure CSS animations + vanilla JS (`IntersectionObserver`, `requestAnimationFrame`)
- **No schema changes**: Event countdown reads from existing `events` table
- **Performance**: All animations use CSS transforms/opacity (GPU-composited). Parallax uses `requestAnimationFrame`. No layout thrashing.
- **Accessibility**: Animations respect `prefers-reduced-motion` media query
