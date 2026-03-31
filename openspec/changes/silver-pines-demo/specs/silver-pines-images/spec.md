## ADDED Requirements

### Requirement: Hero image generation
The image generation script SHALL produce 1 hero image depicting a warm, welcoming community center building with Blue Ridge Mountains in the background, soft natural lighting, and an inviting entrance with accessible ramp visible.

#### Scenario: Hero image reflects Asheville setting
- **WHEN** the hero image is generated
- **THEN** it shows a community center with mountain scenery, warm lighting, and an accessible entrance
- **AND** the image is uploaded to Run402 storage and referenced in the seed's homepage hero section

### Requirement: Member portrait generation
The script SHALL generate 20-25 portrait photos of seniors with diverse ages (60-85), diverse ethnicities, natural expressions, and warm lighting. Portraits SHALL show people engaged in activities (gardening, reading, painting, exercising, socializing) rather than generic headshots.

#### Scenario: Portraits are diverse and respectful
- **WHEN** member portraits are generated
- **THEN** they depict a range of ages, ethnicities, and genders
- **AND** subjects appear active, happy, and dignified — not stereotypical or patronizing

#### Scenario: Portraits are uploaded and linked
- **WHEN** all portraits are generated
- **THEN** each is uploaded to Run402 storage and its URL is referenced in the corresponding member's seed data row

### Requirement: Activity photo generation
The script SHALL generate 6-8 activity photos: tai chi class, watercolor painting session, garden club, book club meeting, tech help desk, community potluck, nature walk, and movie night setup. Photos SHALL show seniors actively participating.

#### Scenario: Activity photos match events
- **WHEN** activity photos are generated
- **THEN** each corresponds to a seeded event type and depicts seniors engaged in that activity

#### Scenario: Photos uploaded to storage
- **WHEN** all activity photos are generated
- **THEN** each is uploaded to Run402 storage and referenced in the corresponding event's seed data

### Requirement: Image generation script
The script (`demo/silver-pines/generate-images.sh`) SHALL use the OpenAI image API to generate all images, upload them to Run402 storage, and output a mapping of image names to storage URLs for use in seed data. The script SHALL be idempotent — skipping images that already exist in storage.

#### Scenario: Script generates all images
- **WHEN** `generate-images.sh` is run for the first time
- **THEN** it generates 1 hero + 20-25 portraits + 6-8 activity photos and uploads all to Run402 storage

#### Scenario: Script is idempotent
- **WHEN** the script is run again after images already exist
- **THEN** it skips existing images and only generates missing ones

#### Scenario: Script outputs URL mapping
- **WHEN** the script completes
- **THEN** it writes a JSON file mapping image names to their Run402 storage URLs for seed data reference
