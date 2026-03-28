import { useState, useEffect, useCallback, useRef } from "react";
import {
  server, STLR_ISSUER, STAKING_ACCOUNT,
  getSTLRBalance, hasTrustline, calcReward, APY_RATE,
} from "../lib/stellar.js";
import * as Sentry from "@sentry/react";

const POLL_MS    = 5_000;   // poll every 5 s for snappy updates
const REWARD_MS  = 1_000;   // live reward ticker every 1 s

export function useStellarData(account) {
  const [stlrBalance,   setStlrBalance]   = useState("0");
  const [xlmBalance,    setXlmBalance]    = useState("0");
  const [stakedAmount,  setStakedAmount]  = useState("0");
  const [stakedAt,      setStakedAt]      = useState(null);
  const [pendingReward, setPendingReward] = useState("0");
  const [cooldownEnd,   setCooldownEnd]   = useState(null);
  const [totalStaked,   setTotalStaked]   = useState("0");
  const [rewardPool,    setRewardPool]    = useState("0");
  const [totalStakers,  setTotalStakers]  = useState(0);
  const [hasTrust,      setHasTrust]      = useState(false);
  const [apyRate,       setApyRate]       = useState(APY_RATE); // real value from chain
  const [isLoading,     setIsLoading]     = useState(false);

  // prevent concurrent fetches
  const fetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!account || fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);

    try {
      /* ── User account ─────────────────────────────────────────────── */
      const acct = await server.loadAccount(account).catch(() => null);
      if (!acct) return;

      const stlr = getSTLRBalance(acct.balances);
      const xlm  = acct.balances.find((b) => b.asset_type === "native")?.balance || "0";
      setStlrBalance(stlr);
      setXlmBalance(xlm);
      setHasTrust(hasTrustline(acct.balances));

      /* ── Staking metadata from ManageData ─────────────────────────── */
      const data  = acct.data_attr || {};

      // stlr_staked_amount — plain number string, base64-encoded
      const rawAmt = data["stlr_staked_amount"] ? atob(data["stlr_staked_amount"]) : null;
      // stlr_staked_at — Unix timestamp (seconds) string, base64-encoded
      const rawAt  = data["stlr_staked_at"]     ? atob(data["stlr_staked_at"])     : null;
      // stlr_cooldown_start — Unix timestamp (seconds) string, base64-encoded
      const rawCd  = data["stlr_cooldown_start"] ? atob(data["stlr_cooldown_start"]) : null;

      setStakedAmount(rawAmt || "0");
      setStakedAt(rawAt || null);

      // Cooldown: stored as Unix seconds → add 3 days → convert to Date
      if (rawCd) {
        const cdMs = parseInt(rawCd, 10) * 1_000 + 3 * 24 * 3_600_000;
        setCooldownEnd(new Date(cdMs));
      } else {
        setCooldownEnd(null);
      }

      // Pending reward (snapshot — live ticker updates every second separately)
      setPendingReward(calcReward(rawAmt || "0", rawAt));

      /* ── On-chain APY from issuer ManageData ─────────────────────── */
      if (STLR_ISSUER) {
        try {
          const issuerAcct = await server.loadAccount(STLR_ISSUER).catch(() => null);
          if (issuerAcct?.data_attr?.["stlr_apy_rate"]) {
            // stored as basis points string e.g. "1200" = 12.00%
            const bps = parseInt(atob(issuerAcct.data_attr["stlr_apy_rate"]), 10);
            if (!isNaN(bps) && bps > 0) setApyRate(bps / 10000);
          }
        } catch { /* fallback to APY_RATE constant */ }
      }

      /* ── Staking escrow account ───────────────────────────────────── */
      if (STAKING_ACCOUNT) {
        const stakingAcct = await server.loadAccount(STAKING_ACCOUNT).catch(() => null);
        if (stakingAcct) {
          setRewardPool(getSTLRBalance(stakingAcct.balances));
        }

        // Count unique stakers and total volume from recent payments
        const payments = await server
          .payments()
          .forAccount(STAKING_ACCOUNT)
          .limit(200)
          .call()
          .catch(() => ({ records: [] }));

        const stakers = new Set();
        let total = 0;
        for (const p of payments.records) {
          if (
            p.type === "payment" &&
            p.asset_code === "STLR" &&
            p.asset_issuer === STLR_ISSUER &&
            p.to === STAKING_ACCOUNT
          ) {
            stakers.add(p.from);
            total += parseFloat(p.amount || "0");
          }
        }
        setTotalStakers(stakers.size);
        setTotalStaked(total.toFixed(7));
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { source: "stellar_data" } });
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [account]);

  /* ── Poll every POLL_MS ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!account) return;
    fetchData();
    const id = setInterval(fetchData, POLL_MS);
    return () => clearInterval(id);
  }, [fetchData, account]);

  /* ── Refresh immediately when tab comes back to foreground ───────────── */
  useEffect(() => {
    if (!account) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [account, fetchData]);

  /* ── Live reward ticker (updates every second) ───────────────────────── */
  useEffect(() => {
    if (!stakedAt || parseFloat(stakedAmount) <= 0) {
      setPendingReward("0");
      return;
    }
    // Set immediately so there's no 1-second gap on mount
    setPendingReward(calcReward(stakedAmount, stakedAt));
    const id = setInterval(() => {
      setPendingReward(calcReward(stakedAmount, stakedAt));
    }, REWARD_MS);
    return () => clearInterval(id);
  }, [stakedAmount, stakedAt]);

  return {
    stlrBalance,
    xlmBalance,
    stakedAmount,
    stakedAt,
    pendingReward,
    cooldownEnd,
    totalStaked,
    rewardPool,
    totalStakers,
    hasTrust,
    apyRate,
    isLoading,
    refresh: fetchData,
  };
}
