## Why

Kychon portals look clean but feel flat. Cards don't respond to hover, content flashes in without loading states, actions happen silently with no feedback, and the nav/hero lack the layered depth users expect from modern sites. These six CSS/JS polish improvements — card hover lift, skeleton loading, toast notifications, glassmorphic nav, gradient hero text, and dark mode — close the gap between "functional template" and "premium product" with minimal code across the core `site/` files.

## What Changes

- **Card hover lift**: All `.card` elements gain `translateY(-2px)` + increased shadow on hover, giving interactive depth feedback.
- **Skeleton loading states**: Pulsing placeholder shapes display while page data loads, replacing blank-then-content flash. CSS-only `.skeleton` class with `@keyframes`.
- **Toast notifications**: A lightweight toast system provides slide-in feedback for actions (RSVP, post announcement, reaction, errors). Replaces silent action completion.
- **Glassmorphic nav**: Sticky nav gains `backdrop-filter: blur()` with semi-transparent background for modern layered depth.
- **Gradient hero text**: Hero h1 uses `background-clip: text` with a gradient derived from the theme's primary color for a striking headline effect.
- **Dark mode**: A toggle in the nav switches between light and dark palettes. Preference stored in `localStorage` and respects `prefers-color-scheme` system setting. Uses the existing CSS custom property system — only `theme.css` variables change.

## Capabilities

### New Capabilities
- `card-hover-effects`: Hover lift, shadow transition, and depth feedback on card elements
- `skeleton-loading`: Pulsing placeholder skeleton screens for content loading states
- `toast-notifications`: Slide-in toast messages for action feedback (success, error, info)
- `dark-mode`: Light/dark theme toggle with localStorage persistence and system preference detection

### Modified Capabilities
- `config-driven-ui`: Nav gains glassmorphic backdrop-blur styling; hero section gains gradient text on heading

## Impact

- **Files modified**: `site/css/theme.css` (dark mode variables), `site/css/styles.css` (card hover, skeleton, toast, nav blur, gradient text), `site/index.html` (toast calls on actions, skeleton placeholders, dark mode toggle in nav)
- **Files potentially modified**: `site/events.html`, `site/event.html`, `site/directory.html`, `site/forum.html` (skeleton loading placeholders, toast calls on RSVP/post actions)
- **Files added**: `site/js/toast.js` (toast notification system), dark mode toggle JS (inline or in config.js)
- **No new dependencies**: Pure CSS + vanilla JS
- **No schema changes**: Dark mode preference stored client-side in localStorage
