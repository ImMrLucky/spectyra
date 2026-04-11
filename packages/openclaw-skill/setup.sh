#!/usr/bin/env bash
# Spectyra skill post-install — full interactive setup, no browser required.
# Runs after `openclaw skills install spectyra` merges config-fragment.json.
#
# SECURITY INVARIANTS (for auditors; see SECURITY.md in this folder):
# - OpenAI/Anthropic/Groq API keys are written ONLY under ~/.spectyra/desktop/ (local disk).
# - Those provider keys are NEVER sent in HTTP requests to Spectyra cloud — only used locally
#   by the companion to call the upstream LLM API after optimization.
# - Traffic to SPECTYRA_API is account/license related (same product as spectyra.ai), not provider secrets.
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# Must match tools/local-companion/src/cloudDefaults.ts (DEFAULT_SPECTYRA_CLOUD_API_V1).
# Optional: SPECTYRA_API_URL for staging; unset = production Cloud API (same site as https://spectyra.ai).
# Default Railway /v1 (reliable for curl POST). Companion uses spectyra.ai first + retry — see tools/local-companion/src/spectyraCloudFetch.ts
SPECTYRA_API="${SPECTYRA_API_URL:-https://spectyra.up.railway.app/v1}"
SUPABASE_URL="https://jajqvceuenqeblbgsigt.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphanF2Y2V1ZW5xZWJsYmdzaWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDI4MDgsImV4cCI6MjA4NDk3ODgwOH0.IJ7CSyX-_-lahfaOzM9U5EIpR6tcW-GhiMZeCY_efno"
COMPANION_URL="http://localhost:4111"
CONFIG_DIR="$HOME/.spectyra/desktop"
COMPANION_DIR="$HOME/.spectyra/companion"
COMPANION_BIN_DIR="$HOME/.spectyra/bin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERSIST_PY="$SCRIPT_DIR/persist_spectyra_desktop_config.py"
CONFIG_JSON="$CONFIG_DIR/config.json"

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
  echo -e "  ${DIM}Create or sign in here — no need to open spectyra.ai first.${RESET}"
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
      API_KEY=""

      # Idempotent org + API key (POST /auth/bootstrap with {} wrongly requires org_name and always fails)
      ENSURE_TMP=$(mktemp)
      ECODE=$(curl -sS -o "$ENSURE_TMP" -w "%{http_code}" -X POST "$SPECTYRA_API/auth/ensure-account" \
        -H "Authorization: Bearer $SPECTYRA_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{}" || echo "000")
      if [ "$ECODE" = "200" ] || [ "$ECODE" = "201" ]; then
        API_KEY=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('api_key') or '')" "$ENSURE_TMP" 2>/dev/null || true)
        LICENSE_KEY=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('license_key') or '')" "$ENSURE_TMP" 2>/dev/null || true)
      else
        warn "Spectyra ensure-account returned HTTP $ECODE (org may still exist — continuing)"
      fi
      rm -f "$ENSURE_TMP"

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

      mkdir -p "$CONFIG_DIR"
      export SPECTYRA_ACCOUNT_EMAIL="$auth_email"
      export SPECTYRA_ORG_API_KEY="$API_KEY"
      export SPECTYRA_LICENSE_KEY="$LICENSE_KEY"
      if [ -f "$PERSIST_PY" ]; then
        echo "$LOGIN_RESP" | python3 "$PERSIST_PY" "$CONFIG_JSON"
        ok "Saved Spectyra session to $CONFIG_JSON"
      else
        warn "Missing $PERSIST_PY — run spectyra-companion setup to finish account linking."
      fi
      unset SPECTYRA_ACCOUNT_EMAIL SPECTYRA_ORG_API_KEY SPECTYRA_LICENSE_KEY
      if [ -z "$API_KEY" ]; then
        info "No new API key returned (account may already exist). Add one at spectyra.ai → Settings if needed."
      fi
    else
      ERR_MSG=$(echo "$LOGIN_RESP" | grep -o '"error_description"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"error_description"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || echo "Sign-in failed")
      err "$ERR_MSG"
      echo -e "  ${DIM}You can sign in later in the Spectyra Desktop app or at spectyra.ai${RESET}"
    fi
  else
    # ── Sign up ──
    echo ""
    read -rp "  Email: " auth_email
    read -rsp "  Password (min 8 chars): " auth_password
    echo ""
    read -rp "  Workspace name (optional — Enter uses default from your email): " auth_org

    info "Creating account..."
    SIGNUP_RESP=$(curl -sf -X POST "$SUPABASE_URL/auth/v1/signup" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"$auth_email\", \"password\": \"$auth_password\"}" 2>/dev/null || echo '{"error":"request_failed"}')

    SPECTYRA_TOKEN=$(echo "$SIGNUP_RESP" | grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"access_token"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
    LOGIN_RESP=""
    SESSION_JSON="$SIGNUP_RESP"

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
        SESSION_JSON="$LOGIN_RESP"
      fi
    fi

    if [ -n "$SPECTYRA_TOKEN" ]; then
      ok "Account created for $auth_email"
      SIGNED_IN=true

      API_KEY=""
      LICENSE_KEY=""
      ORG_JSON=$(AUTH_ORG="$auth_org" python3 -c "import json,os; print(json.dumps({'org_name': os.environ['AUTH_ORG']}))")
      ENSURE_TMP=$(mktemp)
      ECODE=$(curl -sS -o "$ENSURE_TMP" -w "%{http_code}" -X POST "$SPECTYRA_API/auth/ensure-account" \
        -H "Authorization: Bearer $SPECTYRA_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$ORG_JSON" || echo "000")
      if [ "$ECODE" = "200" ] || [ "$ECODE" = "201" ]; then
        API_KEY=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('api_key') or '')" "$ENSURE_TMP" 2>/dev/null || true)
        LICENSE_KEY=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('license_key') or '')" "$ENSURE_TMP" 2>/dev/null || true)
      else
        warn "Spectyra ensure-account returned HTTP $ECODE"
      fi
      rm -f "$ENSURE_TMP"

      if [ -z "$LICENSE_KEY" ]; then
        LK_RESP=$(curl -sf -X POST "$SPECTYRA_API/license/generate" \
          -H "Authorization: Bearer $SPECTYRA_TOKEN" \
          -H "Content-Type: application/json" \
          -d '{"device_name":"openclaw-skill-setup"}' 2>/dev/null || echo '{}')
        LICENSE_KEY=$(echo "$LK_RESP" | grep -o '"license_key"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"license_key"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)
      fi

      mkdir -p "$CONFIG_DIR"
      export SPECTYRA_ACCOUNT_EMAIL="$auth_email"
      export SPECTYRA_ORG_API_KEY="$API_KEY"
      export SPECTYRA_LICENSE_KEY="$LICENSE_KEY"
      if [ -f "$PERSIST_PY" ]; then
        echo "$SESSION_JSON" | python3 "$PERSIST_PY" "$CONFIG_JSON"
        ok "Saved Spectyra session to $CONFIG_JSON"
      else
        warn "Missing $PERSIST_PY — run spectyra-companion setup to finish account linking."
      fi
      unset SPECTYRA_ACCOUNT_EMAIL SPECTYRA_ORG_API_KEY SPECTYRA_LICENSE_KEY
    else
      err "Could not create account. You can sign up later at spectyra.ai"
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

    export SP_PROVIDER="$PROVIDER"
    export SP_PROV_KEY="$provider_key"
    python3 <<'PY'
import json, os
from pathlib import Path

cfg_path = Path(os.path.expanduser("~/.spectyra/desktop/config.json"))
keys_path = Path(os.path.expanduser("~/.spectyra/desktop/provider-keys.json"))
prov = os.environ["SP_PROVIDER"]
key = os.environ["SP_PROV_KEY"]

cfg: dict = {}
if cfg_path.exists():
    try:
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    except Exception:
        cfg = {}

cfg.setdefault("runMode", "on")
cfg.setdefault("telemetryMode", "local")
cfg.setdefault("promptSnapshots", "local_only")
cfg["provider"] = prov
cfg["aliasSmartModel"] = "gpt-4o-mini"
cfg["aliasFastModel"] = "gpt-4o-mini"
cfg["aliasQualityModel"] = "gpt-4o"
if not cfg.get("port"):
    cfg["port"] = 4111
pk = cfg.get("providerKeys")
if not isinstance(pk, dict):
    pk = {}
pk[prov] = key
cfg["providerKeys"] = pk

cfg_path.parent.mkdir(parents=True, exist_ok=True)
cfg_path.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")
keys_path.write_text(json.dumps({prov: key}, indent=2) + "\n", encoding="utf-8")
PY
    unset SP_PROVIDER SP_PROV_KEY

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
      echo -e "  ${DIM}Download it at: ${CYAN}https://spectyra.ai/download${RESET}"
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
  echo -e "  Local savings: ${CYAN}http://127.0.0.1:4111/dashboard${RESET}"
  echo -e "  Cloud (optional): ${CYAN}https://spectyra.ai/dashboard${RESET}"
else
  echo -e "  ${BOLD}Almost there!${RESET}"
  echo ""
  if [ "$PROVIDER_SET" = false ]; then
    echo "  Remaining: add an AI provider key"
  fi
  echo "  Remaining: start the Local Companion"
  echo ""
  echo -e "  Option A: Download the ${BOLD}Spectyra Desktop app${RESET} (includes everything):"
  echo -e "            ${CYAN}https://spectyra.ai/download${RESET}"
  echo ""
  echo -e "  Option B: Re-run this setup after adding a provider key:"
  echo -e "            ${CYAN}openclaw skills install spectyra${RESET}"
fi
echo ""
