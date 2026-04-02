# Kychon vs MemberPress

MemberPress is a WordPress plugin for membership sites. It's the go-to for WordPress users who want to gate content behind a paywall. Different architecture (WordPress plugin vs standalone platform) but overlapping use case for membership management.

## Pricing

| | Kychon | MemberPress |
|---|---|---|
| Base price | $5–20/mo (Run402 hosting) | $180–999/yr ($15–83/mo equivalent) |
| Transaction fees | None | None |
| Hosting | Included (Run402) | Separate (need WordPress hosting, $5–50/mo) |
| AI customization | $9–29/mo (optional) | Not available |
| **Typical total cost** | **~$14/mo** | **~$30–100/mo (plugin + hosting)** |

## Feature comparison

| Feature | Kychon | MemberPress |
|---|---|---|
| Member database | Yes | Yes |
| Member directory | Yes | Via addon or theme |
| Content gating | Feature-flagged access control | Yes (core feature — gate any WordPress content) |
| Membership tiers | Yes | Yes (with drip content) |
| Recurring billing | Not yet (external Stripe link) | Yes (Stripe, PayPal, Authorize.net) |
| Courses | No | Yes (built-in LMS) |
| Event management | Yes | No (need separate plugin) |
| Announcements | Yes | Via WordPress posts |
| Admin dashboard | Yes (built-in) | WordPress admin + MemberPress panels |
| Inline editing | Yes | Via WordPress editor |
| Forum / discussions | Yes | Via bbPress or BuddyBoss |
| AI customization | Yes | No |
| i18n / multi-language | Yes (built-in) | Via WPML or Polylang |
| Custom design | Full HTML/CSS | Full (WordPress themes) |
| Self-hosted | Yes (Run402) | Yes (WordPress hosting) |

## Where MemberPress wins

- **Recurring billing** — Built-in subscription management with Stripe, PayPal, and Authorize.net. This is MemberPress's core strength. Kychon doesn't have built-in billing yet.
- **Content gating** — Gate any WordPress page, post, or custom content behind membership tiers with drip scheduling. MemberPress was built for this.
- **WordPress ecosystem** — Access to 60,000+ WordPress plugins. Need a job board? Install a plugin. Need SEO? Yoast. Need forms? Gravity Forms. Kychon's ecosystem is its AI agent.
- **Courses / LMS** — Built-in learning management system. Kychon doesn't have courses.
- **No transaction fees** — Same as Kychon. Both are zero transaction fee.
- **Design flexibility** — WordPress's theme ecosystem means thousands of design options.

## Where Kychon wins

- **Simplicity** — One platform, everything built-in. No WordPress + hosting + MemberPress + directory plugin + event plugin + forum plugin + caching plugin stack to manage.
- **Events** — Built-in event management with RSVP and attendance. MemberPress needs a separate plugin.
- **Member directory** — Built-in, first-class. MemberPress needs an addon or BuddyBoss.
- **Community features** — Built-in announcements, activity feed, forum. MemberPress is a paywall tool, not a community platform.
- **No WordPress required** — MemberPress requires WordPress expertise. Kychon requires none.
- **AI customization** — "Add a volunteer tracking page" via AI agent. WordPress customization means hiring a developer or learning PHP.
- **Security and maintenance** — WordPress requires constant updates (core, themes, plugins) and is a top target for attacks. Kychon is serverless with no WordPress attack surface.
- **Performance** — ~15kB page load. WordPress sites typically load 1–5MB depending on theme and plugins.
- **Admin experience** — Purpose-built admin dashboard vs WordPress admin (which wasn't designed for membership management).

## Who should pick which

**Pick MemberPress if:** You already run a WordPress site and want to add membership gating, you need built-in recurring billing, you want to sell courses, or you're comfortable managing a WordPress stack.

**Pick Kychon if:** You want a purpose-built community portal without the WordPress complexity, you don't want to manage hosting + plugins + updates, you want AI-powered customization, or you want built-in events, directory, and community features out of the box.
