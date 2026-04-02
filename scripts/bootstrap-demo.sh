#!/bin/bash
# Bootstrap demo accounts for a Wild Lychee demo site
# Usage: bash scripts/bootstrap-demo.sh <project_id> <anon_key>
#
# Creates demo-admin and demo-member auth accounts, links them to member records,
# and stores their user_ids in site_config. Idempotent — safe to re-run.
set -e

PROJECT_ID="${1:?Usage: bootstrap-demo.sh <project_id> <anon_key>}"
ANON_KEY="${2:?Usage: bootstrap-demo.sh <project_id> <anon_key>}"
API="https://api.run402.com"

ADMIN_EMAIL="demo-admin@wildlychee.com"
MEMBER_EMAIL="demo-member@wildlychee.com"
DEMO_PASSWORD="demo123"

echo "=== Bootstrap Demo Accounts ==="
echo "Project: $PROJECT_ID"

# --- Helper: sign up or sign in ---
get_user_id() {
  local email="$1"
  local password="$2"

  # Try signup first
  local signup_res
  signup_res=$(curl -s -X POST "$API/auth/v1/signup" \
    -H "Content-Type: application/json" \
    -H "apikey: $ANON_KEY" \
    -d "{\"email\": \"$email\", \"password\": \"$password\"}")

  local user_id
  user_id=$(echo "$signup_res" | jq -r '.id // .user.id // empty' 2>/dev/null)

  if [ -n "$user_id" ] && [ "$user_id" != "null" ]; then
    echo "  Created: $email → $user_id"
    echo "$user_id"
    return
  fi

  # Signup failed (likely exists), try sign in
  local signin_res
  signin_res=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" \
    -H "Content-Type: application/json" \
    -H "apikey: $ANON_KEY" \
    -d "{\"email\": \"$email\", \"password\": \"$password\"}")

  user_id=$(echo "$signin_res" | jq -r '.user.id // empty' 2>/dev/null)

  if [ -n "$user_id" ] && [ "$user_id" != "null" ]; then
    echo "  Exists: $email → $user_id"
    echo "$user_id"
    return
  fi

  echo "  ERROR: Could not create or sign in $email" >&2
  echo "$signup_res" >&2
  echo "$signin_res" >&2
  return 1
}

# --- Helper: get auth token for API calls ---
get_token() {
  local email="$1"
  local password="$2"

  local res
  res=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" \
    -H "Content-Type: application/json" \
    -H "apikey: $ANON_KEY" \
    -d "{\"email\": \"$email\", \"password\": \"$password\"}")

  echo "$res" | jq -r '.access_token // empty' 2>/dev/null
}

# --- 1. Create/get demo accounts ---
echo ""
echo "Step 1: Creating demo accounts..."
ADMIN_USER_ID=$(get_user_id "$ADMIN_EMAIL" "$DEMO_PASSWORD" 2>&1 | tail -1)
MEMBER_USER_ID=$(get_user_id "$MEMBER_EMAIL" "$DEMO_PASSWORD" 2>&1 | tail -1)

if [ -z "$ADMIN_USER_ID" ] || [ -z "$MEMBER_USER_ID" ]; then
  echo "ERROR: Failed to get user IDs"
  exit 1
fi

echo "  Admin:  $ADMIN_USER_ID"
echo "  Member: $MEMBER_USER_ID"

# --- 2. Trigger on-signup for each account ---
echo ""
echo "Step 2: Triggering on-signup..."

ADMIN_TOKEN=$(get_token "$ADMIN_EMAIL" "$DEMO_PASSWORD")
if [ -n "$ADMIN_TOKEN" ]; then
  curl -s -X POST "$API/functions/v1/on-signup" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$ADMIN_EMAIL\"}" > /dev/null
  echo "  on-signup called for admin"
fi

MEMBER_TOKEN=$(get_token "$MEMBER_EMAIL" "$DEMO_PASSWORD")
if [ -n "$MEMBER_TOKEN" ]; then
  curl -s -X POST "$API/functions/v1/on-signup" \
    -H "Authorization: Bearer $MEMBER_TOKEN" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$MEMBER_EMAIL\"}" > /dev/null
  echo "  on-signup called for member"
fi

# --- 3. Promote admin, activate member ---
echo ""
echo "Step 3: Setting roles..."

# Get service_key for direct DB updates
SERVICE_KEY=$(run402 projects keys "$PROJECT_ID" | jq -r '.service_key')

# Update admin role and status
curl -s -X PATCH "$API/rest/v1/members?user_id=eq.$ADMIN_USER_ID" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"role": "admin", "status": "active"}' > /dev/null
echo "  Admin: role=admin, status=active"

# Update member status
curl -s -X PATCH "$API/rest/v1/members?user_id=eq.$MEMBER_USER_ID" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status": "active"}' > /dev/null
echo "  Member: status=active"

# --- 4. Store demo_accounts in site_config ---
echo ""
echo "Step 4: Storing demo_accounts in site_config..."

DEMO_ACCOUNTS_JSON="{\"admin_user_id\": \"$ADMIN_USER_ID\", \"member_user_id\": \"$MEMBER_USER_ID\"}"

curl -s -X POST "$API/rest/v1/site_config" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  -d "{\"key\": \"demo_accounts\", \"value\": $DEMO_ACCOUNTS_JSON, \"category\": \"demo\"}" > /dev/null
echo "  Stored demo_accounts config"

echo ""
echo "=== Done! ==="
echo "Admin:  $ADMIN_EMAIL / $DEMO_PASSWORD (user_id: $ADMIN_USER_ID)"
echo "Member: $MEMBER_EMAIL / $DEMO_PASSWORD (user_id: $MEMBER_USER_ID)"
