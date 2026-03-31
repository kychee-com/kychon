## 1. Card Hover Effects

- [x] 1.1 Add `transition: transform 200ms ease, box-shadow 200ms ease` to `.card` in `styles.css`
- [x] 1.2 Add `.card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }` to `styles.css`

## 2. Skeleton Loading

- [x] 2.1 Add skeleton CSS: `.skeleton` base with `@keyframes skeleton-pulse` (moving gradient), plus `.skeleton-text`, `.skeleton-card`, `.skeleton-avatar` variants
- [x] 2.2 Add `prefers-reduced-motion` override for skeletons (static gray, no animation)
- [x] 2.3 Add skeleton HTML to `index.html` for sections container and announcements feed, replaced on data load
- [x] 2.4 Add skeleton HTML to `events.html` for event cards loading state

## 3. Toast Notifications

- [x] 3.1 Create `site/js/toast.js`: `showToast(message, type)` function with slide-in/out animation, auto-dismiss at 3s, `role="status"` + `aria-live="polite"`, type icons (success/error/info)
- [x] 3.2 Add toast CSS to `styles.css`: fixed bottom-right container, slide-in/out keyframes, type color accents
- [x] 3.3 Wire toast into `index.html`: show toast on announcement post success
- [x] 3.4 Wire toast into `event.html`: show toast on RSVP success/error

## 4. Glassmorphic Nav

- [x] 4.1 Update `.nav` in `styles.css`: add `backdrop-filter: blur(12px)`, change background to `rgba(255,255,255,0.8)`, keep solid fallback
- [x] 4.2 Add `[data-theme="dark"] .nav` override with `rgba(15,23,42,0.8)` background

## 5. Gradient Hero Text

- [x] 5.1 Add `.section-hero h1` gradient text CSS: `background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))`, `-webkit-background-clip: text`, `-webkit-text-fill-color: transparent`

## 6. Dark Mode

- [x] 6.1 Add `[data-theme="dark"]` rule block in `theme.css` overriding all `--color-*` variables with dark palette
- [x] 6.2 Add dark mode shadow variables (`--shadow-sm/md/lg` with lighter alpha for dark backgrounds)
- [x] 6.3 Add dark mode initialization JS in inline `<script>` in all HTML `<head>`: check localStorage `wl_theme` → `prefers-color-scheme` → default light; set `data-theme` attribute on `<html>` before first paint
- [x] 6.4 Add dark mode toggle button (sun/moon icon) in nav, rendered by `config.js` nav builder; toggle sets attribute + saves to localStorage
- [x] 6.5 Ensure glassmorphic nav, skeleton, toast, and card hover all look correct in dark mode

## 7. Integration

- [x] 7.1 Toast module imported via ES import (no script tag needed — `import { showToast } from './toast.js'`)
- [x] 7.2 Verified: card hover lift, skeletons, toasts, glassmorphic nav, gradient hero text, dark mode toggle across all 12 HTML pages
