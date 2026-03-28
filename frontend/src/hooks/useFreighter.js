import { useState, useCallback, useEffect } from "react";
import {
  requestAccess,
  getAddress,
  getNetwork,
  isAllowed,
  isConnected,
  signTransaction,
} from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";
import * as Sentry from "@sentry/react";

export const STELLAR_NETWORKS = {
  PUBLIC:    { name: "Stellar Mainnet", passphrase: "Public Global Stellar Network ; September 2015" },
  TESTNET:   { name: "Stellar Testnet", passphrase: "Test SDF Network ; September 2015" },
  FUTURENET: { name: "Stellar Futurenet", passphrase: "Test SDF Future Network ; October 2022" },
};

const MANUAL_KEY  = "stellar_manual_address";
const WALLET_TYPE = "stellar_wallet_type"; // 'freighter' | 'manual'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Wrap any promise with a hard timeout
const withTimeout = (promise, ms, msg = "Freighter timed out — reopen the extension and try again.") =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);

// Poll until check() returns true or timeout expires
const waitFor = (check, timeout = 8000) =>
  new Promise((resolve) => {
    if (check()) { resolve(true); return; }
    const start = Date.now();
    const poll = () => {
      if (check()) { resolve(true); return; }
      if (Date.now() - start > timeout) { resolve(false); return; }
      setTimeout(poll, 300);
    };
    poll();
  });

// Freighter injects window.freighter; use isConnected() (has built-in 2s timeout) to verify
const hasFreighterObj = () => typeof window !== "undefined" && !!window.freighter;

// Verify the extension is actually responding (not just injected)
async function freighterResponds() {
  try {
    const res = await withTimeout(isConnected(), 3000, "timeout");
    return !!res?.isConnected;
  } catch {
    return false;
  }
}

