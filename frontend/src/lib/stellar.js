import * as StellarSdk from "@stellar/stellar-sdk";

// ── Network Config ─────────────────────────────────────────────────────────
export const HORIZON_URL =
  import.meta.env.VITE_HORIZON_URL || "https://horizon-testnet.stellar.org";

export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ||
  StellarSdk.Networks.TESTNET;

export const server = new StellarSdk.Horizon.Server(HORIZON_URL, {
  allowHttp: false,
});

// ── STLR Token ─────────────────────────────────────────────────────────────
export const STLR_ISSUER = import.meta.env.VITE_STLR_ISSUER || "";

/** Always returns a proper Asset instance, throws a clear error if issuer is missing. */
export function getSTLRAsset() {
  if (!STLR_ISSUER) throw new Error("STLR issuer not configured — set VITE_STLR_ISSUER in environment variables");
  return new StellarSdk.Asset("STLR", STLR_ISSUER);
}

/** True when all required environment variables are present */
export const IS_CONFIGURED = !!(STLR_ISSUER && STAKING_ACCOUNT);

// Backwards-compat alias for code that reads STLR_ASSET directly
export const STLR_ASSET = STLR_ISSUER ? new StellarSdk.Asset("STLR", STLR_ISSUER) : null;

// ── Staking Escrow ─────────────────────────────────────────────────────────
export const STAKING_ACCOUNT = import.meta.env.VITE_STAKING_ACCOUNT || "";
export const STAKING_SECRET  = import.meta.env.VITE_STAKING_SECRET  || "";

// ── Constants ──────────────────────────────────────────────────────────────
export const APY_RATE          = 0.12;           // 12% per year
export const SECONDS_PER_YEAR  = 365 * 24 * 3600;
export const COOLDOWN_SECONDS  = 3 * 24 * 3600;  // 3 days
export const MIN_STAKE         = "1";             // 1 STLR minimum
export const BASE_FEE          = "100";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Calculate pending reward for a staked position.
 *  stakedAt can be a Unix timestamp (seconds) string or ISO date string. */
export function calcReward(stakedAmount, stakedAt) {
  if (!stakedAt || !stakedAmount) return "0";
  // Handle both Unix timestamp (digits only) and ISO strings
  const ms = /^\d+$/.test(stakedAt)
    ? parseInt(stakedAt, 10) * 1000
    : new Date(stakedAt).getTime();
  if (isNaN(ms)) return "0";
  const elapsed = (Date.now() - ms) / 1000;
  if (elapsed <= 0) return "0";
  const reward = parseFloat(stakedAmount) * APY_RATE * (elapsed / SECONDS_PER_YEAR);
  return reward.toFixed(7);
}

/** Format a Stellar amount string to 2 decimal places */
export function fmtAmount(value, decimals = 2) {
  const n = parseFloat(value || "0");
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(decimals)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/** Short-form of a Stellar public key */
export function shortKey(key) {
  if (!key || key.length < 10) return key || "";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

/** Get STLR balance from an array of account balances */
export function getSTLRBalance(balances) {
  if (!balances || !STLR_ISSUER) return "0";
  const b = balances.find(
    (b) => b.asset_code === "STLR" && b.asset_issuer === STLR_ISSUER
  );
  return b ? b.balance : "0";
}

/** Check if account has STLR trustline */
export function hasTrustline(balances) {
  if (!balances || !STLR_ISSUER) return false;
  return balances.some(
    (b) => b.asset_code === "STLR" && b.asset_issuer === STLR_ISSUER
  );
}

/** Build + sign + submit a Stellar transaction via Freighter */
export async function buildAndSign(sourcePublicKey, operations, signFn) {
  const account = await server.loadAccount(sourcePublicKey);
  let builder = new StellarSdk.TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  for (const op of operations) builder = builder.addOperation(op);
  const tx = builder.setTimeout(60).build();
  const xdr = tx.toXDR();

  // Sign via Freighter
  const signedXdr = await signFn(xdr, NETWORK_PASSPHRASE);
  if (!signedXdr) throw new Error("Transaction signing was rejected");

  const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  // Co-sign with staking account if needed (reward distribution)
  if (STAKING_SECRET) {
    const stakingKP = StellarSdk.Keypair.fromSecret(STAKING_SECRET);
    signedTx.sign(stakingKP);
  }

  const result = await server.submitTransaction(signedTx);
  return result.hash;
}

/** Parse Stellar horizon error into readable message */
export function parseHorizonError(err) {
  try {
    const extras = err?.response?.data?.extras;
    const opCodes  = extras?.result_codes?.operations;
    const txCode   = extras?.result_codes?.transaction;

    const CODE_MAP = {
      op_no_trust:              "Account has no STLR trustline — activate wallet first",
      op_low_reserve:           "Insufficient XLM reserve — add XLM to your wallet",
      op_underfunded:           "Insufficient STLR balance",
      op_no_issuer:             "STLR issuer account not found",
      op_no_destination:        "Destination account does not exist",
      op_line_full:             "Trustline balance limit reached",
      op_bad_auth:              "Transaction auth failed — wrong signer",
      MANAGE_DATA_NAME_NOT_FOUND: "ManageData key not found",
      tx_bad_seq:               "Sequence number mismatch — please retry",
      tx_insufficient_fee:      "Transaction fee too low",
      tx_no_source_account:     "Source account not found",
    };

    if (opCodes?.length) {
      const readable = opCodes.map((c) => CODE_MAP[c] || c).join("; ");
      return readable;
    }
    if (txCode) return CODE_MAP[txCode] || txCode;
  } catch {}
  // Chrome extension "listener closed" error — not a real tx failure
  if (err?.message?.includes("message channel closed")) {
    return "Freighter extension timed out — please try again";
  }
  return err?.message || "Transaction failed";
}
