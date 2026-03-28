import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import * as Sentry from "@sentry/react";

const MAX_EVENTS = 50;

/**
 * Subscribes to on-chain events from both StellarToken and StellarStaking.
 * Uses ethers v6 contract event listeners (backed by WebSocket or polling).
 *
 * Tracked events:
 *   1. Transfer        (token)
 *   2. TokensMinted    (token)
 *   3. Staked          (staking)
 *   4. UnstakeRequested(staking)
 *   5. Unstaked        (staking)
 *   6. RewardsClaimed  (staking)
 *   7. CircuitBreakerTriggered (both)
 */
export function useEvents({ tokenContract, stakingContract, account }) {
  const [events, setEvents] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const listenersRef = useRef([]);

  const addEvent = useCallback((type, data, txHash) => {
    setEvents((prev) => [
      {
        id: `${txHash}-${type}-${Date.now()}`,
        type,
        data,
        txHash,
        timestamp: new Date().toISOString(),
      },
      ...prev.slice(0, MAX_EVENTS - 1),
    ]);
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  // Load historical events (last ~100 blocks)
  const loadHistory = useCallback(async () => {
    if (!tokenContract || !stakingContract) return;

    try {
      const provider = tokenContract.runner.provider;
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 500);

      const [mints, stakes, unstakes, claims] = await Promise.allSettled([
        tokenContract.queryFilter(tokenContract.filters.TokensMinted(), fromBlock),
        stakingContract.queryFilter(stakingContract.filters.Staked(), fromBlock),
        stakingContract.queryFilter(stakingContract.filters.Unstaked(), fromBlock),
        stakingContract.queryFilter(stakingContract.filters.RewardsClaimed(), fromBlock),
      ]);

      const historical = [];

      if (mints.status === "fulfilled") {
        for (const e of mints.value) {
          historical.push({
            id: `${e.transactionHash}-mint`,
            type: "TokensMinted",
            data: { to: e.args[0], amount: ethers.formatEther(e.args[1]), reason: e.args[2] },
            txHash: e.transactionHash,
            timestamp: new Date().toISOString(),
            historical: true,
          });
        }
      }
      if (stakes.status === "fulfilled") {
        for (const e of stakes.value) {
          historical.push({
            id: `${e.transactionHash}-stake`,
            type: "Staked",
            data: { user: e.args[0], amount: ethers.formatEther(e.args[1]) },
            txHash: e.transactionHash,
            timestamp: new Date().toISOString(),
            historical: true,
          });
        }
      }
      if (unstakes.status === "fulfilled") {
        for (const e of unstakes.value) {
          historical.push({
            id: `${e.transactionHash}-unstake`,
            type: "Unstaked",
            data: { user: e.args[0], amount: ethers.formatEther(e.args[1]) },
            txHash: e.transactionHash,
            timestamp: new Date().toISOString(),
            historical: true,
          });
        }
      }
      if (claims.status === "fulfilled") {
        for (const e of claims.value) {
          historical.push({
            id: `${e.transactionHash}-claim`,
            type: "RewardsClaimed",
            data: { user: e.args[0], amount: ethers.formatEther(e.args[1]) },
            txHash: e.transactionHash,
            timestamp: new Date().toISOString(),
            historical: true,
          });
        }
      }

      // Sort newest first
      historical.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setEvents(historical.slice(0, MAX_EVENTS));
    } catch (err) {
      Sentry.captureException(err, { tags: { source: "event_history" } });
    }
  }, [tokenContract, stakingContract]);

  // Set up live listeners
  useEffect(() => {
    if (!tokenContract || !stakingContract) {
      setIsListening(false);
      return;
    }

    // Clean up previous listeners
    for (const { contract, event, handler } of listenersRef.current) {
      try { contract.off(event, handler); } catch {}
    }
    listenersRef.current = [];

    const on = (contract, event, handler) => {
      contract.on(event, handler);
      listenersRef.current.push({ contract, event, handler });
    };

    // Token events
    on(tokenContract, "TokensMinted", (to, amount, reason, evt) => {
      addEvent("TokensMinted", {
        to,
        amount: ethers.formatEther(amount),
        reason,
      }, evt.log.transactionHash);
    });

    on(tokenContract, "Transfer", (from, to, value, evt) => {
      if (
        from === ethers.ZeroAddress ||
        from.toLowerCase() === account?.toLowerCase() ||
        to.toLowerCase() === account?.toLowerCase()
      ) {
        addEvent("Transfer", {
          from,
          to,
          amount: ethers.formatEther(value),
        }, evt.log.transactionHash);
      }
    });

    // Staking events
    on(stakingContract, "Staked", (user, amount, timestamp, evt) => {
      addEvent("Staked", {
        user,
        amount: ethers.formatEther(amount),
        timestamp: new Date(Number(timestamp) * 1000).toLocaleString(),
      }, evt.log.transactionHash);
    });

    on(stakingContract, "UnstakeRequested", (user, amount, cooldownEnd, evt) => {
      addEvent("UnstakeRequested", {
        user,
        amount: ethers.formatEther(amount),
        cooldownEnd: new Date(Number(cooldownEnd) * 1000).toLocaleString(),
      }, evt.log.transactionHash);
    });

    on(stakingContract, "Unstaked", (user, amount, timestamp, evt) => {
      addEvent("Unstaked", {
        user,
        amount: ethers.formatEther(amount),
        timestamp: new Date(Number(timestamp) * 1000).toLocaleString(),
      }, evt.log.transactionHash);
    });

    on(stakingContract, "RewardsClaimed", (user, rewardAmount, timestamp, evt) => {
      addEvent("RewardsClaimed", {
        user,
        amount: ethers.formatEther(rewardAmount),
        timestamp: new Date(Number(timestamp) * 1000).toLocaleString(),
      }, evt.log.transactionHash);
    });

    on(stakingContract, "CircuitBreakerTriggered", (triggeredBy, evt) => {
      addEvent("CircuitBreakerTriggered", { triggeredBy }, evt.log.transactionHash);
    });

    setIsListening(true);
    loadHistory();

    return () => {
      for (const { contract, event, handler } of listenersRef.current) {
        try { contract.off(event, handler); } catch {}
      }
      listenersRef.current = [];
      setIsListening(false);
    };
  }, [tokenContract, stakingContract, account, addEvent, loadHistory]);

  return { events, isListening, clearEvents };
}
