# newsletter-signup Specification

## ADDED Requirements

### Requirement: Visitors can subscribe through a first-class block

The engine SHALL provide a `newsletter_signup` block whose markup is
engine-rendered HTML (never sanitized user content), collecting email
(always) plus an admin-configured subset of name fields, tagged with a
per-instance `subscription_source`, and submitting to the
`newsletter-subscribe` function. The form SHALL work without JavaScript via
a server-rendered response page; JavaScript MAY enhance the result inline.

#### Scenario: Subscription creates a tagged subscriber

- **WHEN** a visitor submits a valid email on a block whose
  `subscription_source` is "Newsletter"
- **THEN** a `subscribers` row exists with that email, source "Newsletter",
  and status `subscribed`
- **AND** resubmitting the same email succeeds idempotently without a
  duplicate row

#### Scenario: No-JS submission still lands

- **WHEN** the form is posted with JavaScript disabled
- **THEN** the function returns a human-readable confirmation page
- **AND** the subscriber row is created

### Requirement: Abuse controls live in the function

The `newsletter-subscribe` function SHALL reject submissions whose honeypot
field is filled, SHALL throttle repeated submissions per source address,
and SHALL normalize emails (trim, lowercase) before upsert.

#### Scenario: Honeypot rejects bots silently

- **WHEN** a submission arrives with the honeypot field non-empty
- **THEN** no subscriber row is created
- **AND** the response is indistinguishable from success

### Requirement: Optional confirmation email matches Wild Apricot parity

Each block instance SHALL be configurable to send a confirmation email to
the subscriber, the administrator, both, or neither (single opt-in; a
`confirmed_at` column is reserved for future double opt-in). Confirmation
emails SHALL include the tokened unsubscribe link.

#### Scenario: Subscriber confirmation carries unsubscribe

- **WHEN** a block configured with subscriber confirmation receives a valid
  submission
- **THEN** the subscriber receives one confirmation email
- **AND** it contains their tokened unsubscribe link

### Requirement: Admins can build blast lists by source

Admin-only capability operations SHALL list subscribers filtered by
`subscription_source` and export them as CSV from the admin surface;
anonymous callers SHALL have no read access to subscriber rows.

#### Scenario: Source-filtered export

- **WHEN** an admin exports subscribers for source "Newsletter"
- **THEN** the CSV contains exactly the subscribed rows tagged "Newsletter"

#### Scenario: Anonymous read is denied

- **WHEN** an anonymous caller invokes `subscribers.list`
- **THEN** the request is rejected with a permission error

### Requirement: Unsubscribe is tokened and immediate

A tokened unsubscribe link SHALL flip the subscriber's status to
`unsubscribed` without authentication and SHALL be idempotent; exports and
list operations SHALL exclude unsubscribed rows by default.

#### Scenario: Unsubscribe excludes from future exports

- **WHEN** a subscriber follows their unsubscribe link
- **THEN** their status is `unsubscribed`
- **AND** a subsequent default export for their source omits them
