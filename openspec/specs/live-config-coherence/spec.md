# live-config-coherence Specification

## Purpose
TBD - created by archiving change live-config-coherence. Update Purpose after archive.
## Requirements
### Requirement: Live-editable config fields reconcile at runtime

The build-time seed/snapshot SHALL be treated as a first-paint cache only, never as the authority for any `site_config` field declared live-editable. Every `site_config` field whose declared apply-mode is `runtime` SHALL be re-read from the live project database and re-applied to the rendered page on each page load (and on the `wl-config-changed` revalidate), with no rebuild or re-deploy required.

#### Scenario: Live edit to a runtime field publishes on reload

- **WHEN** an admin or agent updates a `runtime`-declared `site_config` field on a deployed project and reloads the page
- **THEN** the rendered page reflects the new value
- **AND** no rebuild or redeploy was required

#### Scenario: Baked first paint reconciles to live value

- **WHEN** the build-time bake produced a value for a `runtime`-declared field that differs from the current live DB value
- **THEN** first paint may briefly show the baked value
- **AND** the runtime reconciliation re-applies the live value on the same load

### Requirement: Config field-editability registry

The engine SHALL maintain a single machine-readable registry that maps each `site_config` field consumed by chrome or theme rendering to an apply-mode of either `runtime` or `redeploy`, together with a human-readable reason. The registry SHALL be the single source consulted by runtime reconciliation, the build-time bake, the guard test, and the agent affordance.

#### Scenario: custom_css and fonts are declared runtime

- **WHEN** the registry is read
- **THEN** `custom_css` is declared with apply-mode `runtime`
- **AND** the font-family fields (`theme.font_heading` / `theme.font_body`) are declared with apply-mode `runtime`

#### Scenario: Build-only fields are declared redeploy with a reason

- **WHEN** the registry is read
- **THEN** the fields that must be inlined before first paint (`color_scheme` and `motion`) are declared with apply-mode `redeploy`
- **AND** each carries a human-readable reason explaining why a redeploy is required
- **AND** the `redeploy` set is limited to those irreducible pre-paint fields

### Requirement: No silent build-only config fields

A `site_config` field consumed only at build time SHALL be declared `redeploy` in the registry. The engine SHALL NOT consume a `site_config` field at build time without a runtime reconciliation path unless that field is declared `redeploy`. A continuous-integration guard SHALL fail when this invariant is violated.

#### Scenario: Undeclared baked-only field fails CI

- **WHEN** a `site_config` field is consumed by the chrome/theme bake but has neither a runtime reconciliation path nor a `redeploy` declaration in the registry
- **THEN** the guard test fails
- **AND** the failure identifies the offending field

#### Scenario: Declared redeploy field is reported, not silently ignored

- **WHEN** an agent attempts to change a field declared `redeploy`
- **THEN** the engine's affordance reports that the change requires a redeploy
- **AND** the change is not treated as a silently effective live edit

### Requirement: Agents can discover field apply-modes where they edit

The field-editability registry SHALL be projected into a queryable artifact co-located with the served site (`/config-fields.json`, generated from the typed registry at build) so an agent operating against a live portal can determine a field's apply-mode next to the `site_config` it edits, without consulting separate documentation. The same registry SHALL also be reflected into the agent documentation for repo-context agents. Both projections SHALL be generated from the single typed registry, never hand-authored.

#### Scenario: SQL-operating agent looks up a field before editing

- **WHEN** an agent fetches `/config-fields.json` for `custom_css` and for `color_scheme`
- **THEN** it learns `custom_css` is `runtime` (publishes on reload)
- **AND** it learns `color_scheme` is `redeploy` (requires a rebuild because it is inlined before first paint)

#### Scenario: Queryable affordance matches the typed source

- **WHEN** `/config-fields.json` is generated
- **THEN** its entries match the typed registry module exactly
- **AND** no entry is authored independently of the registry

### Requirement: First paint matches live config when building against a live project

When a build runs against a live project (project credentials present), the chrome bake SHALL source the registry-tracked coherence fields from the live config API and override the static snapshot, falling back to the static snapshot when the live fetch is unavailable.

#### Scenario: Live value overrides snapshot at build

- **WHEN** a deploy runs with live project credentials and the live `custom_css` differs from the snapshot
- **THEN** the baked first-paint HTML carries the live `custom_css` value

#### Scenario: Snapshot fallback on fetch failure

- **WHEN** the build cannot reach the live config API
- **THEN** the bake falls back to the static snapshot value
- **AND** first paint renders without error (no brand-flash regression)

