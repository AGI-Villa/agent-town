#!/usr/bin/env bash
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${BOLD}${GREEN}✓${NC} $1"; }
warn()  { echo -e "${BOLD}${YELLOW}⚠${NC} $1"; }
error() { echo -e "${BOLD}${RED}✗${NC} $1"; }

echo ""
echo -e "${BOLD}🏘️  Agent Town Setup${NC}"
echo "────────────────────────────"
echo ""

# 1. Check Node.js
if ! command -v node &> /dev/null; then
  error "Node.js is not installed. Please install Node.js 20+ first."
  exit 1
fi
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  error "Node.js $NODE_VER detected. Agent Town requires Node.js 20+."
  exit 1
fi
info "Node.js $(node -v) detected"

# 2. Install dependencies
if [ ! -d "node_modules" ]; then
  echo ""
  echo "Installing dependencies..."
  npm install
  info "Dependencies installed"
else
  info "Dependencies already installed"
fi

# 3. Environment variables
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  warn "Created .env.local from .env.example"
  echo ""
  echo -e "  ${BOLD}Please edit .env.local and fill in your keys:${NC}"
  echo "  - NEXT_PUBLIC_SUPABASE_URL     → Your Supabase project URL"
  echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY → Supabase anon key"
  echo "  - SUPABASE_SERVICE_ROLE_KEY    → Supabase service role key"
  echo "  - OPENROUTER_API_KEY           → OpenRouter API key"
  echo ""
  echo -e "  ${BOLD}Then run this script again.${NC}"
  exit 0
else
  info ".env.local exists"
fi

# 4. Validate required env vars
source_env() {
  while IFS= read -r line || [[ -n "$line" ]]; do
    line=$(echo "$line" | sed 's/#.*//' | xargs)
    [[ -z "$line" ]] && continue
    export "$line" 2>/dev/null || true
  done < .env.local
}
source_env

MISSING=0
for VAR in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY OPENROUTER_API_KEY; do
  VAL=$(eval echo "\${$VAR:-}")
  if [ -z "$VAL" ] || [[ "$VAL" == your_* ]]; then
    error "$VAR is not configured in .env.local"
    MISSING=1
  fi
done
if [ "$MISSING" -eq 1 ]; then
  echo ""
  echo "Please fill in the missing values in .env.local and run setup again."
  exit 1
fi
info "Environment variables validated"

# 5. Detect OpenClaw
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
echo ""
if [ -f "$OPENCLAW_HOME/openclaw.json" ]; then
  AGENT_COUNT=$(node -e "
    const cfg = require('$OPENCLAW_HOME/openclaw.json');
    console.log((cfg.agents?.list || []).length);
  " 2>/dev/null || echo "0")
  info "OpenClaw detected at $OPENCLAW_HOME ($AGENT_COUNT agents registered)"

  # Count agents with session logs
  ACTIVE_COUNT=0
  AGENTS_DIR="$OPENCLAW_HOME/agents"
  if [ -d "$AGENTS_DIR" ]; then
    for agent_dir in "$AGENTS_DIR"/*/; do
      if [ -d "${agent_dir}sessions" ]; then
        JSONL_COUNT=$(find "${agent_dir}sessions" -name "*.jsonl" 2>/dev/null | wc -l)
        if [ "$JSONL_COUNT" -gt 0 ]; then
          ACTIVE_COUNT=$((ACTIVE_COUNT + 1))
        fi
      fi
    done
  fi
  info "$ACTIVE_COUNT agents have session logs (will appear in town)"

  echo ""
  echo -e "  ${GREEN}Auto-discovery enabled:${NC}"
  echo "  Agent names, roles, and personalities will be read"
  echo "  from OpenClaw's openclaw.json and IDENTITY.md files."
  echo "  No manual agents.json configuration needed!"
else
  warn "OpenClaw not found at $OPENCLAW_HOME"
  echo ""
  echo "  Agent Town will still work, but you'll need to either:"
  echo "  1. Install OpenClaw and create some agents, or"
  echo "  2. Edit agents.json to manually define your agents"
  echo ""
  echo "  Set OPENCLAW_HOME in .env.local if your OpenClaw"
  echo "  is installed at a non-default location."
fi

# 6. Database reminder
echo ""
echo -e "  ${BOLD}Database Setup:${NC}"
echo "  If you haven't already, run supabase/schema.sql in your"
echo "  Supabase SQL Editor to create the required tables."
echo ""

# 7. Build
echo "Building for production..."
npm run build
info "Production build complete"

echo ""
echo "────────────────────────────"
echo -e "${BOLD}${GREEN}Setup complete!${NC}"
echo ""
echo "  Start development server:  npm run dev"
echo "  Start production server:   npm start"
echo ""
echo "  The watcher and daily moment scheduler start automatically."
echo "  Social feed posts are generated daily at 22:00 Beijing time."
echo ""
