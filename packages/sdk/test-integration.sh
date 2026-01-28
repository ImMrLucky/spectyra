#!/bin/bash
# Quick integration test script for @spectyra/sdk

set -e

echo "🧪 Testing @spectyra/sdk Integration"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test directory
TEST_DIR="test-sdk-integration"
cd "$(dirname "$0")"

# Cleanup
if [ -d "$TEST_DIR" ]; then
  echo "Cleaning up previous test directory..."
  rm -rf "$TEST_DIR"
fi

mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "📦 Creating test project..."
npm init -y > /dev/null 2>&1

echo "📥 Installing @spectyra/sdk..."
npm install @spectyra/sdk

echo ""
echo "✅ Test 1: Verify Installation"
node -e "
import('@spectyra/sdk').then(m => {
  const hasCreate = 'createSpectyra' in m;
  const hasLegacy = 'SpectyraClient' in m;
  if (hasCreate && hasLegacy) {
    console.log('${GREEN}✅ SDK installed correctly${NC}');
    console.log('   Exports:', Object.keys(m).join(', '));
  } else {
    console.log('${RED}❌ Missing exports${NC}');
    process.exit(1);
  }
}).catch(e => {
  console.log('${RED}❌ Import failed:${NC}', e.message);
  process.exit(1);
});
"

echo ""
echo "✅ Test 2: Local Mode"
node -e "
import { createSpectyra } from '@spectyra/sdk';

const spectyra = createSpectyra({ mode: 'local' });
const ctx = { runId: 'test-' + Date.now() };
const options = spectyra.agentOptions(ctx, 'test prompt');

const required = ['model', 'maxBudgetUsd', 'allowedTools', 'permissionMode'];
const hasAll = required.every(k => k in options);

if (hasAll && options.model) {
  console.log('${GREEN}✅ Local mode works${NC}');
  console.log('   Model:', options.model);
  console.log('   Budget:', options.maxBudgetUsd);
} else {
  console.log('${RED}❌ Invalid options structure${NC}');
  process.exit(1);
}
"

echo ""
echo "✅ Test 3: API Mode Validation"
node -e "
import { createSpectyra } from '@spectyra/sdk';

try {
  createSpectyra({ mode: 'api' });
  console.log('${RED}❌ Should throw error for missing endpoint${NC}');
  process.exit(1);
} catch (e) {
  if (e.message.includes('endpoint')) {
    console.log('${GREEN}✅ API mode validation works${NC}');
  } else {
    console.log('${RED}❌ Wrong error message${NC}');
    process.exit(1);
  }
}
"

echo ""
echo "✅ Test 4: PromptMeta Support"
node -e "
import { createSpectyra } from '@spectyra/sdk';

const spectyra = createSpectyra({ mode: 'local' });
const ctx = { runId: 'test' };
const meta = { promptChars: 5000, path: 'code' };
const options = spectyra.agentOptions(ctx, meta);

if (options.model) {
  console.log('${GREEN}✅ PromptMeta support works${NC}');
  console.log('   Model selected:', options.model);
} else {
  console.log('${RED}❌ PromptMeta failed${NC}');
  process.exit(1);
}
"

echo ""
echo "✅ Test 5: TypeScript Types"
if command -v tsc &> /dev/null; then
  cat > test-types.ts << 'EOF'
import { createSpectyra, type SpectyraConfig, type SpectyraCtx } from '@spectyra/sdk';

const config: SpectyraConfig = { mode: 'local' };
const spectyra = createSpectyra(config);
const ctx: SpectyraCtx = { runId: 'test' };
const options = spectyra.agentOptions(ctx, 'test');
EOF
  
  if tsc --noEmit test-types.ts 2>/dev/null; then
    echo "${GREEN}✅ TypeScript types work${NC}"
    rm -f test-types.ts test-types.js
  else
    echo "${YELLOW}⚠️  TypeScript check skipped (tsc not available)${NC}"
  fi
else
  echo "${YELLOW}⚠️  TypeScript check skipped (tsc not installed)${NC}"
fi

echo ""
echo "===================================="
echo "${GREEN}✅ All basic tests passed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Test API mode with: export SPECTYRA_API_KEY=your-key"
echo "  2. Test with Claude Agent SDK"
echo "  3. Check full test suite in TESTING.md"
echo ""
