## ADDED Requirements

### Requirement: FAQ section on homepage

The homepage SHALL include a FAQ section answering at least 6 common questions using expandable `<details>` elements. Questions SHALL include: cost verification, technical skill requirements, data ownership, migration from competitors, AI feature explanation, and affordability justification.

#### Scenario: FAQ renders with expandable questions
- **WHEN** the visitor scrolls to the FAQ section
- **THEN** at least 6 FAQ items SHALL be visible as expandable summaries

#### Scenario: FAQ addresses affordability
- **WHEN** the FAQ section renders
- **THEN** one question SHALL explain why Kychon is so affordable (open source + Run402 infrastructure)
