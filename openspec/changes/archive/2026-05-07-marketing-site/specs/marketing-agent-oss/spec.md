## ADDED Requirements

### Requirement: Agent-friendly and open source section
The marketing page SHALL include a dedicated section communicating that Kychon is:
1. **100% open source** — full source code, no vendor lock-in
2. **Coding agent friendly** — designed to work with Claude Code, Cursor, and other AI coding tools
3. **Customized and deployed in minutes** — config-driven architecture means an AI agent (or a human) can rebrand, restructure, and deploy a portal from scratch in minutes, not weeks

#### Scenario: Section is visible on the page
- **WHEN** a visitor scrolls past the demo showcase section
- **THEN** they see the "Agent-friendly & open source" section before the pricing section

#### Scenario: Open source messaging is clear
- **WHEN** a visitor reads the section
- **THEN** they understand that Kychon is fully open source with no hidden proprietary components

#### Scenario: Agent-friendly messaging explains the value
- **WHEN** a visitor reads the section
- **THEN** they understand that AI coding agents can customize and deploy a portal quickly because the architecture is config-driven (SQL for settings, file editing for code)

### Requirement: Section includes a visual or icon grid
The agent/OSS section SHALL include visual elements (icons, illustration, or a simple diagram) showing the customize-and-deploy flow, not just a wall of text.

#### Scenario: Visual elements break up the text
- **WHEN** a visitor views the section
- **THEN** there are at least 3 visual elements (icons, badges, or illustration) alongside the text content

### Requirement: GitHub/fork link in the section
The section SHALL include a prominent link to fork or view the source code. Pre-launch, this MAY be a `#fork` anchor; post-launch, it SHALL point to the GitHub repository.

#### Scenario: Fork CTA is actionable
- **WHEN** a visitor clicks the fork/source link
- **THEN** they are directed to the GitHub repository or a clear pre-launch placeholder
