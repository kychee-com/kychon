## Purpose

`demo/silver-pines/generate-images.sh` produces the demo's photography — hero, member portraits, committee and activity photos — into `demo/silver-pines/assets/`, which the deploy script copies into `public/assets/` and the seed references by path.

## Requirements

### Requirement: Hero image generation
The script SHALL produce 1 hero image depicting a warm, welcoming community centre building with Blue Ridge Mountains in the background, soft natural lighting, and an inviting entrance with an accessible ramp visible.

#### Scenario: Hero image reflects Asheville setting
- **WHEN** the hero image is generated
- **THEN** it shows a community centre with mountain scenery, warm lighting, and an accessible entrance
- **AND** the file lands in `demo/silver-pines/assets/` and is referenced from the seed's homepage hero section

### Requirement: Member portrait generation
The script SHALL generate 20-25 portrait photos of seniors with diverse ages (60-85), diverse ethnicities, natural expressions, and warm lighting. Portraits SHALL show people engaged in activities (gardening, reading, painting, exercising, socializing) rather than generic headshots.

#### Scenario: Portraits are diverse and respectful
- **WHEN** member portraits are generated
- **THEN** they depict a range of ages, ethnicities, and genders
- **AND** subjects appear active, happy, and dignified — not stereotypical or patronizing

#### Scenario: Portraits are linked from the seed
- **WHEN** all portraits are generated
- **THEN** each lands in `demo/silver-pines/assets/` as `avatar-NN.jpg` and its `/assets/…` path is referenced in the corresponding member's seed row

### Requirement: Activity and committee photo generation
The script SHALL generate activity photos covering the seeded event types (tai chi class, watercolor painting session, garden club, book club meeting, tech help desk, community potluck, nature walk, movie night) and one photo per seeded committee. Photos SHALL show seniors actively participating.

#### Scenario: Activity photos match events
- **WHEN** activity photos are generated
- **THEN** each corresponds to a seeded event type and depicts seniors engaged in that activity

#### Scenario: Committee photos match committees
- **WHEN** committee photos are generated
- **THEN** one `committee-*.jpg` exists per seeded committee and is referenced from that committee's seed row

### Requirement: Image generation script is idempotent
`demo/silver-pines/generate-images.sh` SHALL require `OPENAI_API_KEY`, call the OpenAI image API for each named image, write the decoded bytes into `demo/silver-pines/assets/`, and SKIP any image whose file already exists.

#### Scenario: Script generates all images
- **WHEN** `generate-images.sh` is run against an empty assets directory
- **THEN** it generates the hero, portraits, activity photos, and committee photos into `demo/silver-pines/assets/`

#### Scenario: Script is idempotent
- **WHEN** the script is run again after images already exist
- **THEN** it logs `SKIP` for existing files and only generates missing ones

#### Scenario: Missing API key aborts
- **WHEN** `OPENAI_API_KEY` is unset
- **THEN** the script exits with an error naming the required variable
