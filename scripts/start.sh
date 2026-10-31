#!/usr/bin/env bash
# ==============================================================================
# Dhayam Local Server Launcher
# ==============================================================================
# Serves the static `site/` directory using Python's built-in HTTP server.
# Zero external runtime or package installations required.
# ==============================================================================

set -euo pipefail

# Resolve project root directory (canonical realpath follows symlinks)
TARGET_FILE="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "${TARGET_FILE}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SITE_DIR="${ROOT_DIR}/site"

# Find an available port starting at 8000
PORT=8000
while lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1; do
    PORT=$((PORT + 1))
done

# ANSI color codes
BOLD='\033[1m'
GOLD='\033[38;5;214m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GOLD}${BOLD}"
echo "    ╔═══════════════════════════════════════════════════════════════╗"
echo "    ║               DHAYAM · HERITAGE BOARD GAME                    ║"
echo "    ╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${GREEN}✓ Local server ready!${NC}"
echo -e "  Serving directory: ${CYAN}${SITE_DIR}${NC}"
echo -e "  Local game URL:    ${GOLD}${BOLD}http://localhost:${PORT}/${NC}"
echo ""
echo "Press Ctrl+C to stop the server."
echo "-----------------------------------------------------------------"

# Auto-open browser if display server is available
if command -v xdg-open >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ]; then
    (sleep 0.5 && xdg-open "http://localhost:${PORT}/") &
elif command -v open >/dev/null 2>&1; then
    (sleep 0.5 && open "http://localhost:${PORT}/") &
fi

# Run python HTTP server
exec python3 -m http.server "${PORT}" --directory "${SITE_DIR}"