export function isValidStellarAddress(addr) {
  try { return StellarSdk.StrKey.isValidEd25519PublicKey(addr?.trim()); }
  catch { return false; }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useFreighter() {
  const [account, setAccount]       = useState(() => localStorage.getItem(MANUAL_KEY) || null);
  const [network, setNetwork]       = useState("TESTNET");
  const [walletType, setWalletType] = useState(() => localStorage.getItem(WALLET_TYPE) || null);
  const [isViewOnly, setIsViewOnly] = useState(() => localStorage.getItem(WALLET_TYPE) === "manual");
  const [isFreighterInstalled, setFreighterInstalled] = useState(() => hasFreighterObj());
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError]               = useState(null);

  // ── Auto-detect + auto-reconnect on mount ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Wait up to 3s for window.freighter to be injected by extension
      const found = await waitFor(hasFreighterObj, 3000);
      if (found && !cancelled) setFreighterInstalled(true);
      if (cancelled) return;

      if (!found) return;

      // Verify extension is actually responding
      const responding = await freighterResponds();
      if (!responding || cancelled) return;

      const savedType = localStorage.getItem(WALLET_TYPE);

      try {
        const allowedRes = await withTimeout(isAllowed(), 5000);
        const alreadyAllowed = allowedRes?.isAllowed ?? false;

        let addr = "";
        let net  = "TESTNET";

        if (alreadyAllowed) {
          const addrRes = await withTimeout(getAddress(), 5000);
          addr = addrRes?.address || "";
          const netRes = await withTimeout(getNetwork(), 5000);
          net = netRes?.network || "TESTNET";
        } else if (!savedType || savedType === "freighter") {
          // Inside Freighter browser — auto-request
          const result = await withTimeout(requestAccess(), 30000, "Freighter did not respond. Please approve in the extension.");
          if (result?.error) return;
          addr = result?.address || "";
          const netRes = await withTimeout(getNetwork(), 5000);
          net = netRes?.network || "TESTNET";
        }

        if (!cancelled && addr && isValidStellarAddress(addr)) {
          localStorage.setItem(WALLET_TYPE, "freighter");
          localStorage.removeItem(MANUAL_KEY);
          setAccount(addr); setNetwork(net);
          setWalletType("freighter"); setIsViewOnly(false);
        }
      } catch {
        // Silently fail on auto-reconnect — user can manually connect
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Freighter connect ─────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setIsConnecting(true); setError(null);
    try {
      // Step 1: wait for window.freighter injection
      const found = await waitFor(hasFreighterObj, 8000);
      if (!found) {
        setError("Freighter not found. Install the extension or open this app inside Freighter's browser tab.");
        return false;
      }
      setFreighterInstalled(true);

      // Step 2: verify it's actually responding (catches sleeping MV3 service worker)
      const responding = await freighterResponds();
      if (!responding) {
        setError("Freighter is not responding. Force-close the extension, reopen it, then try again.");
        return false;
      }

      // Step 3: check if already allowed
      const allowedRes = await withTimeout(isAllowed(), 5000);
      const alreadyAllowed = allowedRes?.isAllowed ?? false;

      let addr = "";
      let net  = "TESTNET";

      if (alreadyAllowed) {
        const addrRes = await withTimeout(getAddress(), 5000);
        addr = addrRes?.address || "";
        const netRes = await withTimeout(getNetwork(), 5000);
        net = netRes?.network || "TESTNET";
      } else {
        // Step 4: request permission — retry once for MV3 service worker restart
        let result;
        for (let i = 0; i < 2; i++) {
          try {
            result = await withTimeout(requestAccess(), 60000, "Freighter did not respond. Please approve or reject in the extension.");
            break;
          } catch (e) {
            const isPortErr = e?.message?.includes("message channel closed") ||
              e?.message?.includes("listener indicated") ||
              e?.message?.includes("timed out");
            if (isPortErr && i === 0) {
              await new Promise(r => setTimeout(r, 1000));
              continue;
            }
            throw e;
          }
        }

        if (result?.error) {
          const errMsg = result.error?.message || String(result.error) || "Access denied";
          setError(errMsg);
          return false;
        }

        // Freighter API v6: requestAccess() returns { address } directly
        addr = result?.address || "";
        const netRes = await withTimeout(getNetwork(), 5000);
        net = netRes?.network || "TESTNET";
      }

      if (!addr || !isValidStellarAddress(addr)) {
        setError("Could not get wallet address. Make sure your Freighter account is set up, then try again.");
        return false;
      }

      localStorage.setItem(WALLET_TYPE, "freighter");
      localStorage.removeItem(MANUAL_KEY);
      setAccount(addr); setNetwork(net);
      setWalletType("freighter"); setIsViewOnly(false);
      return true;
    } catch (err) {
      Sentry.captureException(err);
      const msg = err?.message || String(err) || "Connection failed";
      if (msg.includes("timed out") || msg.includes("message channel closed") || msg.includes("listener indicated")) {
        setError("Freighter timed out. Force-close and reopen the extension, then try again.");
      } else if (msg.toLowerCase().includes("declined") || msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("rejected")) {
        setError("Connection rejected — tap Approve in Freighter.");
      } else {
        setError(msg);
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // ── Manual address (view-only) ────────────────────────────────────────────
  const connectManual = useCallback((address) => {
    const addr = address?.trim();
    if (!isValidStellarAddress(addr)) {
      setError("Invalid Stellar address. Must start with G and be 56 characters.");
      return false;
    }
    localStorage.setItem(MANUAL_KEY, addr);
    localStorage.setItem(WALLET_TYPE, "manual");
    setAccount(addr); setNetwork("TESTNET");
    setWalletType("manual"); setIsViewOnly(true); setError(null);
    return true;
  }, []);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    localStorage.removeItem(MANUAL_KEY);
    localStorage.removeItem(WALLET_TYPE);
    setAccount(null); setNetwork(null);
    setWalletType(null); setIsViewOnly(false); setError(null);
  }, []);

  // ── Sign transaction ──────────────────────────────────────────────────────
  const signTx = useCallback(async (xdr, networkPassphrase) => {
    if (!account) throw new Error("Wallet not connected");
    if (isViewOnly) throw new Error("VIEW_ONLY: Open this app in Freighter to sign transactions.");

    const passphrase =
      networkPassphrase ||
      STELLAR_NETWORKS[network]?.passphrase ||
      STELLAR_NETWORKS.TESTNET.passphrase;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await withTimeout(
          signTransaction(xdr, { networkPassphrase: passphrase, address: account }),
          60000,
          "Freighter signing timed out. Please approve in the extension."
        );
        if (result?.error) throw new Error(result.error?.message || String(result.error));
        const signed = result?.signedTxXdr || null;
        if (!signed) throw new Error("Freighter returned empty signature");
        return signed;
      } catch (err) {
        const isPortErr =
          err?.message?.includes("message channel closed") ||
          err?.message?.includes("listener indicated");
        if (isPortErr && attempt === 1) {
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        Sentry.captureException(err);
        throw err;
      }
    }
  }, [account, network, isViewOnly]);

  return {
    account,
    network,
    walletType,
    networkInfo: STELLAR_NETWORKS[network] || { name: network || "Unknown", passphrase: "" },
    isFreighterInstalled,
    isConnecting,
    isViewOnly,
    error,
    isConnected: !!account,
    connect,
    connectManual,
    disconnect,
    signTx,
  };
}
