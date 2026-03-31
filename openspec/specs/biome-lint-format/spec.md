## ADDED Requirements

### Requirement: Biome configuration exists

The project SHALL have a `biome.json` configuration file at the root that enables linting and formatting for JavaScript files. The config SHALL use Biome's recommended rules with project-specific overrides.

#### Scenario: Biome config present
- **WHEN** a developer clones the repo
- **THEN** `biome.json` SHALL exist with lint and format settings

### Requirement: Lint command available

The project SHALL have an `npm run lint` script that runs `biome check .` and exits non-zero on any lint or format violation.

#### Scenario: Lint passes on clean code
- **WHEN** `npm run lint` is run on properly formatted code
- **THEN** the command SHALL exit with code 0

#### Scenario: Lint fails on violations
- **WHEN** `npm run lint` is run on code with lint errors or format issues
- **THEN** the command SHALL exit non-zero and report the violations

### Requirement: Format command available

The project SHALL have an `npm run format` script that runs `biome format --write .` to auto-fix formatting across all JS, CSS, and JSON files.

#### Scenario: Format fixes files in place
- **WHEN** `npm run format` is run
- **THEN** all JS, CSS, and JSON files SHALL be formatted according to the Biome config

### Requirement: Existing code passes lint

After initial formatting, all existing code in `site/js/`, `functions/`, and `tests/` SHALL pass `biome check .` without errors.

#### Scenario: Clean lint on existing code
- **WHEN** `npm run lint` is run after the initial format commit
- **THEN** zero violations SHALL be reported
