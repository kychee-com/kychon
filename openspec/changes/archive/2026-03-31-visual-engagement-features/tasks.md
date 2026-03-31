## 1. CSS Animations Foundation

- [x] 1.1 Add scroll fade-in CSS: `.section` starts at `opacity: 0; transform: translateY(20px)`, `.section-visible` transitions to final state over 600ms
- [x] 1.2 Add `@keyframes reaction-pop` (scale 1 → 1.3 → 1, 300ms) and `@keyframes reaction-float` (translateY -40px + opacity 0, 800ms) to `styles.css`
- [x] 1.3 Add `prefers-reduced-motion` media query that disables all animations (sections visible by default, no keyframes)

## 2. Scroll Animations JS

- [x] 2.1 Create `site/js/animations.js` with shared IntersectionObserver (threshold 0.15) that adds `section-visible` class on entry
- [x] 2.2 Add staggered transition-delay for sections that enter the viewport simultaneously (100ms increments)
- [x] 2.3 Add stat counter animation: on stats section intersection, animate numbers from 0 to target using requestAnimationFrame with easeOutExpo over 1.5s, preserving prefixes/suffixes

## 3. Reaction Animations

- [x] 3.1 In the reaction toggle handler (index.html), add `reaction-pop` class to the badge on add, remove class on `animationend`
- [x] 3.2 On reaction add, create a floating emoji element positioned above the badge, animate with `reaction-float`, remove from DOM on `animationend`
- [x] 3.3 Skip animations when `prefers-reduced-motion: reduce` is active

## 4. Hero Parallax

- [x] 4.1 In `animations.js`, detect hero sections with background images and attach a scroll listener that applies `transform: translateY(scrollY * 0.3)` via requestAnimationFrame
- [x] 4.2 Disable parallax on touch devices (`'ontouchstart' in window`) and when `prefers-reduced-motion` is active

## 5. Event Countdown Section

- [x] 5.1 Add `event-countdown` case to the section renderer in `index.html`: fetch next upcoming event from API, render title + countdown (days/hours/minutes) with a link to event detail
- [x] 5.2 Add `setInterval` (60s) to update the countdown; show "Happening now!" when countdown reaches zero
- [x] 5.3 Hide the section when no upcoming events exist or `feature_events` is false
- [x] 5.4 Add CSS styling for the event-countdown section (prominent display, countdown digits)

## 6. Integration & Wiring

- [x] 6.1 Add `<script src="js/animations.js">` to `index.html` (only page with sections/reactions)
- [x] 6.2 Verify all sections on the homepage animate in on scroll, stats count up, hero parallax works, countdown displays
- [x] 6.3 Test with `prefers-reduced-motion: reduce` — all animations disabled, content visible immediately
