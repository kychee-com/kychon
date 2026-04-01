#!/bin/bash
# Generate AI images for The Eagles demo site
set -e

: "${OPENAI_API_KEY:?Set OPENAI_API_KEY env var}"
ASSETS_DIR="$(dirname "$0")/assets"
mkdir -p "$ASSETS_DIR"

generate() {
  local name="$1"
  local prompt="$2"
  local size="${3:-1024x1024}"
  local quality="${4:-medium}"

  if [ -f "$ASSETS_DIR/$name" ]; then
    echo "SKIP $name (exists)"
    return
  fi

  echo "GEN  $name ..."
  local response
  response=$(curl -s https://api.openai.com/v1/images/generations \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d "$(jq -n --arg model "gpt-image-1.5" --arg prompt "$prompt" --arg size "$size" --arg quality "$quality" \
      '{model: $model, prompt: $prompt, n: 1, size: $size, quality: $quality}')")

  local b64
  b64=$(echo "$response" | jq -r '.data[0].b64_json // empty')
  if [ -z "$b64" ]; then
    echo "FAIL $name: $(echo "$response" | jq -r '.error.message // "unknown error"')"
    return 1
  fi

  echo "$b64" | base64 -d > "$ASSETS_DIR/$name"
  echo "OK   $name ($(wc -c < "$ASSETS_DIR/$name" | tr -d ' ') bytes)"
}

# Logo
generate "logo.png" \
  "A professional logo for 'The Eagles - Good Samaritans of Wichita'. A majestic bald eagle with spread wings, rendered in navy blue (#1b365d) and gold (#d4a843). Clean, modern vector-style design suitable for a charitable community organization. Transparent/white background. No text in the image." \
  "1024x1024" "high"

# Hero image
generate "hero.jpg" \
  "A warm, inspiring photograph of diverse volunteers working together at a community food drive in Wichita, Kansas. People of various ages and ethnicities sorting food donations in a community center, smiling and collaborating. Golden afternoon light, warm tones. Professional photography style." \
  "1536x1024" "high"

# Event photos
generate "event-food-drive.jpg" \
  "Volunteers organizing boxes of food at a food bank warehouse. Diverse group of people in matching navy blue t-shirts with gold text. Warm, inviting atmosphere. Professional event photography." \
  "1024x1024" "medium"

generate "event-park-cleanup.jpg" \
  "Community volunteers picking up litter and planting flowers in a public park in Wichita, Kansas. Sunny day, green grass, people wearing gloves and carrying trash bags. Cheerful and productive atmosphere." \
  "1024x1024" "medium"

generate "event-fundraiser-gala.jpg" \
  "An elegant charity fundraiser gala dinner in a decorated banquet hall. Round tables with white tablecloths, centerpieces, people in semi-formal attire socializing. Navy and gold color scheme decorations. Warm lighting." \
  "1024x1024" "medium"

generate "event-habitat-build.jpg" \
  "Volunteers building a house for Habitat for Humanity. People wearing hard hats and tool belts, working on framing a wall. Sunny day, construction site, community teamwork." \
  "1024x1024" "medium"

generate "event-youth-day.jpg" \
  "A youth mentoring day at a community center. Teenagers and adult mentors doing arts and crafts, sports, and team-building activities together. Energetic and fun atmosphere." \
  "1024x1024" "medium"

generate "event-training.jpg" \
  "A volunteer training workshop in a modern meeting room. Presenter at a whiteboard, diverse group of attendees taking notes and engaging. Professional and welcoming environment." \
  "1024x1024" "medium"

generate "event-coat-drive.jpg" \
  "Volunteers sorting winter coats, scarves, and gloves on long tables at a community center. Piles of colorful warm clothing, cardboard boxes labeled by size. Diverse helpers working together. Warm indoor lighting." \
  "1024x1024" "medium"

generate "event-mlk-day.jpg" \
  "A large group of diverse community volunteers painting and repairing a community building on MLK Day of Service. People holding paint rollers and brushes, wearing matching volunteer t-shirts. Uplifting, collaborative atmosphere." \
  "1024x1024" "medium"

generate "event-holiday-baskets.jpg" \
  "Volunteers in a warehouse assembling holiday food baskets on a long assembly line. Turkeys, canned goods, and grocery bags on tables. Festive decorations, people wearing Santa hats and smiling. Warm, cheerful atmosphere." \
  "1024x1024" "medium"

generate "event-fall-festival.jpg" \
  "A lively outdoor fall festival in a park with hay bales, pumpkin decorations, a chili cook-off tent, and families enjoying activities. Autumn trees with orange and gold leaves. Kids painting pumpkins. Festive community atmosphere." \
  "1024x1024" "medium"

generate "event-school-supplies.jpg" \
  "Volunteers filling backpacks with school supplies at a back-to-school drive. Tables covered with notebooks, pencils, crayons, and folders. Children excitedly picking up their new backpacks. Community event in a large hall." \
  "1024x1024" "medium"

generate "event-garden.jpg" \
  "Community volunteers building raised garden beds and planting vegetables in a sunny community garden. People kneeling in soil, carrying seedlings, hammering wooden bed frames. Green plants, garden tools, and a sense of teamwork." \
  "1024x1024" "medium"

# Member avatars - diverse group of 25+ people
for i in $(seq 1 28); do
  case $((i % 7)) in
    0) desc="a young Black woman with natural hair, warm smile";;
    1) desc="a middle-aged white man with glasses, friendly expression";;
    2) desc="a Hispanic woman in her 30s, professional look";;
    3) desc="an older white woman with silver hair, kind eyes";;
    4) desc="a young Asian man, casual and approachable";;
    5) desc="a Black man in his 40s, confident smile";;
    6) desc="a young white woman with blonde hair, energetic";;
  esac
  generate "avatar-$(printf '%02d' $i).jpg" \
    "Professional headshot portrait of $desc. Clean background, natural lighting, shoulders and head visible. Suitable for a community organization member profile." \
    "1024x1024" "low" &

  # Run 4 at a time
  if [ $((i % 4)) -eq 0 ]; then
    wait
  fi
done
wait

echo ""
echo "=== Generation complete ==="
ls -la "$ASSETS_DIR/" | tail -n +2
echo "Total: $(ls "$ASSETS_DIR/" | wc -l | tr -d ' ') files"
