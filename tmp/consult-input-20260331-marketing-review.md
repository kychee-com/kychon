# Consultation Request

## Project Summary

Kychon is an open-source, AI-powered community/membership portal template built on the Run402 serverless platform. It targets organizations that currently use expensive SaaS platforms like Wild Apricot ($530/mo at scale), Circle, or Bettermode. Kychon offers the same features (member directory, events, forum, announcements, resources, committees) for $5-20/mo flat pricing with no per-member fees. It has three products: the free open-source template (DIY), Kychon Studio ($29 one-time AI-powered build), and Kychon Pro ($9-29/mo ongoing AI customization). The marketing site just launched at kychon.com and eagles.kychon.com is a live showcase demo site populated with AI-generated content for a fictional charity organization. The site is pure static HTML/CSS with no framework.

## User's Question

Review the marketing site. I don't think explicitly referencing the competition is good. Maybe in a secondary page as a comparison table. I'd rather highlight our strengths and demo the cool demo-sites. And suggest how to make it sexier and prettier and more converting.

Specifically:
- The hero currently says "Your community deserves better than Wild Apricot" — should we remove the competitor name-drop?
- The "Problem" section explicitly calls out Wild Apricot, Circle, and Bettermode with their pricing — is this too aggressive? Should it move to a /compare.html page?
- The showcase gallery currently has one real demo (Eagles) and two "Coming Soon" placeholders — how can we make this section shine more?
- The overall design uses Instrument Serif + DM Sans, indigo primary with coral accents, cream backgrounds — how can we make it sexier, more memorable, more converting?
- What's missing from a conversion optimization perspective?
- The live demo site is at eagles.kychon.com — it's a fully populated community portal with 25 members, 10 events, forum threads, announcements with emoji reactions, activity feed, etc.

## Project Context

### marketing/index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kychon — AI-Powered Community Portals</title>
  <meta name="description" content="Open-source membership portal with AI features. Member directory, events, forum, newsletters — $5-20/mo. Own your data.">
  <link rel="stylesheet" href="/css/marketing.css">
</head>
<body>

  <!-- NAV -->
  <nav class="nav">
    <div class="container nav__inner">
      <a href="/" class="nav__brand">
        <span class="nav__brand-icon">&#127819;</span>
        Kychon
      </a>
      <button class="nav__toggle" id="nav-toggle" aria-label="Menu">&#9776;</button>
      <div class="nav__links" id="nav-links">
        <a href="#features" class="nav__link">Features</a>
        <a href="#showcase" class="nav__link">Showcase</a>
        <a href="#pricing" class="nav__link">Pricing</a>
        <a href="#niches" class="nav__link">Who It's For</a>
        <a href="https://github.com/kychee-com/kychon" class="nav__link" target="_blank">GitHub</a>
        <a href="#demo-placeholder" class="btn btn--primary btn--lg nav__cta">Try the Demo</a>
      </div>
    </div>
  </nav>

  <!-- HERO -->
  <section class="hero section section--cream section--dotted">
    <div class="container hero__content">
      <p class="t-overline mb-2">Open Source Community Platform</p>
      <h1 class="t-display t-display--xl hero__headline">
        Your community deserves better than <em>Wild Apricot</em>.
      </h1>
      <p class="t-body--lg hero__sub">
        Kychon is an AI-powered membership portal you actually own. Member directory, events, forum, announcements, newsletters — all for <strong style="color:var(--ink)">$5–20/mo</strong> on your own infrastructure. No per-member fees. No lock-in. No surprise price hikes.
      </p>
      <div class="hero__ctas">
        <a href="#demo-placeholder" class="btn btn--primary btn--lg">Try the Demo →</a>
        <a href="#showcase" class="btn btn--outline btn--lg">See It Live</a>
        <a href="https://github.com/kychee-com/kychon" class="btn btn--ghost btn--lg" target="_blank">Fork on GitHub</a>
      </div>
    </div>
  </section>

  <!-- THE PROBLEM section with competitor cards -->
  <!-- THE FEATURES section with 8 feature cards -->
  <!-- AI FEATURES section (dark theme, 6 cards) -->
  <!-- SHOWCASE gallery (Eagles screenshot + 2 coming soon) -->
  <!-- PRICING (competitor comparison table + 3 plan cards) -->
  <!-- WHO IT'S FOR niche cards -->
  <!-- FINAL CTA -->
  <!-- FOOTER -->

  (Full HTML provided in the index.html file above — all sections included)
</body>
</html>
```

### marketing/css/marketing.css
```css
/* Design: Editorial Indie aesthetic
   Fonts: Instrument Serif (display) + DM Sans (body)
   Colors: Deep indigo (#4338ca) primary, coral (#f97316) accent, cream (#faf7f2) backgrounds
   Features: Dot-grid texture overlays, angled dividers, generous whitespace
   Responsive: Mobile/tablet/desktop breakpoints */

(Full CSS provided above — 852 lines covering all components)
```

### Live URLs
- Marketing site: https://kychon.com (also https://kychon.com)
- Eagles demo: https://eagles.kychon.com (fully populated community portal with 25 members, events, forum, announcements with reactions, activity feed)
- GitHub: https://github.com/kychee-com/kychon

### Current page structure (scroll order)
1. Hero — "Your community deserves better than Wild Apricot" + 3 CTAs
2. The Problem — 3 competitor cards (Wild Apricot $530/mo, Circle $89/mo, Bettermode price hikes) + "What if you could just... own it?"
3. Features — 8 feature cards in 4x2 grid
4. AI Features — 6 AI cards on dark background + BYOK badge
5. Showcase — Eagles screenshot card + 2 "Coming Soon" placeholders
6. Pricing — Competitor comparison table + 3 plan cards (DIY Free, Studio $29, Pro $9-29/mo)
7. Who It's For — 8 niche cards (4 active, 4 coming soon)
8. Final CTA — "Ready to ditch the subscription trap?"
9. Footer

### Niche pages (4 exist)
- /churches.html, /hoa.html, /sports.html, /associations.html
- Each has: niche hero, 6 niche features, pricing plans, CTA
