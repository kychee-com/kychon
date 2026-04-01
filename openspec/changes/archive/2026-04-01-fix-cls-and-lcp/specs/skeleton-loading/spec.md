## MODIFIED Requirements

### Requirement: Pages show skeletons while loading

Pages that fetch data SHALL display skeleton placeholders in their content containers while waiting for API responses. Skeletons SHALL be replaced with actual content once data arrives. Skeleton containers SHALL have explicit `min-height` matching the approximate size of the content they replace, preventing layout shift when real content swaps in.

#### Scenario: Homepage sections loading
- **WHEN** the homepage is loading sections from the API
- **THEN** skeleton card placeholders are visible in the sections container
- **THEN** the skeleton container has `min-height` matching typical section content height
- **THEN** skeletons are replaced with rendered sections once data arrives without layout shift

#### Scenario: Announcements loading
- **WHEN** the announcements feed is loading
- **THEN** skeleton text placeholders matching announcement card shape are visible
- **THEN** skeletons are replaced with announcement cards once data arrives without layout shift

#### Scenario: Skeleton-to-content swap is shift-free
- **WHEN** skeleton placeholders are replaced with real content
- **THEN** the cumulative layout shift caused by the swap is less than 0.05
