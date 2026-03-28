import { useCallback } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  server, getSTLRAsset, STAKING_ACCOUNT, NETWORK_PASSPHRASE,
  BASE_FEE, parseHorizonError,
} from "../lib/stellar.js";
import * as Sentry from "@sentry/react";

/**
 * Stellar Staking Operations
 *
 * Key fix: ManageData with value=null (delete) fails with MANAGE_DATA_NAME_NOT_FOUND
 * if the key does not exist yet. We always load the account first and only include
 * delete operations for keys that are actually present in data_attr.
 */
export function useStellarStaking({ account, signTx, onRefresh }) {

  // ── Core: build, sign via Freighter, submit ─────────────────────────────
  // Returns: tx hash string on success
  //          { needsManualSign: true, xdr: string } if wallet is view-only
  const buildSign = useCallback(
    async (operations, coSigners = []) => {
      const acct = await server.loadAccount(account);
      const builder = new StellarSdk.TransactionBuilder(acct, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      for (const op of operations) builder.addOperation(op);
      const tx = builder.setTimeout(180).build();
      const xdr = tx.toXDR();

      try {
        const signed = await signTx(xdr, NETWORK_PASSPHRASE);
        if (!signed) throw new Error("Transaction was rejected");

        const signedTx = StellarSdk.TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE);
        for (const kp of coSigners) signedTx.sign(kp);

        const result = await server.submitTransaction(signedTx);
        if (onRefresh) setTimeout(onRefresh, 2000);
        return result.hash;
      } catch (err) {
        // View-only wallet: return XDR so the UI can show the manual signing flow
        if (err?.message?.startsWith("VIEW_ONLY")) {
          return { needsManualSign: true, xdr };
        }
        throw new Error(parseHorizonError(err));
      }
    },
    [account, signTx, onRefresh]
  );

  // ── Helper: load user account data_attr ────────────────────────────────
  const loadDataAttr = useCallback(async () => {
    const acct = await server.loadAccount(account);
    return acct.data_attr || {};
  }, [account]);

  // ── 1. Establish STLR Trustline ─────────────────────────────────────────
  const establishTrustline = useCallback(async () => {
    return buildSign([
      StellarSdk.Operation.changeTrust({
        asset: getSTLRAsset(),
        limit: "900000000",
      }),
    ]);
  }, [buildSign]);

  // ── 2. Request STLR from faucet (testnet only) ──────────────────────────
  const requestFaucet = useCallback(async () => {
    if (!STAKING_ACCOUNT) throw new Error("Staking account not configured");
    const secret = import.meta.env.VITE_STAKING_SECRET;
    if (!secret) throw new Error("Staking secret not configured");

    try {
      const stakingKP = StellarSdk.Keypair.fromSecret(secret);
      const stakingAcct = await server.loadAccount(STAKING_ACCOUNT);
      const tx = new StellarSdk.TransactionBuilder(stakingAcct, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: account,
            asset: getSTLRAsset(),
            amount: "10000",
          })
        )
        .setTimeout(180)
        .build();
      tx.sign(stakingKP);
      const result = await server.submitTransaction(tx);
      if (onRefresh) setTimeout(onRefresh, 2000);
      return result.hash;
    } catch (err) {
      throw new Error(parseHorizonError(err));
    }
  }, [account, onRefresh]);

  // ── 3. Stake STLR ────────────────────────────────────────────────────────
  const stake = useCallback(
    async (amount) => {
      if (!STAKING_ACCOUNT) throw new Error("Staking account not configured");
      const stlrAsset = getSTLRAsset();

      const now = Math.floor(Date.now() / 1000).toString();

      // Check which ManageData keys already exist so we only delete existing ones
      const data = await loadDataAttr();
      const hasCooldown = !!data["stlr_cooldown_start"];

      const ops = [
        // Send STLR to staking escrow
        StellarSdk.Operation.payment({
          destination: STAKING_ACCOUNT,
          asset: stlrAsset,
          amount: amount.toString(),
        }),
        // Record stake metadata
        StellarSdk.Operation.manageData({
          name: "stlr_staked_amount",
          value: amount.toString(),
        }),
        StellarSdk.Operation.manageData({
          name: "stlr_staked_at",
          value: now,
        }),
      ];

      // Only clear cooldown if the key actually exists
      if (hasCooldown) {
        ops.push(
          StellarSdk.Operation.manageData({
            name: "stlr_cooldown_start",
            value: null,
          })
        );
      }

      return buildSign(ops);
    },
    [buildSign, loadDataAttr]
  );

  // ── 4. Request Unstake (start cooldown) ──────────────────────────────────
  const requestUnstake = useCallback(async () => {
    const now = Math.floor(Date.now() / 1000).toString();
    return buildSign([
      StellarSdk.Operation.manageData({
        name: "stlr_cooldown_start",
        value: now,
      }),
    ]);
  }, [buildSign]);

  // ── 5. Unstake (after cooldown) ──────────────────────────────────────────
  const unstake = useCallback(
    async (stakedAmount, pendingReward) => {
      if (!STAKING_ACCOUNT) throw new Error("Staking account not configured");
      const secret = import.meta.env.VITE_STAKING_SECRET;
      if (!secret) throw new Error("Staking secret not configured");

      try {
        const stakingKP = StellarSdk.Keypair.fromSecret(secret);

        const stlrAsset = getSTLRAsset();

        // Send tokens back from staking escrow
        const stakingAcct = await server.loadAccount(STAKING_ACCOUNT);
        const payOps = [
          StellarSdk.Operation.payment({
            destination: account,
            asset: stlrAsset,
            amount: parseFloat(stakedAmount).toFixed(7),
            source: STAKING_ACCOUNT,
          }),
        ];

        const rewardNum = parseFloat(pendingReward || "0");
        if (rewardNum >= 0.0000001) {
          payOps.push(
            StellarSdk.Operation.payment({
              destination: account,
              asset: stlrAsset,
              amount: Math.min(rewardNum, 999999).toFixed(7),
              source: STAKING_ACCOUNT,
            })
          );
        }

        const payTx = new StellarSdk.TransactionBuilder(stakingAcct, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        });
        for (const op of payOps) payTx.addOperation(op);
        const builtPayTx = payTx.setTimeout(180).build();
        builtPayTx.sign(stakingKP);
        await server.submitTransaction(builtPayTx);

        // Clear staking metadata from user account (only keys that exist)
        const data = await loadDataAttr();
        const clearOps = [];
        if (data["stlr_staked_amount"]) clearOps.push(StellarSdk.Operation.manageData({ name: "stlr_staked_amount", value: null }));
        if (data["stlr_staked_at"])     clearOps.push(StellarSdk.Operation.manageData({ name: "stlr_staked_at",     value: null }));
        if (data["stlr_cooldown_start"]) clearOps.push(StellarSdk.Operation.manageData({ name: "stlr_cooldown_start", value: null }));

        if (clearOps.length === 0) return builtPayTx.hash;

        const hash = await buildSign(clearOps);
        if (onRefresh) setTimeout(onRefresh, 2000);
        return hash;
      } catch (err) {
        throw new Error(parseHorizonError(err));
      }
    },
    [account, buildSign, loadDataAttr, onRefresh]
  );

  // ── 6. Claim Rewards only ────────────────────────────────────────────────
  const claimRewards = useCallback(
    async (pendingReward) => {
      if (!STAKING_ACCOUNT) throw new Error("Staking account not configured");
      const rewardNum = parseFloat(pendingReward || "0");
      if (rewardNum < 0.0000001) throw new Error("No rewards to claim yet");
      const secret = import.meta.env.VITE_STAKING_SECRET;
      if (!secret) throw new Error("Staking secret not configured");

      try {
        const stakingKP = StellarSdk.Keypair.fromSecret(secret);
        const rewardStr = Math.min(rewardNum, 999999).toFixed(7);
        const stakingAcct = await server.loadAccount(STAKING_ACCOUNT);
        const tx = new StellarSdk.TransactionBuilder(stakingAcct, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            StellarSdk.Operation.payment({
              destination: account,
              asset: getSTLRAsset(),
              amount: rewardStr,
            })
          )
          .setTimeout(180)
          .build();

        tx.sign(stakingKP);
        const result = await server.submitTransaction(tx);

        // Reset staked_at only if the key exists
        const data = await loadDataAttr();
        if (data["stlr_staked_at"]) {
          await buildSign([
            StellarSdk.Operation.manageData({
              name: "stlr_staked_at",
              value: Math.floor(Date.now() / 1000).toString(),
            }),
          ]);
        }

        if (onRefresh) setTimeout(onRefresh, 2000);
        return result.hash;
      } catch (err) {
        throw new Error(parseHorizonError(err));
      }
    },
    [account, buildSign, loadDataAttr, onRefresh]
  );

  return {
    establishTrustline,
    requestFaucet,
    stake,
    requestUnstake,
    unstake,
    claimRewards,
  };
}
