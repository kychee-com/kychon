## Context

Wild Lychee homepage sections render statically — content appears instantly on load with no visual transitions. The hero background image is flat, reactions toggle without feedback, and stats are plain text. The site functions well but feels like a template rather than a polished product.

All animation code lives in core `site/` files, so every portal built on Wild Lychee gets these improvements. No per-site configuration is needed (though animations respect `prefers-reduced-motion`).

## Goals / Non-Goals

**Goals:**
- Add scroll-triggered entrance animations to all homepage sections
- Animate stat counters (count-up from 0) when they scroll into view
- Add pop/float-up CSS animation when users click reactions
- Add subtle parallax effect to hero sections with background images
- Show a countdown to the next upcoming event on the homepage
- Respect `prefers-reduced-motion` for all animations
- Zero new dependencies — vanilla JS + CSS only

**Non-Goals:**
- No animation configuration UI in admin settings (all animations are sensible defaults)
- No animation on non-homepage pages (directory, forum, etc.) — keep it to index sections + reactions
- No JavaScript animation libraries (GSAP, Framer Motion, etc.)
- No WebSocket or polling for real-time countdown updates (page-load snapshot is sufficient)

## Decisions

### D1: Single `animations.js` file vs inline in `index.html`

**Choice**: Create `site/js/animations.js` as a separate file, loaded on all pages.

**Why**: Scroll fade-ins and reaction animations apply across multiple pages (homepage, announcements on any page). A separate file keeps concerns clean and avoids bloating `index.html` further. It's small (~80 lines) so no meaningful loading cost.

**Alternative**: Inline in `index.html`. Rejected because reaction animations also apply on pages that render announcements.

### D2: CSS `@keyframes` for reaction animations

**Choice**: Define `@keyframes reaction-pop` (scale bounce) and `@keyframes reaction-float` (float-up + fade) in `styles.css`. JS adds a class that triggers the animation, then removes it on `animationend`.

**Why**: CSS animations are GPU-composited, don't block the main thread, and are trivial to implement. The alternative (JS-driven `requestAnimationFrame` loop) is more code for no benefit here.

### D3: IntersectionObserver for scroll triggers

**Choice**: One shared `IntersectionObserver` instance (threshold 0.15) watches all `.section` elements. On intersection, add `.section-visible` class. CSS handles the transition from `opacity: 0; transform: translateY(20px)` to `opacity: 1; transform: none`.

**Why**: `IntersectionObserver` is the standard API for this. Single observer for all targets is more efficient than one per element. 0.15 threshold means animation starts when 15% of the section is visible — feels natural.

### D4: Counter animation with `requestAnimationFrame`

**Choice**: When the stats section enters the viewport (via the same IntersectionObserver), animate each number from 0 to its target value over ~1.5 seconds using `requestAnimationFrame` with easing (`easeOutExpo`).

**Why**: `requestAnimationFrame` is the correct tool for JS-driven value animations. CSS can't animate text content. The easing curve (fast start, slow finish) makes numbers feel like they "land" on the final value.

**Implementation**: Parse the target number from the element's `textContent` at observe time. Store as `data-target`. During animation, update `textContent` on each frame. Handle number formatting (commas, `$`, `+` suffixes) by extracting prefix/suffix.

### D5: Parallax via scroll event + transform

**Choice**: On `scroll`, apply `transform: translateY(${scrollY * 0.3}px)` to the hero background. Use `requestAnimationFrame` to throttle.

**Why**: `background-attachment: fixed` (the CSS-only parallax approach) causes paint issues on mobile Safari and doesn't work on iOS. Transform-based parallax is universally supported and GPU-composited.

**Rate**: 0.3 factor gives subtle depth without making the image feel disconnected.

### D6: Event countdown as a section widget

**Choice**: Add the countdown as a new `event-countdown` section type in the section renderer. It fetches the next upcoming event from the existing events API endpoint and renders a countdown with days/hours/minutes.

**Why**: Making it a section type means it's schema-driven — admins can reposition or hide it via the sections table, consistent with how all other homepage content works. No special-casing.

**Update frequency**: Countdown updates every 60 seconds via `setInterval`. No need for per-second updates on a community site.

## Risks / Trade-offs

- **[Parallax on low-end mobile]** The scroll listener fires frequently. Mitigation: `requestAnimationFrame` throttling, and only active when `!window.matchMedia('(prefers-reduced-motion: reduce)').matches`. Also disabled on touch devices via `'ontouchstart' in window` check, since parallax is a desktop effect.
- **[Stats counter edge cases]** Stats values might include non-numeric content. Mitigation: regex to extract the numeric portion; fall back to instant display if no number found.
- **[Event countdown showing stale data]** If the page is left open past the event time, countdown could show negative values. Mitigation: when countdown reaches zero, replace with "Happening now!" or hide the section.
- **[Layout shift from fade-in]** Elements starting at `opacity: 0` could cause CLS if they have height. Mitigation: only transform opacity and translateY — the element's space is reserved in layout from the start. The `translateY(20px)` offset is small enough not to cause reflow.
