## Context

Kychon portals use a CSS custom property system (`theme.css`) for all colors, shadows, and typography. All pages share `styles.css`. The nav, cards, and sections are vanilla HTML/JS with no framework. Batch 1 added scroll animations, stat counters, reaction effects, parallax, and event countdown. This batch adds the next layer of visual polish: depth, loading states, feedback, and dark mode.

## Goals / Non-Goals

**Goals:**
- Cards feel interactive (hover lift + shadow)
- Content loads gracefully (skeleton placeholders, not blank-then-flash)
- Actions feel acknowledged (toast messages)
- Nav has modern layered depth (glassmorphism)
- Hero headline is visually striking (gradient text)
- Users can switch to dark mode; preference persists and respects system setting
- All changes apply to every portal built on Kychon

**Non-Goals:**
- No admin UI for configuring dark mode colors (dark palette is derived from theme)
- No per-page skeleton customization (one generic skeleton pattern)
- No toast queue management or toast stacking (max 1 visible at a time)
- No glassmorphism on mobile nav dropdown (keep simple for performance)

## Decisions

### D1: Dark mode via `[data-theme="dark"]` on `<html>`

**Choice**: Toggle by adding `data-theme="dark"` to `document.documentElement`. Dark palette defined in `theme.css` under `[data-theme="dark"]` selector that overrides all `--color-*` variables.

**Why**: This approach means zero changes to `styles.css` or any component CSS — they all use `var(--color-*)` already. Only `theme.css` needs a new rule block. The toggle JS sets the attribute + saves to `localStorage`. On load, check `localStorage` first, then `prefers-color-scheme`, then default to light.

**Alternative**: Separate `dark.css` file. Rejected — doubles the CSS surface area and requires maintaining two files in sync.

### D2: Toast as a standalone `toast.js` module

**Choice**: Create `site/js/toast.js` exporting a `showToast(message, type)` function. Types: `success`, `error`, `info`. Toast slides in from the bottom-right, auto-dismisses after 3 seconds. Only one toast visible at a time (new toast replaces old).

**Why**: Toast is used across many pages (RSVP, announcements, forum posts, resource uploads). A standalone module is imported where needed. Keeping it as a single-toast system avoids stacking complexity.

**Implementation**: Toast container is a fixed-position div appended to body on first call. CSS handles slide-in animation. Each toast has an icon (checkmark / X / info) and message text.

### D3: Skeleton loading as CSS-only utility classes

**Choice**: `.skeleton` class applies a pulsing gray gradient animation. Variant classes: `.skeleton-text` (single line), `.skeleton-card` (card-shaped block), `.skeleton-avatar` (circle). Pages render skeleton HTML in their containers, then replace with real content after fetch.

**Why**: CSS-only approach means no JS overhead. Pages just need to put skeleton HTML in their loading containers and remove it when data arrives. The pulse animation uses `@keyframes` with a moving gradient.

### D4: Glassmorphic nav with fallback

**Choice**: Add `backdrop-filter: blur(12px); background: rgba(255,255,255,0.8)` to `.nav`. Dark mode uses `rgba(15,23,42,0.8)`.

**Why**: `backdrop-filter` is supported in all modern browsers (Chrome 76+, Safari 9+, Firefox 103+). For the rare unsupported case, the existing solid background is the fallback (the `background` property is set before `backdrop-filter`, so unsupported browsers just see the solid color).

### D5: Gradient text derived from primary color

**Choice**: Hero h1 gets `background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))` with `-webkit-background-clip: text`. This means the gradient automatically matches whatever theme the portal uses.

**Why**: Using the existing CSS variables means the gradient adapts to any portal's color scheme. The 135deg angle matches the existing hero gradient direction for visual consistency.

### D6: Card hover — transform + shadow transition

**Choice**: `.card` gets `transition: transform 200ms ease, box-shadow 200ms ease` and on hover: `transform: translateY(-2px); box-shadow: var(--shadow-md)`. Cards that are already interactive (links, buttons inside) get the lift. Non-interactive cards in admin tables do NOT get hover lift.

**Why**: `translateY` + shadow increase is the standard "lift" pattern. 200ms is fast enough to feel responsive but smooth enough to not be jarring. Using `--shadow-md` on hover (up from `--shadow-sm` default) creates clear depth feedback.

## Risks / Trade-offs

- **[Dark mode color accuracy]** Auto-derived dark palette may not look great with every possible primary color. Mitigation: dark palette uses desaturated/lightened variants that work with most hues. Portal admins can override via `site_config` theme if needed.
- **[Glassmorphism on busy backgrounds]** `backdrop-filter: blur` can look muddy over complex images. Mitigation: the nav is at the top of the page where content is typically simple; hero images scroll under it which actually looks great.
- **[Skeleton flash]** On fast connections, skeletons may flash briefly before content appears. Mitigation: add a 150ms delay before showing skeletons (content that loads faster than 150ms never shows a skeleton).
- **[Toast accessibility]** Screen readers need to announce toasts. Mitigation: toast container gets `role="status"` and `aria-live="polite"`.
