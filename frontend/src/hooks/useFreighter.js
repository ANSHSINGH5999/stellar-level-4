import { useState, useCallback, useEffect } from "react";
import {
  requestAccess,
  getAddress,
  getNetwork,
  isAllowed,
  signTransaction,
} from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";
import * as Sentry from "@sentry/react";

export const STELLAR_NETWORKS = {
  PUBLIC:    { name: "Stellar Mainnet", passphrase: "Public Global Stellar Network ; September 2015" },
  TESTNET:   { name: "Stellar Testnet", passphrase: "Test SDF Network ; September 2015" },
  FUTURENET: { name: "Stellar Futurenet", passphrase: "Test SDF Future Network ; October 2022" },
};

const MANUAL_KEY = "stellar_manual_address";

// Wait for Freighter to inject window.freighter (mobile injects with delay)
const waitForFreighter = (timeout = 8000) =>
  new Promise((resolve) => {
    if (window.freighter) { resolve(true); return; }
    const start = Date.now();
    const check = () => {
      if (window.freighter) { resolve(true); return; }
      if (Date.now() - start > timeout) { resolve(false); return; }
      setTimeout(check, 500);
    };
    check();
  });

function unwrap(result, key) {
  if (result === null || result === undefined) return null;
  if (typeof result === "object" && key in result) return result[key];
  if (typeof result === "object" && "error" in result && result.error) return null;
  return result;
}

export function isValidStellarAddress(addr) {
  try { return StellarSdk.StrKey.isValidEd25519PublicKey(addr?.trim()); }
  catch { return false; }
}

export function useFreighter() {
  const [account, setAccount]                = useState(() => localStorage.getItem(MANUAL_KEY) || null);
  const [network, setNetwork]                = useState("TESTNET");
  const [isViewOnly, setIsViewOnly]          = useState(() => !!localStorage.getItem(MANUAL_KEY));
  const [isFreighterInstalled, setInstalled] = useState(
    () => typeof window !== "undefined" && !!window.freighter
  );
  const [isConnecting, setIsConnecting]      = useState(false);
  const [error, setError]                    = useState(null);

  // Auto-detect Freighter + auto-reconnect on mount
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const found = await waitForFreighter(3000);
      if (cancelled) return;
      if (found) {
        setInstalled(true);
        // Only auto-reconnect if NOT in manual/view-only mode
        if (!localStorage.getItem(MANUAL_KEY)) {
          try {
            const allowed = await isAllowed();
            const isOk = unwrap(allowed, "isAllowed") ?? allowed ?? false;
            if (isOk && !cancelled) {
              const addrRes = await getAddress();
              const addr    = unwrap(addrRes, "address") ?? addrRes;
              const netRes  = await getNetwork();
              const net     = unwrap(netRes, "network") ?? netRes;
              if (!cancelled && addr) {
                setAccount(addr);
                setNetwork(net || "TESTNET");
                setIsViewOnly(false);
              }
            }
          } catch {}
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // ── Freighter connect ──────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const found = await waitForFreighter(8000);
      if (!found) {
        setError("Freighter not found. Open this app inside Freighter's browser, or use address input below.");
        return false;
      }
      setInstalled(true);

      const result = await requestAccess();
      if (result?.error) { setError(result.error); return false; }

      const addrRes = await getAddress();
      const addr    = unwrap(addrRes, "address") ?? addrRes;
      if (!addr || typeof addr !== "string") {
        setError("Could not get wallet address. Please try again.");
        return false;
      }

      const netRes = await getNetwork();
      const net    = unwrap(netRes, "network") ?? netRes ?? "TESTNET";

      localStorage.removeItem(MANUAL_KEY);
      setIsViewOnly(false);
      setAccount(addr);
      setNetwork(net);
      return true;
    } catch (err) {
      Sentry.captureException(err);
      const msg = err?.message || String(err) || "Connection failed";
      if (msg.includes("message channel closed") || msg.includes("listener indicated")) {
        setError("Freighter timed out — force close & reopen the app, then try again.");
      } else if (msg.toLowerCase().includes("declined") || msg.toLowerCase().includes("denied")) {
        setError("Connection rejected — tap Approve in Freighter.");
      } else {
        setError(msg);
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // ── Manual address (view-only) connect ────────────────────────────────────
  const connectManual = useCallback((address) => {
    const addr = address?.trim();
    if (!isValidStellarAddress(addr)) {
      setError("Invalid Stellar address. Must start with G and be 56 characters.");
      return false;
    }
    localStorage.setItem(MANUAL_KEY, addr);
    setAccount(addr);
    setNetwork("TESTNET");
    setIsViewOnly(true);
    setError(null);
    return true;
  }, []);

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    localStorage.removeItem(MANUAL_KEY);
    setAccount(null);
    setNetwork(null);
    setIsViewOnly(false);
    setError(null);
  }, []);

  // ── Sign transaction (blocked in view-only mode) ───────────────────────────
  const signTx = useCallback(async (xdr, networkPassphrase) => {
    if (!account) throw new Error("Wallet not connected");
    if (isViewOnly) throw new Error("VIEW_ONLY: Open this app in Freighter to sign transactions.");

    const passphrase =
      networkPassphrase ||
      STELLAR_NETWORKS[network]?.passphrase ||
      STELLAR_NETWORKS.TESTNET.passphrase;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await signTransaction(xdr, { networkPassphrase: passphrase, address: account });
        if (result?.error) throw new Error(result.error);
        const signed = unwrap(result, "signedTxXdr");
        if (!signed) throw new Error("Freighter returned empty signature");
        return signed;
      } catch (err) {
        const isListenerErr =
          err?.message?.includes("message channel closed") ||
          err?.message?.includes("listener indicated");
        if (isListenerErr && attempt === 1) {
          await new Promise(r => setTimeout(r, 600));
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
