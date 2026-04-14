## Context

The marketing site v1 launched at kychon.com but an external review identified structural issues: competitor-first messaging, placeholder content, card-heavy layout, and missing conversion elements. The live Eagles demo at eagles.kychon.com is the strongest asset but is buried below two sections of competitor attacks.

Full consultation at `docs/consultations/marketing-site-review-conversion.md`.

## Goals / Non-Goals

**Goals:**
- Product-led homepage that shows the Eagles demo prominently
- Positive, aspirational tone (no competitor names on the homepage)
- Fewer card grids, more product screenshots
- Complete FAQ and "how it works" to reduce bounce
- Brand color shift toward lychee-rose for memorability
- Competitor comparison content preserved on a dedicated /compare.html page

**Non-Goals:**
- Video production or animated product tours (future)
- Custom SVG logo (separate effort)
- New showcase demo sites (Eagles subpages are enough for now)
- Email capture / waitlist (future)

## Decisions

### D1: New homepage section order

```
1. Hero (product screenshot + "Own your member portal")
2. Product tour (4-6 Eagles subpage tiles with screenshots)
3. Three benefits (cost, ownership, customization)
4. How it works (3 steps)
5. Features (existing 8-card grid — keep but tighten)
6. AI features (existing dark section — keep)
7. Niche templates (4 real ones only, no "coming soon")
8. Pricing (plans only, no competitor table)
9. FAQ
10. Final CTA
11. Footer (with link to /compare.html)
```

**Rationale:** Demo first, benefits second, details later. This follows the consultation's recommended flow.

### D2: Hero with browser mockup

The hero shows the Eagles homepage screenshot inside a browser chrome frame (CSS-only, no image). The screenshot is the same one from `capture-screenshots.sh`. Floating stat chips ("25 members", "10 events") add visual interest.

**Alternatives considered:**
- Embedded iframe of the live demo: slow, CORS issues, breaks mobile
- Video autoplay: high production effort for v2

### D3: Showcase as product tour tiles

Instead of a gallery of different communities, the showcase becomes a tour of one rich community. 4-6 tiles, each showing a different Eagles page (home, directory, events, forum). Each tile links directly to that page on eagles.kychon.com.

Screenshots captured via extended `capture-screenshots.sh` with new URLs:
- `eagles.kychon.com/` (already captured)
- `eagles.kychon.com/directory.html`
- `eagles.kychon.com/events.html`
- `eagles.kychon.com/forum.html`

### D4: Brand color evolution

Add lychee-rose (`#f15b86`) as an accent color alongside indigo. Use rose for:
- Hero headline highlight (replaces coral underline)
- Secondary CTA hover states
- Gradient accents in the AI section

Keep indigo as the primary trust color. Keep coral for tertiary accents only.

```css
--rose: #f15b86;
--rose-light: #f9a8c2;
--rose-wash: #fff1f5;
```

### D5: Compare page structure

`/compare.html` gets the competitor content removed from the homepage:
- Pricing comparison table (Wild Apricot, Circle, Bettermode vs Kychon)
- Feature comparison grid
- Migration callout
- CTA to demo/Studio

Linked from:
- Homepage FAQ ("Switching from Wild Apricot?")
- Homepage footer
- Future SEO landing pages

## Risks / Trade-offs

**[Screenshot maintenance]** → More screenshots = more to recapture on updates. **Mitigation:** `capture-screenshots.sh` is already automated. Add new URLs to the script.

**[Eagles subpages may look sparse]** → If directory/events/forum have limited seed data, tiles will look weak. **Mitigation:** Eagles already has 25 members, 10 events, 15 forum topics — density is fine.

**[Color shift may feel inconsistent]** → Introducing rose alongside existing indigo/coral. **Mitigation:** Rose replaces coral in most places (coral was barely used). Clean swap.
