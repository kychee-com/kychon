## ADDED Requirements

### Requirement: AI-Enhanced Onboarding Trigger

The AI onboarding function SHALL be an enhancement to the existing on-signup function. It MUST require the feature_ai_onboarding flag to be enabled and the AI_API_KEY secret to be set.

#### Scenario: New member signs up with AI onboarding enabled
- **WHEN** a new member completes signup and feature_ai_onboarding is enabled and AI_API_KEY is set
- **THEN** the AI onboarding function SHALL be triggered

#### Scenario: New member signs up with AI onboarding disabled
- **WHEN** a new member completes signup and feature_ai_onboarding is disabled
- **THEN** the standard signup flow SHALL proceed without AI enhancement

### Requirement: Personalized Welcome Message Generation

The system SHALL generate a personalized welcome message by sending the new member's profile and tier information to the AI API.

#### Scenario: AI generates personalized welcome for standard tier member
- **WHEN** the AI onboarding function processes a new standard tier member
- **THEN** the AI API SHALL receive the member's profile and tier and return a personalized welcome message

#### Scenario: AI generates personalized welcome for premium tier member
- **WHEN** the AI onboarding function processes a new premium tier member
- **THEN** the AI API SHALL receive the member's profile and tier and return a personalized welcome message tailored to premium benefits

### Requirement: Welcome Email Delivery

The personalized welcome message SHALL be sent to the new member via the Run402 email notification template.

#### Scenario: Welcome email sent successfully
- **WHEN** the AI generates a personalized welcome message
- **THEN** the message SHALL be sent to the new member's email using the Run402 email notification template

### Requirement: Activity Logging

The AI onboarding function SHALL log all actions to the activity_log, including successful message generation and delivery.

#### Scenario: Successful onboarding logged
- **WHEN** the AI onboarding function completes successfully
- **THEN** an entry SHALL be written to the activity_log recording the onboarding action and member reference

### Requirement: Graceful Fallback

If the AI API is unavailable or returns an error, the system SHALL fall back to the standard signup flow. The fallback SHALL be logged.

#### Scenario: AI API unavailable during onboarding
- **WHEN** the AI onboarding function is triggered but the AI API is unavailable
- **THEN** the standard signup flow SHALL proceed and the fallback SHALL be logged to activity_log

#### Scenario: AI API returns an error
- **WHEN** the AI onboarding function receives an error from the AI API
- **THEN** the standard signup flow SHALL proceed and the error SHALL be logged to activity_log
