#!/usr/bin/env zsh
# ============================================
# Capture showcase screenshots for marketing site
# Uses Chrome headless mode (no dependencies needed)
#
# Usage:
#   ./marketing/capture-screenshots.sh          # all sites
#   ./marketing/capture-screenshots.sh eagles   # just eagles
# ============================================

set -e

SCRIPT_DIR="${0:a:h}"
ASSETS_DIR="$SCRIPT_DIR/assets"
mkdir -p "$ASSETS_DIR"

# Find Chrome
if [[ -d "/Applications/Google Chrome.app" ]]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif (( $+commands[google-chrome] )); then
  CHROME="google-chrome"
elif (( $+commands[chromium] )); then
  CHROME="chromium"
else
  echo "Chrome not found. Install Google Chrome."
  exit 1
fi

WIDTH=1280
HEIGHT=800

capture() {
  local name="$1"
  local url="$2"
  local output="$ASSETS_DIR/screenshot-${name}.png"

  echo "Capturing $name ($url)..."
  # Use a small HTML page that navigates to the URL, waits for JS to render, then screenshots
  local tmphtml=$(mktemp /tmp/capture-XXXXXX.html)
  cat > "$tmphtml" <<HTMLEOF
<!DOCTYPE html>
<html><body><script>
  // Navigate and wait for content to load
  window.location = '$url';
</script></body></html>
HTMLEOF

  # Use virtual-time-budget to let JS execute (5 seconds of simulated time)
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --no-sandbox \
    --hide-scrollbars \
    --window-size="${WIDTH},${HEIGHT}" \
    --virtual-time-budget=8000 \
    --screenshot="$output" \
    "$url" \
    2>/dev/null

  rm -f "$tmphtml"

  if [[ -f "$output" ]]; then
    local size=$(du -h "$output" | cut -f1)
    echo "  Saved: $output ($size)"
  else
    echo "  FAILED: $output not created"
  fi
}

# Showcase sites — add more as they're created
typeset -A SITES
SITES=(
  eagles          "https://eagles.kychon.com"
  eagles-directory "https://eagles.kychon.com/directory.html"
  eagles-events   "https://eagles.kychon.com/events.html"
  eagles-forum    "https://eagles.kychon.com/forum.html"
)

if [[ -n "$1" ]]; then
  if [[ -n "${SITES[$1]}" ]]; then
    capture "$1" "${SITES[$1]}"
  else
    echo "Unknown site: $1"
    echo "Available: ${(k)SITES}"
    exit 1
  fi
else
  for name url in "${(@kv)SITES}"; do
    capture "$name" "$url"
  done
fi

echo "Done."
