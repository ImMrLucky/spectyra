#!/usr/bin/env bash
# Spectyra skill post-install — full interactive setup, no browser required.
# Runs after `openclaw skills install spectyra` merges config-fragment.json.
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

SPECTYRA_API="https://spectyra.up.railway.app/v1"
SUPABASE_URL="https://jajqvceuenqeblbgsigt.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphanF2Y2V1ZW5xZWJsYmdzaWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDI4MDgsImV4cCI6MjA4NDk3ODgwOH0.IJ7CSyX-_-lahfaOzM9U5EIpR6tcW-GhiMZeCY_efno"
COMPANION_URL="http://127.0.0.1:4111"
CONFIG_DIR="$HOME/.spectyra/desktop"
COMPANION_DIR="$HOME/.spectyra/companion"
COMPANION_BIN_DIR="$HOME/.spectyra/bin"

ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
info() { echo -e "  ${CYAN}→${RESET} $*"; }
warn() { echo -e "  ${YELLOW}!${RESET} $*"; }
err()  { echo -e "  ${RED}✗${RESET} $*"; }

echo ""
echo -e "${GREEN}✓ Spectyra skill installed${RESET}"
echo -e "  ${DIM}Models: spectyra/smart, spectyra/fast, spectyra/quality${RESET}"
echo ""

# ── Check if already fully set up ──
if curl -sf "$COMPANION_URL/health" >/dev/null 2>&1; then
  ok "Local Companion is already running at $COMPANION_URL"
  echo ""
  echo -e "  ${GREEN}${BOLD}You're all set!${RESET} Run ${CYAN}openclaw chat${RESET} — optimization is automatic."
  echo ""
  exit 0
fi

# ═══════════════════════════════════════════════════════════
echo -e "${BOLD}Let's finish setting up Spectyra.${RESET}"
echo -e "${DIM}  Everything happens here in the terminal — no browser needed.${RESET}"
echo ""

# ── 1. Spectyra account ──
echo -e "${BOLD}1. Spectyra account${RESET}"
echo ""

SPECTYRA_TOKEN=""
SIGNED_IN=false

