#!/usr/bin/env bash
# Spectyra + OpenClaw — complete setup in one command
# Usage: curl -fsSL https://spectyra.com/install.sh | bash
#
# Installs OpenClaw (if needed), adds the Spectyra skill, creates your account,
# saves your provider key, and starts the Local Companion. No browser required.
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
OPENCLAW_INSTALL_URL="https://openclaw.ai/install.sh"
COMPANION_URL="http://127.0.0.1:4111"
CONFIG_DIR="$HOME/.spectyra/desktop"
COMPANION_DIR="$HOME/.spectyra/companion"
MIN_NODE_MAJOR=22

ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
info() { echo -e "  ${CYAN}→${RESET} $*"; }
warn() { echo -e "  ${YELLOW}!${RESET} $*"; }
err()  { echo -e "  ${RED}✗${RESET} $*"; }
step() { echo ""; echo -e "${BOLD}$1${RESET}"; echo ""; }

echo ""
echo -e "${BOLD}┌──────────────────────────────────────┐${RESET}"
echo -e "${BOLD}│  Spectyra + OpenClaw Setup            │${RESET}"
echo -e "${BOLD}│  ${DIM}Everything happens here, no browser.${RESET}${BOLD}  │${RESET}"
echo -e "${BOLD}└──────────────────────────────────────┘${RESET}"

# ═══════════════════════════════════════════════════
step "Step 1 of 5 — Prerequisites"
# ═══════════════════════════════════════════════════

if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node -v | sed 's/^v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge "$MIN_NODE_MAJOR" ]; then
    ok "Node.js v${NODE_VERSION}"
  else
    warn "Node.js v${NODE_VERSION} (v${MIN_NODE_MAJOR}+ recommended)"
  fi
else
  err "Node.js not found. Install v${MIN_NODE_MAJOR}+ from https://nodejs.org then re-run."
  exit 1
fi

# ═══════════════════════════════════════════════════
step "Step 2 of 5 — OpenClaw"
# ═══════════════════════════════════════════════════

OPENCLAW_INSTALLED=false

if command -v openclaw >/dev/null 2>&1; then
  OC_VERSION=$(openclaw --version 2>/dev/null || echo "installed")
  ok "OpenClaw ${OC_VERSION}"
  OPENCLAW_INSTALLED=true
else
  info "Installing OpenClaw..."
  if curl -fsSL "$OPENCLAW_INSTALL_URL" | bash; then
    for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
      [ -f "$rc" ] && source "$rc" 2>/dev/null || true
    done
    for p in "$HOME/.local/bin" "/opt/homebrew/bin" "/usr/local/bin"; do
      [ -d "$p" ] && export PATH="$p:$PATH"
    done

    if command -v openclaw >/dev/null 2>&1; then
      ok "OpenClaw installed"
      OPENCLAW_INSTALLED=true
    else
      warn "Installed but not in PATH. Restart your terminal then re-run."
    fi
  else
    err "OpenClaw install failed. Visit https://openclaw.ai"
    exit 1
  fi
fi

# ═══════════════════════════════════════════════════
step "Step 3 of 5 — Spectyra account"
# ═══════════════════════════════════════════════════

echo -e "  ${DIM}Free account — connects your cost savings to the Spectyra dashboard.${RESET}"
echo ""

SIGNED_IN=false

