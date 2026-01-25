#!/bin/bash
set -e

# Try pnpm first, fallback to npm if it fails
if command -v pnpm &> /dev/null; then
  echo "Using pnpm..."
  pnpm install || {
    echo "pnpm failed, trying npm..."
    npm install
    cd apps/web
    npm run build -- --configuration production
    exit 0
  }
  pnpm --filter web build --configuration production
else
  echo "pnpm not available, using npm..."
  npm install
  cd apps/web
  npm run build -- --configuration production
fi
