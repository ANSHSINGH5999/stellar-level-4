#!/usr/bin/env bash
# ── Stellar DeFi — Full Vercel Deploy Script ────────────────────────────────
# Usage: bash scripts/vercel-deploy.sh
# Requires: vercel CLI  →  npm i -g vercel
# ---------------------------------------------------------------------------
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}   Stellar DeFi — Vercel Deploy Script              ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── 1. Check vercel CLI ──────────────────────────────────────────────────────
if ! command -v vercel &> /dev/null; then
  echo -e "${YELLOW}Vercel CLI not found. Installing...${NC}"
  npm i -g vercel
fi

echo -e "${GREEN}✓ Vercel CLI ready${NC}"

# ── 2. Login check ───────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}Step 1/3 — Vercel login (skip if already logged in)${NC}"
vercel whoami 2>/dev/null || vercel login

# ── 3. Set environment variables ─────────────────────────────────────────────
echo ""
echo -e "${CYAN}Step 2/3 — Setting environment variables...${NC}"

# Values from frontend/.env
STLR_ISSUER="GCTWILTRMEWG4ZNWK6GTT5XRBR7BXZZ2PSRQ5PMDKTFDTZSPKKNLBSJO"
STLR_ISSUER_SECRET="SALRWKD4654QI2P3BF2CUQUURFVOYBERLKOMKZQ4N66SBC7OMIQ3SEWH"
STAKING_ACCOUNT="GDBLLO3W3ZSOWJP2PG6R3MLKUUXN5M6KPVOBADG5WRPIVJFLDPRFGJXF"
STAKING_SECRET="SAUU3BRXD3TTGVYTMES4E5E6RJJ6Y2CXRPWEUYG3LHCXEMEBTLRCVGTA"
HORIZON_URL="https://horizon-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NETWORK="TESTNET"

set_env() {
  local KEY=$1
  local VAL=$2
  echo "$VAL" | vercel env add "$KEY" production --force 2>/dev/null || \
  echo "$VAL" | vercel env add "$KEY" production 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} $KEY"
}

set_env "VITE_HORIZON_URL"          "$HORIZON_URL"
set_env "VITE_NETWORK_PASSPHRASE"   "$NETWORK_PASSPHRASE"
set_env "VITE_NETWORK"              "$NETWORK"
set_env "VITE_STLR_ISSUER"          "$STLR_ISSUER"
set_env "VITE_STLR_ISSUER_SECRET"   "$STLR_ISSUER_SECRET"
set_env "VITE_STAKING_ACCOUNT"      "$STAKING_ACCOUNT"
set_env "VITE_STAKING_SECRET"       "$STAKING_SECRET"

echo -e "${GREEN}✓ All environment variables set${NC}"

# ── 4. Deploy to production ───────────────────────────────────────────────────
echo ""
echo -e "${CYAN}Step 3/3 — Deploying to production...${NC}"
vercel --prod

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   ✅ Deployed successfully!                        ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