# Check existing session
if [ -f "$CONFIG_DIR/config.json" ]; then
  EXISTING_KEY=$(cat "$CONFIG_DIR/config.json" 2>/dev/null | grep -o '"apiKey"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"apiKey"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
  if [ -n "$EXISTING_KEY" ] && [ "$EXISTING_KEY" != "null" ]; then
    ok "Existing Spectyra session found"
    SIGNED_IN=true
  fi
fi

if [ "$SIGNED_IN" = false ]; then
  read -rp "  Have a Spectyra account? [y/N] " has_account

  if [[ "$has_account" =~ ^[yY] ]]; then
    echo ""
    read -rp "  Email: " auth_email
    read -rsp "  Password: " auth_password
    echo ""

    info "Signing in..."
    LOGIN_RESP=$(curl -sf -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"$auth_email\", \"password\": \"$auth_password\"}" 2>/dev/null || echo '{"error":"failed"}')

    TOKEN=$(echo "$LOGIN_RESP" | grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"access_token"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)

    if [ -n "$TOKEN" ]; then
      ok "Signed in as $auth_email"
      SIGNED_IN=true
      curl -sf -X POST "$SPECTYRA_API/auth/bootstrap" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{}" >/dev/null 2>&1 || true
    else
      err "Sign-in failed. You can sign in later at spectyra.com"
    fi
  else
    echo ""
    read -rp "  Email: " auth_email
    read -rsp "  Password (min 8 chars): " auth_password
    echo ""
    read -rp "  Organization name: " auth_org

    info "Creating account..."
    SIGNUP_RESP=$(curl -sf -X POST "$SUPABASE_URL/auth/v1/signup" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"$auth_email\", \"password\": \"$auth_password\"}" 2>/dev/null || echo '{"error":"failed"}')

    TOKEN=$(echo "$SIGNUP_RESP" | grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"access_token"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)

    if [ -z "$TOKEN" ]; then
      USER_ID=$(echo "$SIGNUP_RESP" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 || true)
      if [ -n "$USER_ID" ]; then
        curl -sf -X POST "$SPECTYRA_API/auth/auto-confirm" \
          -H "Content-Type: application/json" \
          -d "{\"email\": \"$auth_email\"}" >/dev/null 2>&1 || true
        sleep 1
        LOGIN_RESP=$(curl -sf -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
          -H "apikey: $SUPABASE_ANON_KEY" \
          -H "Content-Type: application/json" \
          -d "{\"email\": \"$auth_email\", \"password\": \"$auth_password\"}" 2>/dev/null || echo '{}')
        TOKEN=$(echo "$LOGIN_RESP" | grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"access_token"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
      fi
    fi

    if [ -n "$TOKEN" ]; then
      ok "Account created for $auth_email"
      SIGNED_IN=true
      curl -sf -X POST "$SPECTYRA_API/auth/bootstrap" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"org_name\": \"$auth_org\"}" >/dev/null 2>&1 || true
    else
      err "Could not create account. Sign up later at spectyra.com"
    fi
  fi
fi

# ═══════════════════════════════════════════════════
step "Step 4 of 5 — AI provider key"
# ═══════════════════════════════════════════════════

echo -e "  ${DIM}Your key stays on this machine — never sent to Spectyra.${RESET}"
echo ""

PROVIDER_SET=false

if [ -f "$CONFIG_DIR/provider-keys.json" ]; then
  if cat "$CONFIG_DIR/provider-keys.json" 2>/dev/null | grep -qE '"(openai|anthropic|groq)"[[:space:]]*:[[:space:]]*"[^"]+'; then
    ok "Provider key already configured"
    PROVIDER_SET=true
  fi
fi

if [ "$PROVIDER_SET" = false ]; then
  echo "  Which provider?"
  echo "    1) OpenAI"
  echo "    2) Anthropic"
  echo "    3) Groq"
  echo ""
  read -rp "  Choice [1/2/3]: " provider_choice

  case "$provider_choice" in
    2) PROVIDER="anthropic" ;;
    3) PROVIDER="groq" ;;
    *) PROVIDER="openai" ;;
  esac

  echo ""
  read -rsp "  Paste your $PROVIDER API key: " provider_key
  echo ""

  if [ -n "$provider_key" ]; then
    mkdir -p "$CONFIG_DIR"
    cat > "$CONFIG_DIR/provider-keys.json" <<KEYJSON
{"$PROVIDER": "$provider_key"}
KEYJSON
    cat > "$CONFIG_DIR/config.json" <<CONFJSON
{
  "provider": "$PROVIDER",
  "port": 4111,
  "licenseKey": null,
  "providerKeys": {"$PROVIDER": "$provider_key"}
}
CONFJSON
    ok "$PROVIDER key saved"
    PROVIDER_SET=true
  else
    warn "No key entered. Add one later: openclaw skills install spectyra"
  fi
