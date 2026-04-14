#!/bin/bash
# Generate AI images for Silver Pines Senior Center demo site
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

# ============================================
# Logo
# ============================================
generate "logo.png" \
  "A warm, inviting logo for 'Silver Pines Senior Center'. A stylized pine tree with gentle curves in sage green (#5B7F5E) with warm amber (#C4913E) accent. Clean, friendly design suitable for a senior community center. Simple and legible. White/transparent background. No text in the image." \
  "1024x1024" "high"

# ============================================
# Hero image
# ============================================
generate "hero.jpg" \
  "A warm, welcoming community center building with a covered porch and accessible ramp, surrounded by mature pine trees, with the Blue Ridge Mountains visible in the background. Soft golden afternoon light, early autumn. The building has a sage green door and warm cream exterior. Flower boxes on windows. A few seniors chatting on the porch. Inviting, friendly, professional photography style." \
  "1536x1024" "high"

# ============================================
# Activity photos
# ============================================
generate "event-tai-chi.jpg" \
  "A group of 6-8 seniors doing tai chi in a bright, airy community center hall. Diverse group, ages 65-80, wearing comfortable clothes. Natural light from large windows. Instructor at front demonstrating a pose. Calm, peaceful atmosphere. Warm, natural photography." \
  "1024x1024" "medium"

generate "event-watercolor.jpg" \
  "Seniors painting watercolors at a community art class. 4-5 people at a long table with watercolor supplies, brushes in water jars, colorful paintings in progress. A retired art teacher showing a technique. Bright art room with natural light. Warm, joyful atmosphere." \
  "1024x1024" "medium"

generate "event-garden.jpg" \
  "Seniors working together in a community garden with raised beds. 3-4 people tending vegetables and flowers, wearing sun hats and gardening gloves. Blue Ridge Mountains in the background. Sunny day, vibrant green plants, ripe tomatoes. Warm, earthy, inviting." \
  "1024x1024" "medium"

generate "event-book-club.jpg" \
  "A cozy book club meeting in a community center reading room. 5-6 seniors sitting in comfortable chairs in a circle, each holding a book. Bookshelves in background, warm lamp light, coffee cups on side tables. Engaged conversation, warm smiles." \
  "1024x1024" "medium"

generate "event-tech-help.jpg" \
  "A patient senior volunteer helping another senior with a tablet at a computer desk in a community center. One person pointing at the screen, the other learning. Simple, bright room with a few other people working at computers in the background. Warm, encouraging atmosphere." \
  "1024x1024" "medium"

generate "event-potluck.jpg" \
  "A community potluck dinner at a senior center. Long tables with homemade dishes, seniors serving each other, plates of colorful food. Warm overhead lighting, festive but casual atmosphere. Diverse group of people laughing and eating together. Heartwarming." \
  "1024x1024" "medium"

generate "event-nature-walk.jpg" \
  "A small group of 4-5 seniors walking a gentle trail through autumn forest in the Blue Ridge Mountains. Fall foliage in oranges and golds, dappled sunlight. Group is chatting and smiling, one person pointing at something in the trees. Comfortable walking shoes, light jackets." \
  "1024x1024" "medium"

generate "event-movie-night.jpg" \
  "Seniors sitting in comfortable chairs watching a movie projected on a screen in a community center hall. Popcorn buckets, cozy blankets, dim lighting. About 15 people of diverse backgrounds enjoying the film. Warm, social, relaxed evening atmosphere." \
  "1024x1024" "medium"

