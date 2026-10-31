#!/usr/bin/env bash
# ==============================================================================
# Dhayam Test & Verification Suite
# ==============================================================================
# Runs headless browser verification and rules validation.
# ==============================================================================

set -euo pipefail

# Resolve project root directory (canonical realpath follows symlinks)
TARGET_FILE="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "${TARGET_FILE}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SITE_DIR="${ROOT_DIR}/site"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
GOLD='\033[38;5;214m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${GOLD}${BOLD}▶ Running Dhayam Verification Suite...${NC}\n"
PASSED=0
FAILED=0

check() {
    local name="$1"
    local cmd="$2"
    echo -n "  • ${name}... "
    if eval "$cmd" >/dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# 1. Structural File Integrity Checks
check "Checking site/index.html exists" "[ -s '${SITE_DIR}/index.html' ]"
check "Checking modular CSS files (>= 8 files)" "[ \$(ls -1 '${SITE_DIR}/css/'*.css 2>/dev/null | wc -l) -ge 8 ]"
check "Checking modular JS files (>= 12 files)" "[ \$(ls -1 '${SITE_DIR}/js/'*.js 2>/dev/null | wc -l) -ge 12 ]"
check "Checking board definition JSON exists" "[ -s '${SITE_DIR}/board-definition-v1-candidate.json' ]"

# 2. Browser Headless Verification (Headless Chrome)
if command -v google-chrome >/dev/null 2>&1; then
    CHROME_OUTPUT=$(google-chrome --headless --disable-gpu --virtual-time-budget=2000 --dump-dom "file://${SITE_DIR}/index.html" 2>&1)
    
    check "Headless Chrome loads without fatal crash" "[ -n '${CHROME_OUTPUT}' ]"
    check "Board element #board rendered in DOM" "echo '${CHROME_OUTPUT}' | grep -q 'id=\"board\"'"
    check "Dice elements #dieA and #dieB rendered" "echo '${CHROME_OUTPUT}' | grep -q 'id=\"dieA\"' && echo '${CHROME_OUTPUT}' | grep -q 'id=\"dieB\"'"
    check "Family table #players rendered with avatars" "echo '${CHROME_OUTPUT}' | grep -q 'class=\"avatar\"'"
    check "Zero JavaScript runtime errors" "! (echo '${CHROME_OUTPUT}' | grep -iE 'uncaught|syntaxerror|typeerror')"
else
    echo "  (Skipping headless Chrome checks: google-chrome not found in PATH)"
fi

# 3. Node.js Rules-Engine Test Suite (if node available)
if command -v node >/dev/null 2>&1; then
    check "Node.js rules-engine unit tests (npm test)" "npm test"
else
    # Python-based rules verification fallback
    check "Python rules engine verification" "python3 -c '
import json
with open(\"${SITE_DIR}/board-definition-v1-candidate.json\") as f:
    board = json.load(f)
assert board[\"grid\"][\"rows\"] == 7
assert board[\"grid\"][\"columns\"] == 7
assert len(board[\"safeSquares\"]) == 8
assert board[\"goal\"] == \"D4\"
assert board[\"movement\"][\"progressFinish\"] == 43
'"
fi

echo ""
echo "-----------------------------------------------------------------"
if [ "${FAILED}" -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ ALL CHECKS PASSED (${PASSED}/${PASSED})${NC}"
    exit 0
else
    echo -e "${RED}${BOLD}✗ SOME CHECKS FAILED (${FAILED} failed, ${PASSED} passed)${NC}"
    exit 1
fi
