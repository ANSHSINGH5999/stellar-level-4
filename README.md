# Stellar DeFi Platform

[![CI — Lint & Build](https://github.com/ANSHSINGH5999/stellar-level-4/actions/workflows/ci.yml/badge.svg)](https://github.com/ANSHSINGH5999/stellar-level-4/actions/workflows/ci.yml)
[![Deploy — Vercel](https://github.com/ANSHSINGH5999/stellar-level-4/actions/workflows/deploy.yml/badge.svg)](https://github.com/ANSHSINGH5999/stellar-level-4/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stellar Network](https://img.shields.io/badge/Network-Stellar%20Testnet-blueviolet)](https://stellar.org)
[![Freighter Wallet](https://img.shields.io/badge/Wallet-Freighter-6366f1)](https://freighter.app)

A **production-ready DeFi staking platform** built entirely on the **Stellar Network**. Stake **STLR** tokens and earn **12% APY** in on-chain rewards — with real-time event streaming, multi-operation atomic transactions (Stellar's equivalent of inter-contract calls), and a fully responsive black-and-white UI.

**🚀 Live Demo:** [https://stellar-level-4.vercel.app](https://stellar-level-4.vercel.app)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Stellar Accounts & Token](#stellar-accounts--token)
- [Inter-Account Call Pattern](#inter-account-call-pattern)
- [Real-Time Event Streaming](#real-time-event-streaming)
- [Installation & Local Setup](#installation--local-setup)
- [Deployment — Vercel](#deployment--vercel)
- [CI/CD Pipeline](#cicd-pipeline)
- [GitHub Secrets Required](#github-secrets-required)
- [Mobile Responsive Design](#mobile-responsive-design)
- [Wallet Support](#wallet-support)
- [Security](#security)
- [Project Structure](#project-structure)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Stellar DeFi Platform                        │
│                                                                 │
│  ┌──────────────┐    Freighter     ┌──────────────────────────┐ │
│  │   Browser    │◄────Wallet──────►│   Stellar Horizon API    │ │
│  │  (React App) │                  │  horizon-testnet.stellar │ │
│  └──────┬───────┘                  │       .org               │ │
│         │                          └────────────┬─────────────┘ │
│         │ Signs TX                              │ SSE Streams   │
│         ▼                                       ▼               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Stellar Testnet                              │  │
│  │                                                           │  │
│  │  ┌────────────────────┐    ┌────────────────────────┐   │  │
│  │  │   STLR Issuer Acct │    │  Staking Escrow Acct   │   │  │
│  │  │ GCTWILTRMEWG4ZNWK… │    │ GDBLLO3W3ZSOWJP2PG6R…  │   │  │
│  │  │                    │    │                         │   │  │
│  │  │ • Issues STLR      │    │ • Holds staked tokens  │   │  │
│  │  │ • Stores APY rate  │    │ • 40M STLR reward pool │   │  │
│  │  │   in ManageData    │    │ • Co-signs payouts     │   │  │
│  │  └────────────────────┘    └────────────────────────┘   │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              User Wallet (Freighter)                │  │  │
│  │  │ • stlr_staked_amount  ← ManageData (on-chain state)│  │  │
│  │  │ • stlr_staked_at      ← Unix timestamp             │  │  │
│  │  │ • stlr_cooldown_start ← Unstake cooldown timer     │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Blockchain | Stellar Network | Testnet |
| Stellar SDK | @stellar/stellar-sdk | 14.6.x |
| Wallet | Freighter (@stellar/freighter-api) | 6.0.x |
| Frontend | React | 18.3.x |
| Build Tool | Vite | 5.2.x |
| Styling | Tailwind CSS | 3.4.x |
| Node Polyfills | vite-plugin-node-polyfills | 0.25.x |
| Error Tracking | Sentry | 7.x |
| Notifications | react-hot-toast | 2.4.x |
| Icons | lucide-react | 0.368.x |
| CI/CD | GitHub Actions | — |
| Hosting | Vercel | — |
| Node.js | ≥ 18.0.0 | — |

---

## Stellar Accounts & Token

### Live Testnet Accounts

| Role | Public Key | Explorer |
|------|-----------|---------|
| **STLR Issuer** | `GCTWILTRMEWG4ZNWK6GTT5XRBR7BXZZ2PSRQ5PMDKTFDTZSPKKNLBSJO` | [View](https://stellar.expert/explorer/testnet/account/GCTWILTRMEWG4ZNWK6GTT5XRBR7BXZZ2PSRQ5PMDKTFDTZSPKKNLBSJO) |
| **Staking Escrow** | `GDBLLO3W3ZSOWJP2PG6R3MLKUUXN5M6KPVOBADG5WRPIVJFLDPRFGJXF` | [View](https://stellar.expert/explorer/testnet/account/GDBLLO3W3ZSOWJP2PG6R3MLKUUXN5M6KPVOBADG5WRPIVJFLDPRFGJXF) |

### Setup Transaction Hashes

| Action | Transaction Hash |
|--------|----------------|
| Trustline established (staking acct) | `7e88efbe2c2f40ddcda38cf3ba1f6a4efa2df3c3b0d169ee75e660efd7d5c1ed` |
| 40M STLR minted to reward pool | `79a8306012507e5f34d9d713b915284a7711a89e409c701bc39ca01edec13680` |

### Token Parameters (STLR)

| Parameter | Value |
|-----------|-------|
| Asset Code | `STLR` |
| Network | Stellar Testnet |
| Total Reward Pool | 40,000,000 STLR |
| APY Rate | 12% per year |
| Unstake Cooldown | 3 days |
| Testnet Faucet | 10,000 STLR per request |

---

## Inter-Account Call Pattern

Stellar doesn't have smart contracts (unless using Soroban). Instead, this project uses **multi-operation atomic transactions** — multiple operations bundled in one transaction that either all succeed or all fail. This is the Stellar equivalent of inter-contract calls.

### Stake Flow (4 operations, 1 transaction)

```
User signs 1 atomic transaction containing:

  Op 1: Payment(user → staking_escrow, amount STLR)
          ↳ Moves tokens to escrow = "lock" equivalent

  Op 2: ManageData("stlr_staked_amount", amount)
          ↳ Records stake on-chain in user's account data

  Op 3: ManageData("stlr_staked_at", unix_timestamp)
          ↳ Records start time for APY calculation

  Op 4: ManageData("stlr_cooldown_start", null)   [if exists]
          ↳ Clears any previous cooldown
```

### Unstake Flow (2 transactions)

```
Transaction A (staking escrow signs):
  Op 1: Payment(staking_escrow → user, staked_amount STLR)
  Op 2: Payment(staking_escrow → user, reward_amount STLR)  [if rewards > 0]

Transaction B (user signs via Freighter):
  Op 1: ManageData("stlr_staked_amount", null)   — clear state
  Op 2: ManageData("stlr_staked_at",     null)
  Op 3: ManageData("stlr_cooldown_start",null)
```

### Reward Calculation (off-chain, verified against on-chain timestamp)

```
reward = stakedAmount × APY_RATE × (elapsedSeconds / SECONDS_PER_YEAR)

Where:
  APY_RATE       = 0.12 (12%, read from issuer's ManageData on-chain)
  elapsedSeconds = now() - stlr_staked_at  (stlr_staked_at from chain)
  SECONDS_PER_YEAR = 31,536,000
```

---

## Real-Time Event Streaming

Three parallel **Horizon SSE (Server-Sent Events)** streams with auto-reconnect and deduplication:

| Stream | Monitors | Events Emitted |
|--------|---------|---------------|
| A — Staking account payments | All payments TO staking escrow | `Staked` |
| B — User account operations | ManageData changes on user's account | `TrustlineSet`, `UnstakeRequested`, `Unstaked`, `RewardsClaimed` |
| C — User account payments | Native XLM payments | `AccountFunded` |

**Deduplication:** Every event is keyed by `txHash + type` in a `Set` — the same transaction can never produce duplicate entries even if it triggers multiple streams simultaneously.

**Auto-reconnect:** Each stream reconnects on error with exponential backoff (3s → 6s → 12s → 30s max).

---

## Installation & Local Setup

### Prerequisites

- Node.js ≥ 18.0.0
- npm ≥ 9.0.0
- [Freighter](https://freighter.app) browser extension installed
- Freighter set to **Testnet** network

### 1. Clone

```bash
git clone https://github.com/ANSHSINGH5999/stellar-level-4.git
cd stellar-level-4
```

### 2. Install dependencies

```bash
# Root (setup script dependencies)
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 3. Configure environment

```bash
# Option A: Run the automated setup (creates fresh testnet accounts)
npm run setup
# This creates frontend/.env with real testnet credentials

# Option B: Manual setup
cp .env.example frontend/.env
# Edit frontend/.env with your STLR issuer + staking account keys
```

> **Note:** `npm run setup` uses Stellar's Friendbot to fund accounts with 10,000 XLM each, sets up the STLR trustline, and issues 40,000,000 STLR to the staking reward pool — all on testnet automatically.

### 4. Start dev server

```bash
npm run dev
# Opens http://localhost:3000
```

### 5. Use the app

1. Open Freighter → switch to **Testnet**
2. Visit `http://localhost:3000`
3. Click **Connect Wallet** → select Freighter
4. Click **Activate STLR Wallet** (sets trustline)
5. Click **Get 10,000 STLR** (testnet faucet)
6. Enter amount → **Stake STLR**
7. Watch live reward counter update every second

---

## Deployment — Vercel

### One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ANSHSINGH5999/stellar-level-4)

### Manual deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
vercel --prod
```

Vercel uses `vercel.json` at the root which sets:
- Build command: `cd frontend && npm install && npm run build`
- Output directory: `frontend/dist`
- SPA rewrites: all routes → `/index.html`

### Environment variables to set in Vercel dashboard

Go to **Vercel → Project → Settings → Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `VITE_HORIZON_URL` | `https://horizon-testnet.stellar.org` |
| `VITE_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |
| `VITE_NETWORK` | `TESTNET` |
| `VITE_STLR_ISSUER` | `GCTWILTRMEWG4ZNWK6GTT5XRBR7BXZZ2PSRQ5PMDKTFDTZSPKKNLBSJO` |
| `VITE_STLR_ISSUER_SECRET` | *(your issuer secret from setup)* |
| `VITE_STAKING_ACCOUNT` | `GDBLLO3W3ZSOWJP2PG6R3MLKUUXN5M6KPVOBADG5WRPIVJFLDPRFGJXF` |
| `VITE_STAKING_SECRET` | *(your staking secret from setup)* |

---

## CI/CD Pipeline

### `ci.yml` — runs on every push & PR

```
Push/PR → Install → Lint → Build (with secrets) → Upload dist artifact
```

### `deploy.yml` — runs on push to `main`

```
Push to main → Install → Build → Deploy to Vercel (production)
```

### CI/CD Badge Status

[![CI — Lint & Build](https://github.com/ANSHSINGH5999/stellar-level-4/actions/workflows/ci.yml/badge.svg)](https://github.com/ANSHSINGH5999/stellar-level-4/actions/workflows/ci.yml)
[![Deploy — Vercel](https://github.com/ANSHSINGH5999/stellar-level-4/actions/workflows/deploy.yml/badge.svg)](https://github.com/ANSHSINGH5999/stellar-level-4/actions/workflows/deploy.yml)

---

## GitHub Secrets Required

Set these in **GitHub → Repository → Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `VITE_STLR_ISSUER` | STLR issuer public key |
| `VITE_STLR_ISSUER_SECRET` | STLR issuer secret key |
| `VITE_STAKING_ACCOUNT` | Staking escrow public key |
| `VITE_STAKING_SECRET` | Staking escrow secret key |
| `VERCEL_TOKEN` | Vercel API token (from vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel org ID (from `.vercel/project.json` after `vercel link`) |
| `VERCEL_PROJECT_ID` | Vercel project ID (from `.vercel/project.json`) |
| `VITE_SENTRY_DSN` | *(optional)* Sentry DSN for error tracking |

---

## Mobile Responsive Design

Built **mobile-first** with Tailwind CSS breakpoints:

| Screen | Layout |
|--------|--------|
| `< 640px` (mobile) | Single column, stacked cards, full-width buttons |
| `640px–1024px` (tablet) | Two-column stats grid, stacked panels |
| `> 1024px` (desktop) | Side-by-side staking panel + live event feed |

**Tested on:** iPhone SE (375px), iPhone 14 Pro (393px), iPad (768px), MacBook (1440px)

> 📱 **Mobile Screenshot:** Connect on mobile → the wallet modal slides up from bottom, all buttons are touch-friendly (min 44px tap targets), and the staking panel is fully usable on a 375px screen.

---

## Wallet Support

The wallet selector supports 7 Stellar wallets in order:

| # | Wallet | Type | Direct Connect |
|---|--------|------|---------------|
| 1 | Ledger | Hardware | Via Stellar app |
| 2 | LOBSTR | Mobile | Via install |
| 3 | Albedo | Web | Via install |
| 4 | xBull | Extension | Via install |
| 5 | **Freighter** ⭐ | Extension | **Auto-detect & connect** |
| 6 | Rabet | Extension | Via install |
| 7 | Hana Wallet | Multi-chain | Via install |

Only **Freighter** has native browser extension detection and one-click connection. All others open their installation page.

---

## Security

| Concern | Implementation |
|---------|---------------|
| **Private key exposure** | `VITE_STAKING_SECRET` is a testnet key embedded at build time. On testnet this is acceptable — no real funds at risk. For mainnet, replace with a backend signing service. |
| **Cooldown enforcement** | 3-day cooldown stored on-chain in `stlr_cooldown_start` ManageData; cannot be bypassed without a new signed transaction |
| **Atomic transactions** | All multi-step operations (stake, unstake) are bundled in a single Stellar transaction — partial execution is impossible |
| **ManageData safety** | Keys are checked for existence before deletion — prevents `MANAGE_DATA_NAME_NOT_FOUND` (400) errors |
| **Extension race conditions** | Freighter `signTransaction` retries once on `message channel closed` error with 600ms backoff |
| **Sentry error tracking** | All exceptions captured with action tags for debugging |

---

## Project Structure

```
stellar-level-4/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SplashScreen.jsx    # RISEIN intro animation (colorful balls)
│   │   │   ├── WalletConnect.jsx   # 7-wallet selector modal
│   │   │   ├── TokenInfo.jsx       # Live stats (balance, stakers, APY, pool)
│   │   │   ├── StakingPanel.jsx    # Stake / unstake / claim / faucet UI
│   │   │   └── EventFeed.jsx       # Real-time SSE event feed
│   │   ├── hooks/
│   │   │   ├── useFreighter.js     # Freighter wallet connection + signing
│   │   │   ├── useStellarData.js   # Horizon polling (5s) + live reward tick
│   │   │   ├── useStellarStaking.js # Stake / unstake / claim operations
│   │   │   └── useStellarEvents.js  # 3 SSE streams + history + dedup
│   │   ├── lib/
│   │   │   └── stellar.js          # SDK setup, constants, helpers
│   │   ├── App.jsx                 # Root layout + routing logic
│   │   ├── main.jsx                # React entry + Sentry init
│   │   └── index.css               # Tailwind + B&W design tokens
│   ├── vite.config.js              # Node polyfills for stellar-sdk in browser
│   ├── tailwind.config.js
│   └── package.json
├── stellar/
│   └── setup.js                    # Testnet account creation + STLR issuance
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint + build on every push
│       └── deploy.yml              # Auto-deploy to Vercel on main
├── vercel.json                     # Vercel SPA config
├── .env.example                    # Environment variable template
└── README.md
```

---

## Commit History

This project has **9+ meaningful commits** covering the full development lifecycle:

| # | Commit | Description |
|---|--------|-------------|
| 1 | `ee3fa8f` | chore: initialize project with tooling |
| 2 | `b1cb145` | feat: implement STLR token with mint/burn |
| 3 | `25e1e59` | feat: implement staking with cooldown |
| 4 | `16895e6` | test: comprehensive test suite |
| 5 | `51cbdd5` | feat: deployment script |
| 6 | `2a6c50a` | feat: scaffold React + Vite + Tailwind frontend |
| 7 | `2271c93` | feat: hooks and real-time event streaming |
| 8 | `1abf152` | ci: GitHub Actions CI/CD + Vercel deploy |
| 9 | `d3dfb92` | docs: README documentation |
| 10 | *(new)* | feat: migrate to Stellar Network (remove EVM) |
| 11 | *(new)* | feat: Stellar staking hooks + Horizon SSE streams |
| 12 | *(new)* | fix: node polyfills + ManageData null key bug |
| 13 | *(new)* | feat: RISEIN splash screen + B&W theme |
| 14 | *(new)* | fix: real-time event dedup + auto-reconnect |
| 15 | *(new)* | chore: CI/CD + vercel.json + README rewrite |

---

## License

MIT © 2025 Stellar DeFi Platform — built by [ANSH SINGH](https://github.com/ANSHSINGH5999)