# ============================================
# Member portraits (22 members)
# ============================================
generate "avatar-01.jpg" \
  "Portrait of a warm, confident African American woman in her early 70s with silver-grey hair in a neat bob. Kind eyes, gentle smile. Wearing a sage green cardigan. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-02.jpg" \
  "Portrait of a distinguished white man in his mid 70s with silver hair and reading glasses. Friendly expression, wearing a navy blazer. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-03.jpg" \
  "Portrait of a warm Latina woman in her mid 60s with dark hair streaked with silver, pulled back. Bright smile, wearing a colorful scarf over a white blouse. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-04.jpg" \
  "Portrait of an East Asian man in his late 60s with short grey hair and a calm, thoughtful expression. Wearing a collared shirt. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-05.jpg" \
  "Portrait of a white woman in her early 70s with curly grey hair and a sun hat, looking cheerful. Tanned, outdoorsy. Wearing a floral print top. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-06.jpg" \
  "Portrait of a jovial Irish American man in his early 70s with a ruddy complexion, thinning white hair, and a wide genuine smile. Wearing a plaid flannel shirt. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-07.jpg" \
  "Portrait of an elegant white woman in her late 60s with shoulder-length silver hair and artistic earrings. Creative, warm expression. Wearing a paint-smudged apron over a blouse. Soft natural lighting, cream background." \
  "1024x1024" "medium"

generate "avatar-08.jpg" \
  "Portrait of a dignified white man in his mid 80s, clean-shaven, with white hair and sharp blue eyes. Wearing a veteran's cap. Kind smile. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-09.jpg" \
  "Portrait of a cheerful white woman in her late 60s with reddish-grey hair and round glasses. Warm, welcoming smile. Wearing a knit sweater. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-10.jpg" \
  "Portrait of a serene Japanese American man in his early 70s with salt-and-pepper hair, calm expression. Wearing a simple grey t-shirt. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-11.jpg" \
  "Portrait of a spirited African American woman in her early 70s with short silver hair and pearl earrings. Bright, musical smile. Wearing a burgundy blouse. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-12.jpg" \
  "Portrait of a sturdy white man in his early 70s with a grey beard and calloused hands. Friendly, practical expression. Wearing a denim work shirt. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-13.jpg" \
  "Portrait of a graceful Korean American woman in her mid 60s with dark hair going grey, warm smile. Wearing a light blue cardigan. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-14.jpg" \
  "Portrait of a strong African American man in his early 70s with a grey mustache and warm brown eyes. Wearing a fire department retirement t-shirt. Confident, kind expression. Soft natural lighting, cream background." \
  "1024x1024" "medium"

generate "avatar-15.jpg" \
  "Portrait of a thoughtful white woman in her early 70s with wire-rimmed glasses and straight grey hair. Bookish, intelligent expression. Wearing a turtleneck. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-16.jpg" \
  "Portrait of a white man in his late 70s with thick silver hair and a tweed jacket. Intellectual but approachable. Wearing small round glasses. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-17.jpg" \
  "Portrait of a gentle African American woman in her early 70s with grey hair pinned up, wearing a simple cross necklace. Musical, kind expression. Wearing a cream blouse. Soft natural lighting, cream background." \
  "1024x1024" "medium"

generate "avatar-18.jpg" \
  "Portrait of a smiling African American man in his late 60s with a short grey beard and a USPS retirement cap. Friendly, outgoing expression. Wearing a polo shirt. Soft natural lighting, cream background." \
  "1024x1024" "medium"

generate "avatar-19.jpg" \
  "Portrait of a warm Italian American woman in her late 60s with salt-and-pepper hair and a flour-dusted apron. Animated, joyful expression. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-20.jpg" \
  "Portrait of a relaxed white man in his mid 60s with grey hair and a casual polo. Recently retired look — slightly tanned, calm smile. Soft natural lighting, cream background. Professional headshot style." \
  "1024x1024" "medium"

generate "avatar-21.jpg" \
  "Portrait of a Vietnamese American woman in her early 60s with black hair with some grey, warm brown eyes. Wearing a jade pendant. Gentle, curious expression. Soft natural lighting, cream background." \
  "1024x1024" "medium"

generate "avatar-22.jpg" \
  "Portrait of an African American man in his late 60s, recently moved, with a friendly open expression and short grey hair. Wearing a Atlanta Braves t-shirt. Soft natural lighting, cream background." \
  "1024x1024" "medium"

echo ""
echo "Done! Generated images in $ASSETS_DIR"
echo "Total files: $(ls -1 "$ASSETS_DIR" | wc -l | tr -d ' ')"
