import { useState, useEffect, useCallback, useRef } from "react";
import { server, STLR_ISSUER, STAKING_ACCOUNT, shortKey } from "../lib/stellar.js";
import * as Sentry from "@sentry/react";

const MAX_EVENTS = 80;

/**
 * Real-time Stellar event streaming via Horizon SSE.
 *
 * Stream layout (3 streams, no duplicate events):
 *   Stream A — staking account payments  → Staked
 *   Stream B — user account operations   → TrustlineSet, UnstakeRequested,
 *                                           Unstaked, RewardsClaimed  (from ManageData ops)
 *   Stream C — user account payments     → AccountFunded (native XLM only)
 *
 * Deduplication: every event is keyed by `${txHash}-${type}` in a Set.
 * Auto-reconnect: each stream retries with exponential backoff on error/close.
 */
export function useStellarEvents(account) {
  const [events, setEvents]       = useState([]);
  const [isListening, setListening] = useState(false);

  // Seen-set prevents the same tx+type from appearing twice across streams
  const seenRef    = useRef(new Set());
  // Holds { close } handles for all open streams
  const streamsRef = useRef([]);

  /* ── add a single event (deduplicated) ─────────────────────────────────── */
  const addEvent = useCallback((type, data, txHash, historical = false) => {
    const key = `${txHash || Date.now()}-${type}`;
    if (txHash && seenRef.current.has(key)) return;
    if (txHash) seenRef.current.add(key);

    setEvents((prev) => [
      {
        id: `${key}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        data: data || {},
        txHash: txHash || "",
        timestamp: new Date().toISOString(),
        historical,
      },
      ...prev.slice(0, MAX_EVENTS - 1),
    ]);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    seenRef.current.clear();
  }, []);

  /* ── auto-reconnecting stream helper ───────────────────────────────────── */
  const openStream = useCallback((buildCall, onMessage, label) => {
    let active = true;
    let retryMs = 3_000;
    let closeHandle;

    const connect = () => {
      if (!active) return;
      try {
        closeHandle = buildCall().cursor("now").stream({
          onmessage: (record) => {
            retryMs = 3_000; // reset backoff on success
            onMessage(record);
          },
          onerror: () => {
            try { closeHandle?.(); } catch {}
            if (active) {
              setTimeout(connect, retryMs);
              retryMs = Math.min(retryMs * 2, 30_000);
            }
          },
        });
      } catch {
        if (active) setTimeout(connect, retryMs);
      }
    };

    connect();
    return () => {
      active = false;
      try { closeHandle?.(); } catch {}
    };
  }, []);

  /* ── load recent history on connect ─────────────────────────────────────── */
  const loadHistory = useCallback(async () => {
    if (!account) return;

    // A: Last 30 staking-account payments → Staked events
    try {
      const payments = await server
        .payments()
        .forAccount(STAKING_ACCOUNT)
        .limit(30)
        .order("desc")
        .call();

      for (const p of payments.records) {
        if (p.type !== "payment") continue;
        if (p.asset_code !== "STLR" || p.asset_issuer !== STLR_ISSUER) continue;
        if (p.to !== STAKING_ACCOUNT) continue; // only "Staked" from history
        addEvent(
          "Staked",
          { user: shortKey(p.from), amount: p.amount },
          p.transaction_hash,
          true,
        );
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { source: "history_staking" } });
    }

    // B: Last 30 user-account operations → TrustlineSet, UnstakeRequested, Unstaked, RewardsClaimed
    try {
      const ops = await server
        .operations()
        .forAccount(account)
        .limit(30)
        .order("desc")
        .call();

      for (const op of ops.records) {
        if (op.type === "change_trust" && op.asset_code === "STLR") {
          addEvent("TrustlineSet", { user: shortKey(op.account), asset: "STLR" }, op.transaction_hash, true);
        }
        if (op.type === "manage_data" && op.name?.startsWith("stlr_")) {
          if (op.name === "stlr_cooldown_start" && op.value) {
            addEvent("UnstakeRequested", { user: shortKey(op.account) }, op.transaction_hash, true);
          }
          if (op.name === "stlr_staked_amount" && !op.value) {
            addEvent("Unstaked", { user: shortKey(op.account) }, op.transaction_hash, true);
          }
          if (op.name === "stlr_staked_at" && op.value) {
            addEvent("RewardsClaimed", { user: shortKey(op.account) }, op.transaction_hash, true);
          }
        }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { source: "history_ops" } });
    }

    // C: Last 20 user-account payments → AccountFunded (XLM)
    try {
      const payments = await server
        .payments()
        .forAccount(account)
        .limit(20)
        .order("desc")
        .call();

      for (const p of payments.records) {
        if (p.type === "payment" && p.asset_type === "native") {
          addEvent(
            "AccountFunded",
            { from: shortKey(p.from), amount: p.amount, asset: "XLM" },
            p.transaction_hash,
            true,
          );
        }
      }
    } catch { /* non-critical */ }
  }, [account, addEvent]);

  /* ── subscribe to live streams ───────────────────────────────────────────── */
  useEffect(() => {
    if (!account) {
      setListening(false);
      return;
    }

    // tear down previous streams
    streamsRef.current.forEach((stop) => stop());
    streamsRef.current = [];
    seenRef.current.clear();
    setEvents([]);

    loadHistory();

    /* Stream A — staking account payments → only "Staked" (TO staking) */
    if (STAKING_ACCOUNT) {
      const stopA = openStream(
        () => server.payments().forAccount(STAKING_ACCOUNT),
        (p) => {
          if (
            p.type !== "payment" ||
            p.asset_code !== "STLR" ||
            p.asset_issuer !== STLR_ISSUER
          ) return;

          if (p.to === STAKING_ACCOUNT) {
            addEvent(
              "Staked",
              { user: shortKey(p.from), amount: p.amount },
              p.transaction_hash,
            );
          }
          // Payments FROM staking → detected via ops stream (Stream B) for accuracy
        },
        "staking-payments",
      );
      streamsRef.current.push(stopA);
    }

    /* Stream B — user account operations → TrustlineSet, UnstakeRequested,
                                             Unstaked, RewardsClaimed            */
    const stopB = openStream(
      () => server.operations().forAccount(account),
      (op) => {
        if (op.type === "change_trust" && op.asset_code === "STLR") {
          addEvent(
            "TrustlineSet",
            { user: shortKey(op.account || account), asset: "STLR" },
            op.transaction_hash,
          );
        }

        if (op.type === "manage_data" && op.name?.startsWith("stlr_")) {
          switch (op.name) {
            case "stlr_cooldown_start":
              if (op.value) {
                // value set = cooldown started
                addEvent(
                  "UnstakeRequested",
                  { user: shortKey(op.account || account) },
                  op.transaction_hash,
                );
              }
              break;

            case "stlr_staked_amount":
              if (!op.value) {
                // key deleted = unstake completed
                addEvent(
                  "Unstaked",
                  { user: shortKey(op.account || account) },
                  op.transaction_hash,
                );
              }
              break;

            case "stlr_staked_at":
              if (op.value) {
                // timestamp updated = rewards claimed / re-staked timer reset
                addEvent(
                  "RewardsClaimed",
                  { user: shortKey(op.account || account) },
                  op.transaction_hash,
                );
              }
              break;
          }
        }
      },
      "user-ops",
    );
    streamsRef.current.push(stopB);

    /* Stream C — user account payments → AccountFunded (native XLM only) */
    const stopC = openStream(
      () => server.payments().forAccount(account),
      (p) => {
        if (p.type === "payment" && p.asset_type === "native") {
          addEvent(
            "AccountFunded",
            { from: shortKey(p.from), amount: p.amount, asset: "XLM" },
            p.transaction_hash,
          );
        }
      },
      "user-payments",
    );
    streamsRef.current.push(stopC);

    setListening(true);

    return () => {
      streamsRef.current.forEach((stop) => stop());
      streamsRef.current = [];
      setListening(false);
    };
  }, [account, addEvent, loadHistory, openStream]);

  return { events, isListening, clearEvents };
}