# Check for existing session
if [ -f "$CONFIG_DIR/config.json" ]; then
  EXISTING_KEY=$(cat "$CONFIG_DIR/config.json" 2>/dev/null | grep -o '"apiKey"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"apiKey"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
  if [ -n "$EXISTING_KEY" ] && [ "$EXISTING_KEY" != "null" ] && [ "$EXISTING_KEY" != "" ]; then
    ok "Existing Spectyra session found"
    SIGNED_IN=true
  fi
fi

if [ "$SIGNED_IN" = false ]; then
  echo -e "  ${DIM}A free account connects your optimization data to the Spectyra dashboard.${RESET}"
  echo ""
  read -rp "  Do you have a Spectyra account? [y/N] " has_account

  if [[ "$has_account" =~ ^[yY] ]]; then
    # ── Sign in ──
    echo ""
    read -rp "  Email: " auth_email
    read -rsp "  Password: " auth_password
    echo ""

    info "Signing in..."
    LOGIN_RESP=$(curl -sf -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"$auth_email\", \"password\": \"$auth_password\"}" 2>/dev/null || echo '{"error":"request_failed"}')

    SPECTYRA_TOKEN=$(echo "$LOGIN_RESP" | grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"access_token"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)

    if [ -n "$SPECTYRA_TOKEN" ]; then
      ok "Signed in as $auth_email"
      SIGNED_IN=true

      LICENSE_KEY=""

      # Try bootstrap first (works for brand-new users)
      BOOTSTRAP_RESP=$(curl -sf -X POST "$SPECTYRA_API/auth/bootstrap" \
        -H "Authorization: Bearer $SPECTYRA_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{}" 2>/dev/null || echo '{}')
      API_KEY=$(echo "$BOOTSTRAP_RESP" | grep -o '"api_key"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"api_key"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
      LICENSE_KEY=$(echo "$BOOTSTRAP_RESP" | grep -o '"license_key"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"license_key"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
      if [ -n "$API_KEY" ]; then
        mkdir -p "$CONFIG_DIR"
        if [ -f "$CONFIG_DIR/config.json" ]; then
          TMP=$(mktemp)
          cat "$CONFIG_DIR/config.json" | sed "s/\"apiKey\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"apiKey\": \"$API_KEY\"/" > "$TMP" && mv "$TMP" "$CONFIG_DIR/config.json"
        fi
      fi

      # Existing user: bootstrap returns 400 — generate a license key directly
      if [ -z "$LICENSE_KEY" ]; then
        LK_RESP=$(curl -sf -X POST "$SPECTYRA_API/license/generate" \
          -H "Authorization: Bearer $SPECTYRA_TOKEN" \
          -H "Content-Type: application/json" \
          -d '{"device_name":"openclaw-skill-setup"}' 2>/dev/null || echo '{}')
        LICENSE_KEY=$(echo "$LK_RESP" | grep -o '"license_key"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"license_key"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
      fi

      if [ -n "$LICENSE_KEY" ]; then
        ok "License key provisioned"
      fi
    else
      ERR_MSG=$(echo "$LOGIN_RESP" | grep -o '"error_description"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"error_description"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || echo "Sign-in failed")
      err "$ERR_MSG"
      echo -e "  ${DIM}You can sign in later in the Spectyra Desktop app or at spectyra.com${RESET}"
    fi
  else
    # ── Sign up ──
    echo ""
    read -rp "  Email: " auth_email
    read -rsp "  Password (min 8 chars): " auth_password
    echo ""
    read -rp "  Organization name: " auth_org

    info "Creating account..."
    SIGNUP_RESP=$(curl -sf -X POST "$SUPABASE_URL/auth/v1/signup" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"$auth_email\", \"password\": \"$auth_password\"}" 2>/dev/null || echo '{"error":"request_failed"}')

    SPECTYRA_TOKEN=$(echo "$SIGNUP_RESP" | grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"access_token"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)

    # Handle email confirmation if needed
    if [ -z "$SPECTYRA_TOKEN" ]; then
      USER_ID=$(echo "$SIGNUP_RESP" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
      if [ -n "$USER_ID" ]; then
        # Auto-confirm
        curl -sf -X POST "$SPECTYRA_API/auth/auto-confirm" \
          -H "Content-Type: application/json" \
          -d "{\"email\": \"$auth_email\"}" >/dev/null 2>&1 || true
        sleep 1
        # Sign in after confirm
        LOGIN_RESP=$(curl -sf -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
          -H "apikey: $SUPABASE_ANON_KEY" \
          -H "Content-Type: application/json" \
          -d "{\"email\": \"$auth_email\", \"password\": \"$auth_password\"}" 2>/dev/null || echo '{}')
        SPECTYRA_TOKEN=$(echo "$LOGIN_RESP" | grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"access_token"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
      fi
    fi

    if [ -n "$SPECTYRA_TOKEN" ]; then
      ok "Account created for $auth_email"
      SIGNED_IN=true

      # Bootstrap org + get API key + license key
      BOOTSTRAP_RESP=$(curl -sf -X POST "$SPECTYRA_API/auth/bootstrap" \
        -H "Authorization: Bearer $SPECTYRA_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"org_name\": \"$auth_org\"}" 2>/dev/null || echo '{}')
      API_KEY=$(echo "$BOOTSTRAP_RESP" | grep -o '"api_key"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"api_key"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
      LICENSE_KEY=$(echo "$BOOTSTRAP_RESP" | grep -o '"license_key"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"license_key"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
    else
      err "Could not create account. You can sign up later at spectyra.com"
    fi
  fi
fi
echo ""

# ── 2. AI Provider key ──
echo -e "${BOLD}2. AI provider key${RESET}"
echo ""

PROVIDER_SET=false

# Check if provider key already exists
if [ -f "$CONFIG_DIR/provider-keys.json" ]; then
  EXISTING_KEYS=$(cat "$CONFIG_DIR/provider-keys.json" 2>/dev/null || echo '{}')
  if echo "$EXISTING_KEYS" | grep -qE '"(openai|anthropic|groq)"[[:space:]]*:[[:space:]]*"[^"]+' 2>/dev/null; then
    ok "Provider key already configured"
    PROVIDER_SET=true
  fi
fi

if [ "$PROVIDER_SET" = false ]; then
  echo -e "  ${DIM}Your API key stays on this machine — never sent to Spectyra.${RESET}"
  echo ""
  echo "  Which provider?"
  echo "    1) OpenAI"
  echo "    2) Anthropic"
  echo "    3) Groq"
  echo ""
  read -rp "  Choice [1/2/3]: " provider_choice

  case "$provider_choice" in
    1) PROVIDER="openai" ;;
    2) PROVIDER="anthropic" ;;
    3) PROVIDER="groq" ;;
    *) PROVIDER="openai" ;;
  esac

  echo ""
  read -rsp "  Paste your $PROVIDER API key: " provider_key
  echo ""

  if [ -n "$provider_key" ]; then
    mkdir -p "$CONFIG_DIR"

    # Write provider-keys.json
    cat > "$CONFIG_DIR/provider-keys.json" <<KEYJSON
{"$PROVIDER": "$provider_key"}
KEYJSON

    # Write or update config.json
    LK_VALUE="null"
    if [ -n "${LICENSE_KEY:-}" ]; then
      LK_VALUE="\"$LICENSE_KEY\""
    fi
    if [ ! -f "$CONFIG_DIR/config.json" ]; then
      cat > "$CONFIG_DIR/config.json" <<CONFJSON
{
  "runMode": "on",
  "telemetryMode": "local",
  "promptSnapshots": "local_only",
  "provider": "$PROVIDER",
  "aliasSmartModel": "gpt-4o-mini",
  "aliasFastModel": "gpt-4o-mini",
  "aliasQualityModel": "gpt-4o",
  "port": 4111,
  "licenseKey": $LK_VALUE,
  "providerKeys": {"$PROVIDER": "$provider_key"}
}
CONFJSON
    else
      # Update existing config with license key if we got one
      if [ -n "${LICENSE_KEY:-}" ]; then
        TMP=$(mktemp)
        sed "s/\"licenseKey\"[[:space:]]*:[[:space:]]*null/\"licenseKey\": \"$LICENSE_KEY\"/" "$CONFIG_DIR/config.json" > "$TMP" && mv "$TMP" "$CONFIG_DIR/config.json"
      fi
    fi

    ok "Key saved for $PROVIDER"
    PROVIDER_SET=true
  else
    warn "No key provided. Add one later in the Spectyra Desktop app."
  fi
fi
echo ""

# ── 3. Start Local Companion ──
echo -e "${BOLD}3. Local Companion${RESET}"
echo ""

COMPANION_RUNNING=false

# Check if already running
if curl -sf "$COMPANION_URL/health" >/dev/null 2>&1; then
  ok "Already running"
  COMPANION_RUNNING=true
fi

if [ "$COMPANION_RUNNING" = false ] && [ "$PROVIDER_SET" = true ]; then
  info "Setting up the Local Companion..."

  # Check if companion is already installed
  COMPANION_SCRIPT=""

  # Check global npm install
  if command -v spectyra-companion >/dev/null 2>&1; then
    COMPANION_SCRIPT="spectyra-companion"
  fi

  # Check local install
  if [ -z "$COMPANION_SCRIPT" ] && [ -f "$COMPANION_BIN_DIR/companion.cjs" ]; then
    COMPANION_SCRIPT="node $COMPANION_BIN_DIR/companion.cjs"
  fi

  if [ -z "$COMPANION_SCRIPT" ]; then
    info "Installing companion (lightweight Node.js process)..."
    mkdir -p "$COMPANION_BIN_DIR"

    # Try npm global install first
    if npm install -g @spectyra/local-companion 2>/dev/null; then
      COMPANION_SCRIPT="spectyra-companion"
      ok "Companion installed globally"
    else
      warn "Global npm install not available."
      echo ""
      echo -e "  ${DIM}The Local Companion is included in the Spectyra Desktop app.${RESET}"
      echo -e "  ${DIM}Download it at: ${CYAN}https://spectyra.com/download${RESET}"
    fi
  fi

  if [ -n "$COMPANION_SCRIPT" ]; then
    info "Starting companion on port 4111..."

    # Determine provider key env var
    PROVIDER_FROM_CONFIG="openai"
    if [ -f "$CONFIG_DIR/config.json" ]; then
      PROVIDER_FROM_CONFIG=$(cat "$CONFIG_DIR/config.json" | grep -o '"provider"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"provider"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || echo "openai")
    fi

    export SPECTYRA_PORT=4111
    export SPECTYRA_BIND_HOST="127.0.0.1"
    export SPECTYRA_PROVIDER="$PROVIDER_FROM_CONFIG"
    export SPECTYRA_PROVIDER_KEYS_FILE="$CONFIG_DIR/provider-keys.json"
    export SPECTYRA_RUN_MODE="on"
    export SPECTYRA_TELEMETRY="local"

    # Start in background
    nohup $COMPANION_SCRIPT > "$COMPANION_DIR/companion.log" 2>&1 &
    COMPANION_PID=$!
    echo "$COMPANION_PID" > "$COMPANION_DIR/companion.pid"

    # Wait a moment for startup
    sleep 2

    if curl -sf "$COMPANION_URL/health" >/dev/null 2>&1; then
      ok "Companion running (PID $COMPANION_PID)"
      COMPANION_RUNNING=true

      # Set up auto-start on macOS
      if [ "$(uname)" = "Darwin" ]; then
        PLIST_DIR="$HOME/Library/LaunchAgents"
        PLIST_FILE="$PLIST_DIR/com.spectyra.companion.plist"
        if [ ! -f "$PLIST_FILE" ]; then
          mkdir -p "$PLIST_DIR"
          COMPANION_ABS=$(command -v spectyra-companion 2>/dev/null || echo "$COMPANION_BIN_DIR/companion.cjs")
          cat > "$PLIST_FILE" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.spectyra.companion</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(command -v node)</string>
    <string>$COMPANION_ABS</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SPECTYRA_PORT</key><string>4111</string>
    <key>SPECTYRA_BIND_HOST</key><string>127.0.0.1</string>
    <key>SPECTYRA_PROVIDER</key><string>$PROVIDER_FROM_CONFIG</string>
    <key>SPECTYRA_PROVIDER_KEYS_FILE</key><string>$CONFIG_DIR/provider-keys.json</string>
    <key>SPECTYRA_RUN_MODE</key><string>on</string>
    <key>SPECTYRA_TELEMETRY</key><string>local</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$COMPANION_DIR/companion.log</string>
  <key>StandardErrorPath</key><string>$COMPANION_DIR/companion.log</string>
</dict>
</plist>
PLIST
          launchctl load "$PLIST_FILE" 2>/dev/null || true
          ok "Auto-start configured (runs on login)"
        fi
      fi
    else
      warn "Companion started but health check failed. Check $COMPANION_DIR/companion.log"
    fi
  fi
fi

if [ "$COMPANION_RUNNING" = false ] && [ "$PROVIDER_SET" = false ]; then
  warn "Skipped — add a provider key first (step 2 above)."
fi
echo ""

# ═══════════════════════════════════════════════════════════
echo -e "${BOLD}────────────────────────────────${RESET}"
echo ""

if [ "$COMPANION_RUNNING" = true ]; then
  echo -e "  ${GREEN}${BOLD}You're all set!${RESET}"
  echo ""
  echo -e "  Run ${CYAN}openclaw chat${RESET} to start — optimization is automatic."
  echo -e "  Savings appear at ${CYAN}https://spectyra.com/dashboard${RESET}"
else
  echo -e "  ${BOLD}Almost there!${RESET}"
  echo ""
  if [ "$PROVIDER_SET" = false ]; then
    echo "  Remaining: add an AI provider key"
  fi
  echo "  Remaining: start the Local Companion"
  echo ""
  echo -e "  Option A: Download the ${BOLD}Spectyra Desktop app${RESET} (includes everything):"
  echo -e "            ${CYAN}https://spectyra.com/download${RESET}"
  echo ""
  echo -e "  Option B: Re-run this setup after adding a provider key:"
  echo -e "            ${CYAN}openclaw skills install spectyra${RESET}"
fi
echo ""
