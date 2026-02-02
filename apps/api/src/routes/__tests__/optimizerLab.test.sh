#!/bin/bash
# Optimizer Lab Endpoint Test Script
#
# This script tests the /v1/admin/optimize endpoint.
# Requires: curl, jq
#
# Usage:
#   ./optimizerLab.test.sh <API_URL> <BEARER_TOKEN>
#
# Example:
#   ./optimizerLab.test.sh http://localhost:3001 "eyJhbGciOiJIUzI1NiIs..."

API_URL="${1:-http://localhost:3001}"
TOKEN="${2:-}"

echo "================================================"
echo "Optimizer Lab Endpoint Tests"
echo "API URL: $API_URL"
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function
test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  local expected_status="$5"

  echo -n "Testing: $name... "
  
  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$data" \
      "$API_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      "$API_URL$endpoint")
  fi

  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$status_code" == "$expected_status" ]; then
    echo -e "${GREEN}PASSED${NC} (HTTP $status_code)"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}FAILED${NC} (Expected $expected_status, got $status_code)"
    echo "Response: $body" | head -c 500
    echo ""
    ((TESTS_FAILED++))
    return 1
  fi
}

# ================================================
# Test 1: Health Check
# ================================================
echo ""
echo "--- Health Check ---"
test_endpoint "Health endpoint" "GET" "/v1/admin/optimize/health" "" "200"

# ================================================
# Test 2: Chat Demo Optimization
# ================================================
echo ""
echo "--- Chat Demo Optimization ---"

CHAT_DATA='{
  "demoType": "chat",
  "optimizationLevel": "balanced",
  "prompt": "You are a helpful assistant. Previous context: The user asked about billing. The user ID is 12345. The account is active. The plan is Business Pro. Now the user asks: Can you check my billing status again? My user ID is 12345 and my account should be active. I am on the Business Pro plan.",
  "debug": true
}'

test_endpoint "Chat optimization (balanced)" "POST" "/v1/admin/optimize" "$CHAT_DATA" "200"

# ================================================
# Test 3: Code Demo Optimization
# ================================================
echo ""
echo "--- Code Demo Optimization ---"

CODE_DATA='{
  "demoType": "code",
  "optimizationLevel": "aggressive",
  "prompt": "Fix the authentication bug in the user service.",
  "repoContext": "File: src/auth.ts\n```typescript\nexport function validateToken(token: string) {\n  const decoded = jwt.verify(token, secret);\n  return decoded;\n}\n```\n\nFile: src/auth.ts (repeated for context)\n```typescript\nexport function validateToken(token: string) {\n  const decoded = jwt.verify(token, secret);\n  return decoded;\n}\n```",
  "debug": true
}'

test_endpoint "Code optimization (aggressive)" "POST" "/v1/admin/optimize" "$CODE_DATA" "200"

# ================================================
# Test 4: Safe Optimization Level
# ================================================
echo ""
echo "--- Safe Optimization Level ---"

SAFE_DATA='{
  "demoType": "chat",
  "optimizationLevel": "safe",
  "prompt": "Hello, how are you?"
}'

test_endpoint "Safe optimization level" "POST" "/v1/admin/optimize" "$SAFE_DATA" "200"

# ================================================
# Test 5: Missing Required Field
# ================================================
echo ""
echo "--- Validation Tests ---"

INVALID_DATA='{
  "prompt": "Missing demoType field"
}'

test_endpoint "Missing demoType returns 400" "POST" "/v1/admin/optimize" "$INVALID_DATA" "400"

# ================================================
# Test 6: No Input
# ================================================

NO_INPUT_DATA='{
  "demoType": "chat"
}'

test_endpoint "No prompt/messages returns 400" "POST" "/v1/admin/optimize" "$NO_INPUT_DATA" "400"

# ================================================
# Summary
# ================================================
echo ""
echo "================================================"
echo "Test Results"
echo "================================================"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed.${NC}"
  exit 1
fi
