## Why

Lighthouse scores are 50-75/100 across the 3 demo sites. Two metrics are responsible:

- **CLS (Cumulative Layout Shift)**: 0.575-0.95 (good is < 0.1). Homepage sections are fetched from the API and injected into the DOM, pushing all content below them. The fade-in animation starts sections at `opacity: 0; transform: translateY(20px)` which collapses them, then they expand on visibility.
- **LCP (Largest Contentful Paint)**: 10.8-11.6s on Silver Pines and Barrio Unido (good is < 2.5s). The hero background image loads through a 3-hop chain: config fetch → sections fetch → CSS background-image download. No preloading, no optimization.

Current Lighthouse scores: Eagles 75, Silver Pines 50, Barrio Unido 52. Target: 90+ on all three.

## What Changes

- Reserve explicit space for dynamically-loaded homepage sections using CSS `min-height` on the sections container and skeleton placeholders that match real content dimensions
- Fix the scroll animation CSS so sections maintain their layout space while invisible (`visibility: hidden` instead of `opacity: 0` with collapsed height)
- Add `<link rel="preload">` for the hero background image, injected early by config.js from cached config
- Parallelize homepage API calls (`sections`, `announcements`, `activity_log`) with `Promise.all()` instead of sequential awaits
- Set explicit `width`/`height` or `aspect-ratio` on all image containers to prevent reflow
- Add `min-height` to the hero section and nav to prevent shifts as they populate

## Capabilities

### New Capabilities
- `perf-cls-prevention`: CSS and HTML patterns that prevent layout shift from dynamic content injection

### Modified Capabilities
- `scroll-animations`: Animation CSS changes from opacity-collapse to visibility-hidden (preserves layout space)
- `config-driven-ui`: Hero image preloading from cached config; parallel section/announcement loading
- `skeleton-loading`: Skeleton placeholders sized to match real content dimensions

## Impact

- **Code**: `site/css/styles.css` (animation CSS, hero min-height, section containers), `site/index.html` (preload tag, parallel fetches, image dimensions), `site/js/config.js` (preload injection)
- **Risk**: Low — visual-only changes, no data/API changes. Scroll animations will look slightly different (visibility swap vs opacity fade).
- **Tests**: Update scroll animation tests to verify new CSS pattern. Add CLS regression test.