fi

# ═══════════════════════════════════════════════════
step "Step 5 of 5 — Spectyra skill + Local Companion"
# ═══════════════════════════════════════════════════

# Install skill if OpenClaw is available
if [ "$OPENCLAW_INSTALLED" = true ]; then
  INSTALLED=$(openclaw skills list 2>/dev/null || true)
  if echo "$INSTALLED" | grep -qi "spectyra"; then
    ok "Spectyra skill already installed"
  else
    if openclaw skills install spectyra >/dev/null 2>&1; then
      ok "Spectyra skill installed"
    else
      warn "Skill auto-install failed. Run: openclaw skills install spectyra"
    fi
  fi
fi

# Start companion
COMPANION_RUNNING=false
if curl -sf "$COMPANION_URL/health" >/dev/null 2>&1; then
  ok "Local Companion already running"
  COMPANION_RUNNING=true
elif [ "$PROVIDER_SET" = true ]; then
  # Try to start companion
  COMPANION_CMD=""
  if command -v spectyra-companion >/dev/null 2>&1; then
    COMPANION_CMD="spectyra-companion"
  fi

  if [ -z "$COMPANION_CMD" ]; then
    info "Installing Local Companion..."
    if npm install -g @spectyra/local-companion 2>/dev/null; then
      COMPANION_CMD="spectyra-companion"
      ok "Companion installed"
    fi
  fi

  if [ -n "$COMPANION_CMD" ]; then
    PROVIDER_FROM_CONFIG=$(cat "$CONFIG_DIR/config.json" 2>/dev/null | grep -o '"provider"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"provider"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || echo "openai")

    mkdir -p "$COMPANION_DIR"

    SPECTYRA_PORT=4111 \
    SPECTYRA_BIND_HOST="127.0.0.1" \
    SPECTYRA_PROVIDER="$PROVIDER_FROM_CONFIG" \
    SPECTYRA_PROVIDER_KEYS_FILE="$CONFIG_DIR/provider-keys.json" \
    SPECTYRA_RUN_MODE="on" \
    SPECTYRA_TELEMETRY="local" \
    nohup $COMPANION_CMD > "$COMPANION_DIR/companion.log" 2>&1 &

    sleep 2
    if curl -sf "$COMPANION_URL/health" >/dev/null 2>&1; then
      ok "Local Companion running on port 4111"
      COMPANION_RUNNING=true
    else
      warn "Companion started but not responding. Check ~/.spectyra/companion/companion.log"
    fi
  else
    info "Companion will start when you open the Spectyra Desktop app."
    echo -e "  ${DIM}Download: ${CYAN}https://spectyra.com/download${RESET}"
  fi
fi

# ═══════════════════════════════════════════════════
echo ""
echo -e "${BOLD}────────────────────────────────────────${RESET}"
echo ""

if [ "$COMPANION_RUNNING" = true ]; then
  echo -e "  ${GREEN}${BOLD}Setup complete!${RESET}"
  echo ""
  echo -e "  Run ${CYAN}openclaw chat${RESET} — optimization is automatic."
  echo -e "  Your costs are being reduced in real time."
  echo ""
  echo -e "  Dashboard: ${CYAN}https://spectyra.com/dashboard${RESET}"
  echo -e "  Desktop app (optional): ${CYAN}https://spectyra.com/download${RESET}"
else
  echo -e "  ${BOLD}Almost done!${RESET} Start the Local Companion to activate optimization:"
  echo ""
  echo -e "  ${CYAN}https://spectyra.com/download${RESET}  (Desktop app manages everything)"
fi
echo ""
