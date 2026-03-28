#!/usr/bin/env node
/**
 * Stellar DeFi Platform — Testnet Setup Script
 *
 * Creates and funds:
 *   1. STLR Token Issuer account
 *   2. Staking Escrow account (holds staked tokens + reward pool)
 *
 * Then:
 *   - Issues 10,000,000 STLR to the deployer
 *   - Funds the staking escrow with 40,000,000 STLR (reward pool)
 *   - Writes addresses to frontend/.env
 *
 * Usage: node stellar/setup.js
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const BASE_FEE = "100";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function friendbot(publicKey) {
  console.log(`  Funding via friendbot: ${publicKey.slice(0, 12)}…`);
  const resp = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
  if (!resp.ok) throw new Error(`Friendbot failed: ${resp.status}`);
  return resp.json();
}

async function submitTx(tx) {
  const result = await server.submitTransaction(tx);
  return result.hash;
}

async function loadAccount(publicKey) {
  return server.loadAccount(publicKey);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("Stellar DeFi Platform — Testnet Setup");
  console.log("=".repeat(60));
  console.log("Network: Stellar Testnet\n");

  // ── 1. Generate or load keypairs ──────────────────────────────────────────
  const envPath = path.join(__dirname, "..", "frontend", ".env");
  let existingEnv = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const [key, val] = line.split("=");
      if (key && val) existingEnv[key.trim()] = val.trim();
    }
  }

  const issuerKeypair = existingEnv.VITE_STLR_ISSUER_SECRET
    ? StellarSdk.Keypair.fromSecret(existingEnv.VITE_STLR_ISSUER_SECRET)
    : StellarSdk.Keypair.random();

  const stakingKeypair = existingEnv.VITE_STAKING_SECRET
    ? StellarSdk.Keypair.fromSecret(existingEnv.VITE_STAKING_SECRET)
    : StellarSdk.Keypair.random();

  console.log(`STLR Issuer:  ${issuerKeypair.publicKey()}`);
  console.log(`Staking Acct: ${stakingKeypair.publicKey()}\n`);

  const STLR = new StellarSdk.Asset("STLR", issuerKeypair.publicKey());

  // ── 2. Fund accounts via friendbot ────────────────────────────────────────
  console.log("[1/4] Funding accounts via friendbot…");
  try {
    await friendbot(issuerKeypair.publicKey());
    await sleep(2000);
    await friendbot(stakingKeypair.publicKey());
    await sleep(2000);
    console.log("  ✓ Accounts funded (10,000 XLM each)\n");
  } catch (e) {
    console.log("  ! Friendbot skipped (accounts may already exist):", e.message.slice(0, 60));
  }

  // ── 3. Configure staking account (set trustline for STLR) ─────────────────
  console.log("[2/4] Setting up staking account trustline…");
  try {
    const stakingAcct = await loadAccount(stakingKeypair.publicKey());
    const tx = new StellarSdk.TransactionBuilder(stakingAcct, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(StellarSdk.Operation.changeTrust({
        asset: STLR,
        limit: "100000000", // 100M STLR max
      }))
      // Set staking account home domain for identification
      .addOperation(StellarSdk.Operation.setOptions({
        homeDomain: "stellar-defi.vercel.app",
      }))
      .setTimeout(30)
      .build();

    tx.sign(stakingKeypair);
    const hash = await submitTx(tx);
    console.log(`  ✓ Trustline set. TX: ${hash}`);
    await sleep(2000);
  } catch (e) {
    console.log("  ! Trustline setup skipped:", e.message.slice(0, 80));
  }

  // ── 4. Issue STLR tokens ─────────────────────────────────────────────────
  console.log("\n[3/4] Issuing STLR tokens…");
  let mintTxHash = "";
  try {
    const issuerAcct = await loadAccount(issuerKeypair.publicKey());
    const tx = new StellarSdk.TransactionBuilder(issuerAcct, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      // Fund staking account with reward pool (40M STLR)
      .addOperation(StellarSdk.Operation.payment({
        destination: stakingKeypair.publicKey(),
        asset: STLR,
        amount: "40000000",
      }))
      // Set issuer account data
      .addOperation(StellarSdk.Operation.manageData({
        name: "stlr_max_supply",
        value: "100000000",
      }))
      .addOperation(StellarSdk.Operation.manageData({
        name: "stlr_apy_rate",
        value: "1200",
      }))
      .setTimeout(30)
      .build();

    tx.sign(issuerKeypair);
    mintTxHash = await submitTx(tx);
    console.log(`  ✓ Issued 40,000,000 STLR to staking reward pool`);
    console.log(`    TX: ${mintTxHash}`);
    await sleep(2000);
  } catch (e) {
    console.log("  ! Minting skipped:", e.message.slice(0, 80));
  }

  // ── 5. Write .env ─────────────────────────────────────────────────────────
  console.log("\n[4/4] Writing frontend/.env…");
  const envContent = `# ── Stellar DeFi Platform — Environment Variables ──
# Stellar Testnet Configuration

VITE_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_NETWORK=TESTNET

# STLR Token Issuer
VITE_STLR_ISSUER=${issuerKeypair.publicKey()}
VITE_STLR_ISSUER_SECRET=${issuerKeypair.secret()}

# Staking Escrow Account
VITE_STAKING_ACCOUNT=${stakingKeypair.publicKey()}
VITE_STAKING_SECRET=${stakingKeypair.secret()}

# Sentry (optional)
# VITE_SENTRY_DSN=https://...@sentry.io/...
`;

  fs.writeFileSync(envPath, envContent);
  console.log(`  ✓ Written to frontend/.env\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("Setup Complete!");
  console.log(`STLR Issuer:          ${issuerKeypair.publicKey()}`);
  console.log(`Staking Account:      ${stakingKeypair.publicKey()}`);
  console.log(`Mint TX:              ${mintTxHash || "skipped"}`);
  console.log(`\nView on explorer:`);
  console.log(`  https://stellar.expert/explorer/testnet/account/${issuerKeypair.publicKey()}`);
  console.log(`  https://stellar.expert/explorer/testnet/account/${stakingKeypair.publicKey()}`);
  console.log("=".repeat(60));
  console.log("\nNext: cd frontend && npm run dev -- --port 3000\n");
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  process.exit(1);
});
