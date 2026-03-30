## ADDED Requirements

### Requirement: Resource File Upload

The system SHALL support file uploads via an edge function to Run402 storage. Supported file types MUST include pdf, video, link, and image. Only admin users SHALL be able to upload resources.

#### Scenario: Admin uploads a PDF resource
- **WHEN** an admin uploads a PDF file through the resource upload form
- **THEN** the file SHALL be stored in Run402 storage and a resource record SHALL be created

#### Scenario: Admin uploads a video resource
- **WHEN** an admin uploads a video file through the resource upload form
- **THEN** the file SHALL be stored and the resource type SHALL be set to video

#### Scenario: Admin adds a link resource
- **WHEN** an admin submits a URL as a link-type resource
- **THEN** the resource record SHALL be created with the link URL stored

#### Scenario: Unsupported file type rejected
- **WHEN** an admin attempts to upload a file type not in the allowed list (pdf, video, link, image)
- **THEN** the system SHALL reject the upload

### Requirement: Resource Categories

The system SHALL support categorizing resources. Each resource MUST belong to a category.

#### Scenario: Admin assigns a category to a resource
- **WHEN** an admin creates or edits a resource and selects a category
- **THEN** the resource SHALL be associated with the selected category

### Requirement: Resource Listing Page

The system SHALL display a resource listing page with a category filter, allowing users to browse resources by category.

#### Scenario: User views resource listing
- **WHEN** a user visits the resources page
- **THEN** all accessible resources SHALL be listed with their categories

#### Scenario: User filters resources by category
- **WHEN** a user selects a category from the filter
- **THEN** only resources in the selected category SHALL be displayed

### Requirement: Resource Download Access Control

Resource downloads SHALL enforce members-only access control. Members-only resources MUST require authentication before allowing download.

#### Scenario: Authenticated member downloads a members-only resource
- **WHEN** an authenticated member clicks download on a members-only resource
- **THEN** the file SHALL be served for download

#### Scenario: Anonymous user attempts to download a members-only resource
- **WHEN** an anonymous user attempts to download a members-only resource
- **THEN** the system SHALL deny access and prompt for authentication

### Requirement: Resource Administration

Admin users SHALL be able to upload, edit, and delete resources. Non-admin users SHALL NOT have access to resource management operations.

#### Scenario: Admin edits a resource
- **WHEN** an admin updates a resource's title, category, or file
- **THEN** the resource record SHALL be updated

#### Scenario: Admin deletes a resource
- **WHEN** an admin deletes a resource
- **THEN** the resource SHALL be removed from the listing and its file removed from storage
