#!/bin/bash
# Generate AI images for the Barrio Unido demo site
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
  "A warm, vibrant logo for 'Barrio Unido' community center. A stylized pair of open hands cradling a small house and sun rays, rendered in terracotta (#C2553A) and teal (#1A8A7D). Latin American folk art inspired, clean modern design. White background. No text in the image." \
  "1024x1024" "high"

# Hero image
generate "hero.jpg" \
  "A colorful community mural on the side of a building in East Los Angeles depicting immigration, family, and community strength. Bright colors - terracotta, teal, marigold, warm tones. Mexican and Central American cultural motifs. People gathered in front of the mural at a community event. Golden hour light. Professional photography." \
  "1536x1024" "high"

# Event photos
generate "event-citizenship.jpg" \
  "A warm, welcoming citizenship preparation workshop in a community center. Diverse Latino adults studying with workbooks and flashcards at round tables. A teacher helping a student at a whiteboard with US civics content. Warm terracotta and cream decor." \
  "1024x1024" "medium"

generate "event-health-fair.jpg" \
  "A lively community health fair in a sunny park in East Los Angeles. Volunteer nurses in scrubs checking blood pressure at a booth. Families with children visiting different health stations. Colorful banners and tents. Warm, inviting atmosphere." \
  "1024x1024" "medium"

generate "event-market.jpg" \
  "A vibrant outdoor community market (mercadito) in East LA. Vendor stalls with handmade crafts, food, plants, and clothing. A Latina woman selling colorful embroidered items. Kids playing, live music, string lights. Warm golden light, festive atmosphere." \
  "1024x1024" "medium"

generate "event-legal-clinic.jpg" \
  "A welcoming legal aid clinic at a community center. A female attorney consulting with a Latino family at a desk with papers and folders. Professional but warm atmosphere. Community center setting with bulletin boards and posters in Spanish." \
  "1024x1024" "medium"

generate "event-workshop.jpg" \
  "A tax preparation workshop at a community center. Volunteers at computers helping Latino families with tax forms. Professional and organized. Bilingual signs in Spanish and English. Warm, helpful atmosphere." \
  "1024x1024" "medium"

generate "event-posada.jpg" \
  "A traditional Mexican posada celebration at a community center in East LA. Colorful papel picado decorations, children gathered around a piñata, families eating tamales and drinking champurrado. Warm string lights, festive and joyful." \
  "1024x1024" "medium"

generate "event-dia-muertos.jpg" \
  "A beautiful Día de los Muertos ofrenda (altar) at a community park. Marigold flowers, candles, photos, sugar skulls, papel picado. People with face paint standing nearby. Twilight setting, warm candlelight, reverent and beautiful." \
  "1024x1024" "medium"

generate "event-mural.jpg" \
  "Community volunteers painting a large colorful mural on the side of a building. Scaffolding, paint buckets, people of all ages working together. The mural shows faces, hands, and cultural symbols. Sunny day in East LA." \
  "1024x1024" "medium"

generate "event-graduation.jpg" \
  "An ESL graduation ceremony at a community center. Latino adults in simple caps and gowns receiving certificates on a small stage. Families applauding. Balloons and a banner reading 'Felicidades'. Emotional and proud moment." \
  "1024x1024" "medium"

generate "event-food-pantry.jpg" \
  "Volunteers at a community food pantry organizing boxes of fresh produce, rice, and beans. Diverse group of Latino women and men working together. Stacked boxes, organized shelves. Warm, productive atmosphere in a community center." \
  "1024x1024" "medium"

# Member avatars - diverse Latino community with allies
for i in $(seq 1 22); do
  case $i in
    1)  desc="a Latina woman in her 40s with warm brown eyes, confident and compassionate expression, community leader";;
    2)  desc="a Latina professional woman in her 30s, dark hair, poised and intelligent, attorney look";;
    3)  desc="a Latino man in his 60s with silver hair and glasses, kind teacher expression, grandfatherly";;
    4)  desc="a young Latina mother in her late 20s, warm smile, hardworking and caring";;
    5)  desc="a Latino man in his 40s, baker or chef look, flour-dusted apron, warm smile";;
    6)  desc="an Asian-American woman in her 30s, professional social worker look, friendly";;
    7)  desc="a Latino man in his 30s, working class, strong hands, honest expression";;
    8)  desc="a Latina nurse in her 40s, caring expression, professional and warm";;
    9)  desc="a Korean-American man in his 20s, law student look, studious and kind";;
    10) desc="a Latina grandmother in her 60s, silver hair in a bun, warm loving smile, apron";;
    11) desc="a Latino man in his 30s, artistic look, paint on hands, creative expression";;
    12) desc="a Latina professional woman in her 40s, accountant or businesswoman, confident";;
    13) desc="a Latino man in his 30s, taxi driver, friendly and resilient expression";;
    14) desc="a young Latina college student in her early 20s, studious and determined";;
    15) desc="a Latino man in his 50s, plumber or handyman, strong and dependable look";;
    16) desc="a Latina journalist in her 30s, curious and engaged expression";;
    17) desc="a Latino chef in his 30s, food truck owner, charismatic smile";;
    18) desc="an Asian-American woman teacher in her 40s, warm and encouraging";;
    19) desc="a Latino man in his 30s, tech worker, glasses, helpful expression";;
    20) desc="a Latina seamstress in her 40s, creative and proud expression";;
    21) desc="a young Latino man in his 20s, recently arrived, hopeful expression";;
    22) desc="a young Latina mother in her 20s, determined and hopeful";;
  esac
  generate "avatar-$(printf '%02d' $i).jpg" \
    "Professional headshot portrait of $desc. Clean warm-toned background, natural lighting, shoulders and head visible. Warm and approachable for a community center member profile." \
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
