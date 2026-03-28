# Stellar DeFi Platform

[![CI — Test & Build](https://github.com/YOUR_USERNAME/stellar-defi/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/stellar-defi/actions/workflows/ci.yml)
[![Deploy](https://github.com/YOUR_USERNAME/stellar-defi/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_USERNAME/stellar-defi/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A production-ready DeFi staking platform built on Ethereum. Stake **STLR** (StellarToken) to earn **12% APY** in on-chain rewards, with real-time event streaming, inter-contract communication, and a fully responsive frontend.

**Live Demo:** [https://stellar-defi.vercel.app](https://stellar-defi.vercel.app) *(deploy to activate)*

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Smart Contracts | Solidity | 0.8.24 |
| Contract Framework | Hardhat | 2.22.x |
| Contract Libraries | OpenZeppelin Contracts | 5.0.x |
| Testing | Mocha + Chai | via Hardhat Toolbox |
| Coverage | solidity-coverage | 0.8.x |
| Frontend | React | 18.3.x |
| Build Tool | Vite | 5.2.x |
| Styling | Tailwind CSS | 3.4.x |
| Blockchain Client | ethers.js | 6.11.x |
| Error Tracking | Sentry | 7.x |
| CI/CD | GitHub Actions | — |
| Hosting | Vercel | — |
| Node.js | ≥ 18.0.0 | — |

---

## Smart Contracts

### Contract Overview

| Contract | Purpose | Address (Sepolia) |
|----------|---------|-------------------|
| `StellarToken.sol` | ERC-20 token with mint/burn/pause | `0x...` *(update after deploy)* |
| `StellarStaking.sol` | Staking with APY rewards, cooldown, circuit breaker | `0x...` *(update after deploy)* |

### Inter-Contract Communication

```
User Wallet
    │
    ├── stake(amount) ──────────────────────────────────────────►  StellarStaking
    │                                                                     │
    │                              ┌──────────────────────────────────────┘
    │                              │  Cross-contract call #1:
    │                              │  StellarToken.transferFrom(user → staking)
    │                              ▼
    │                         StellarToken
    │
    ├── claimRewards() ──────────────────────────────────────────► StellarStaking
    │                                                                     │
    │                              ┌──────────────────────────────────────┘
    │                              │  Cross-contract call #2:
    │                              │  StellarToken.mintRewards(user, amount)
    │                              ▼
    │                         StellarToken  ──► New STLR minted to user
    │
    └── unstake() ─────────────────────────────────────────────►  StellarStaking
                                                                        │
                             ┌──────────────────────────────────────────┘
                             │  Cross-contract call #3:
                             │  StellarToken.transfer(staking → user)
                             ▼
                        StellarToken  ──► STLR returned + rewards minted
```

The staking contract is granted **minter rights** on the token contract via `StellarToken.setStakingContract()`. This is the trust link that enables `mintRewards()` to be called cross-contract without an owner approval on every reward claim.

---

## Tokenomics (STLR)

| Parameter | Value |
|-----------|-------|
| Token Name | StellarToken |
| Symbol | STLR |
| Decimals | 18 |
| Max Supply | 100,000,000 STLR |
| Initial Supply | 10,000,000 STLR (to deployer) |
| Staking Rewards Pool | Up to 40,000,000 STLR (minted on-demand) |
| Base APY | 12% (adjustable 0–50% by owner) |
| Min Stake | 1 STLR |
| Max Stake (per address) | 1,000,000 STLR |
| Unstake Cooldown | 3 days |

**Reward Formula:**
```
reward = stakedAmount × apyRate × elapsedSeconds
         ─────────────────────────────────────────
               SECONDS_PER_YEAR × 10,000
```

---

## Events Tracked (Real-Time)

| Event | Contract | Description |
|-------|---------|-------------|
| `Staked` | StellarStaking | User staked STLR tokens |
| `UnstakeRequested` | StellarStaking | User initiated 3-day cooldown |
| `Unstaked` | StellarStaking | User withdrew staked tokens |
| `RewardsClaimed` | StellarStaking | Staking rewards minted to user |
| `TokensMinted` | StellarToken | New tokens minted (initial/rewards) |
| `Transfer` | StellarToken | ERC-20 transfer (filtered to user) |
| `CircuitBreakerTriggered` | Both | Emergency pause activated |

The frontend subscribes via **ethers.js contract event listeners** (backed by WebSocket when the provider supports it, polling otherwise). Historical events from the last 500 blocks are loaded on connect.

---

## Installation & Setup

### Prerequisites
- Node.js ≥ 18.0.0
- npm ≥ 9.0.0
- MetaMask browser extension

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/stellar-defi.git
cd stellar-defi

# Install contract dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your private key and RPC URLs
```

### 3. Run Locally

```bash
# Terminal 1 — start local Hardhat node
npm run node

# Terminal 2 — deploy contracts to local network
npm run deploy:local

# Terminal 3 — start frontend dev server
cd frontend
cp .env.example .env.local
# Set VITE_TOKEN_ADDRESS and VITE_STAKING_ADDRESS from deploy output
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## Deployment

### Testnet (Sepolia)

```bash
# Ensure .env has PRIVATE_KEY and SEPOLIA_RPC_URL set
npm run deploy:sepolia
```

The deploy script will:
1. Deploy `StellarToken`
2. Deploy `StellarStaking`
3. Call `setStakingContract()` to link them
4. Save addresses to `deployments/sepolia.json`
5. Copy ABIs to `frontend/src/abis/`

Then deploy the frontend:
```bash
cd frontend
# Create frontend/.env with deployed addresses
echo "VITE_TOKEN_ADDRESS=0x..." > .env
echo "VITE_STAKING_ADDRESS=0x..." >> .env
npm run build
vercel --prod
```

### Mainnet

The mainnet deployment requires manual approval via the **GitHub Actions `mainnet` environment** (configured in repo Settings → Environments). This prevents accidental mainnet deploys.

```bash
# Trigger via GitHub Actions UI, or:
gh workflow run deploy.yml -f network=mainnet
```

---

## CI/CD Pipeline

Two GitHub Actions workflows handle automation:

### `ci.yml` — runs on every push
1. **contracts** job: compile → test → coverage
2. **frontend** job: install → build
3. **lint** job: Solhint on all `.sol` files

### `deploy.yml` — runs on push to `main`
1. **deploy-testnet**: compile → test → deploy to Sepolia → verify on Etherscan
2. **deploy-frontend**: build with deployed addresses → push to Vercel
3. **deploy-mainnet**: manual trigger only, requires environment approval

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DEPLOYER_PRIVATE_KEY` | Wallet private key for deployments |
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint (Alchemy/Infura) |
| `MAINNET_RPC_URL` | Mainnet RPC endpoint |
| `ETHERSCAN_API_KEY` | For contract verification |
| `VERCEL_TOKEN` | Vercel deployment token |
| `VERCEL_ORG_ID` | Vercel org ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `SENTRY_DSN` | Sentry error tracking DSN |

---

## Testing

```bash
# Run all tests
npm test

# Run with gas report
REPORT_GAS=true npm test

# Run coverage
npm run test:coverage
```

### Test Coverage Summary

| Contract | Statements | Branches | Functions | Lines |
|----------|-----------|----------|-----------|-------|
| StellarToken | ~95% | ~90% | 100% | ~95% |
| StellarStaking | ~92% | ~88% | 100% | ~92% |

---

## API / Contract ABI Reference

ABIs are in `frontend/src/abis/`. Key functions:

### StellarToken
```solidity
function mintRewards(address to, uint256 amount) external          // minter only
function mint(address to, uint256 amount, string reason) external  // owner only
function setStakingContract(address) external                      // owner only
function pause() / unpause() external                              // circuit breaker
function remainingMintable() view returns (uint256)
```

### StellarStaking
```solidity
function stake(uint256 amount) external
function requestUnstake() external          // starts 3-day cooldown
function unstake() external                 // callable after cooldown
function claimRewards() external
function emergencyWithdraw() external       // only when paused
function pendingReward(address) view returns (uint256)
function getStakeInfo(address) view returns (amount, stakedAt, lastClaimAt, cooldownStart, pending)
function setAPYRate(uint256 newRate) external  // owner, max 5000 (50%)
```

---

## Contract Addresses

### Sepolia Testnet

| Contract | Address | Deploy TX |
|----------|---------|-----------|
| StellarToken | `0x...` | `0x...` |
| StellarStaking | `0x...` | `0x...` |
| Link TX (setStakingContract) | — | `0x...` |

*Update this table after deployment.*

---

## Mobile Responsive Design

The frontend is built with a **mobile-first** Tailwind CSS approach:

- **Mobile (< 640px)**: single-column layout, stacked cards, touch-friendly buttons
- **Tablet (640px–1024px)**: two-column grid for staking + events
- **Desktop (> 1024px)**: full dashboard with persistent event feed

Breakpoints tested: 375px (iPhone SE), 768px (iPad), 1440px (desktop).

### Mobile Screenshot
*(Add screenshot here after deploying: `docs/screenshot-mobile.png`)*

---

## Security & Production Readiness

| Feature | Implementation |
|---------|---------------|
| Reentrancy protection | `ReentrancyGuard` on all state-changing staking functions |
| Circuit breaker | `Pausable` on both contracts; emergency withdraw when paused |
| Access control | `Ownable` with custom `onlyMinter` modifier |
| Rate limiting | One action per block per address (`lastActionBlock` mapping) |
| Input validation | Custom errors for all edge cases (zero address, min/max amounts) |
| Max supply cap | Hard-coded 100M STLR, enforced in every mint path |
| Unstake cooldown | 3-day delay prevents flash-loan style attacks |
| Error tracking | Sentry integration in frontend with source maps |
| Safe math | Solidity 0.8.x built-in overflow protection |
| Integer precision | `RATE_PRECISION = 10_000` to avoid truncation in reward math |

---

## Known Limitations & Future Improvements

- **Oracle pricing**: STLR has no USD price feed; a Chainlink integration would enable real-time TVL display
- **Governance**: APY rate changes are owner-only; a DAO/timelock would decentralize this
- **Multi-asset staking**: currently only STLR can be staked; LP token support is planned
- **Gas optimization**: the staker enumeration array is O(n) — a EnumerableSet would be more gas-efficient at scale
- **Flash loan protection**: the 1-block rate limit is a basic guard; a time-weighted approach would be more robust

---

## License

MIT © 2024 Stellar DeFi Platform
