## ADDED Requirements

### Requirement: Competitor comparison page

A `/compare.html` page SHALL display competitor pricing and feature comparisons. The page SHALL include the pricing comparison table (Wild Apricot, Circle, Bettermode vs Wild Lychee at 100/500/2000/5000 members) and a feature comparison grid. The page SHALL end with a CTA to explore the demo or start a Studio build.

#### Scenario: Compare page renders with pricing table
- **WHEN** a visitor navigates to wildlychee.com/compare.html
- **THEN** a pricing comparison table SHALL show costs at different member counts

#### Scenario: Compare page linked from homepage
- **WHEN** a visitor clicks "See the full comparison" on the homepage benefits section
- **THEN** the visitor SHALL be directed to /compare.html
