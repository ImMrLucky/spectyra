#!/bin/bash
set -e

# Try multiple methods to get pnpm working
echo "Attempting to install pnpm..."

# Method 1: Try corepack (Node 16+)
if command -v corepack &> /dev/null; then
  echo "Using corepack..."
  corepack enable
  corepack prepare pnpm@9.12.3 --activate
  pnpm --version
elif command -v npm &> /dev/null; then
  # Method 2: Install via npm
  echo "Installing pnpm via npm..."
  npm install -g pnpm@9.12.3
  pnpm --version
elif command -v curl &> /dev/null; then
  # Method 3: Install via standalone script
  echo "Installing pnpm via standalone script..."
  curl -fsSL https://get.pnpm.io/install.sh | sh -
  export PNPM_HOME="$HOME/.local/share/pnpm"
  export PATH="$PNPM_HOME:$PATH"
  pnpm --version
else
  echo "ERROR: Could not install pnpm"
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install --no-frozen-lockfile || {
  echo "pnpm install failed, retrying with network settings..."
  pnpm install --no-frozen-lockfile --network-timeout=120000
}
