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

const MANUAL_KEY  = "stellar_manual_address";
const WALLET_TYPE = "stellar_wallet_type"; // 'freighter' | 'manual'

// Wrap a promise with a hard timeout
const withTimeout = (promise, ms, msg) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(msg || `Timed out after ${ms / 1000}s`)), ms)
    ),
  ]);

export function isValidStellarAddress(addr) {
  try { return StellarSdk.StrKey.isValidEd25519PublicKey(addr?.trim()); }
  catch { return false; }
}

export function useFreighter() {
  const [account, setAccount]       = useState(() => localStorage.getItem(MANUAL_KEY) || null);
  const [network, setNetwork]       = useState("TESTNET");
  const [walletType, setWalletType] = useState(() => localStorage.getItem(WALLET_TYPE) || null);
  const [isViewOnly, setIsViewOnly] = useState(() => localStorage.getItem(WALLET_TYPE) === "manual");
  const [isFreighterInstalled, setFreighterInstalled] = useState(
    () => typeof window !== "undefined" && !!window.freighter
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError]               = useState(null);

  // ── Auto-reconnect on mount (silent — never shows popup) ─────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Detect window.freighter injection (up to 3s)
      if (!window.freighter) {
        await new Promise(resolve => {
          const deadline = Date.now() + 3000;
          const check = () => {
            if (window.freighter || Date.now() > deadline) { resolve(); return; }
            setTimeout(check, 300);
          };
          check();
        });
      }

      if (window.freighter && !cancelled) setFreighterInstalled(true);
      if (cancelled) return;

      // Only auto-reconnect if user already approved before (isAllowed check)
      // This avoids showing a popup on page load
      try {
        const allowedRes = await withTimeout(isAllowed(), 5000);
        if (!allowedRes?.isAllowed || cancelled) return;

        const addrRes = await withTimeout(getAddress(), 5000);
        const addr = addrRes?.address || "";
        if (!addr || !isValidStellarAddress(addr) || cancelled) return;

        const netRes = await withTimeout(getNetwork(), 5000);
        const net = netRes?.network || "TESTNET";

        localStorage.setItem(WALLET_TYPE, "freighter");
        localStorage.removeItem(MANUAL_KEY);
        setAccount(addr); setNetwork(net);
        setWalletType("freighter"); setIsViewOnly(false);
      } catch {
        // Silent — user will manually connect
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Freighter connect ─────────────────────────────────────────────────────
  // Direct approach: call requestAccess() immediately — this IS the Freighter popup trigger.
  // No pre-flight isAllowed/isConnected checks that can block it.
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      console.log("[Freighter] Calling requestAccess()…");

      // requestAccess() shows the Freighter approval popup.
      // If Freighter is not installed it hangs — so we give it 15s to respond.
      const access = await withTimeout(
        requestAccess(),
        15000,
        "Freighter not responding — make sure the extension is installed and open this app inside Freighter's browser tab."
      );

      console.log("[Freighter] requestAccess result:", access);

      if (access?.error) {
        const msg = access.error?.message || String(access.error) || "Access denied";
        setError(msg);
        return false;
      }

      // Freighter API v6: requestAccess() returns { address } directly
      let addr = access?.address || "";

      // Fallback: call getAddress() in case address was empty in the access result
      if (!addr) {
        console.log("[Freighter] address empty from requestAccess, calling getAddress()…");
        const addrRes = await withTimeout(getAddress(), 5000);
        addr = addrRes?.address || "";
      }

      console.log("[Freighter] address:", addr);

      if (!addr || !isValidStellarAddress(addr)) {
        setError("Could not get wallet address. Make sure your Freighter account is set up.");
        return false;
      }

      const netRes = await withTimeout(getNetwork(), 5000);
      const net = netRes?.network || "TESTNET";

      localStorage.setItem(WALLET_TYPE, "freighter");
      localStorage.removeItem(MANUAL_KEY);
      setAccount(addr); setNetwork(net);
      setWalletType("freighter"); setIsViewOnly(false);

      console.log("[Freighter] Connected!", addr, net);
      return true;

    } catch (err) {
      Sentry.captureException(err);
      const msg = err?.message || String(err) || "Connection failed";
      console.error("[Freighter] connect error:", msg);

      if (msg.includes("not responding") || msg.includes("Timed out") || msg.includes("timed out")) {
        setError("Freighter not found — install the extension or open this app inside Freighter's browser tab.");
      } else if (
        msg.toLowerCase().includes("declined") ||
        msg.toLowerCase().includes("denied") ||
        msg.toLowerCase().includes("rejected") ||
        msg.toLowerCase().includes("user cancelled")
      ) {
        setError("Connection rejected — tap Approve in Freighter.");
      } else if (msg.includes("message channel closed") || msg.includes("listener indicated")) {
        setError("Freighter disconnected — force-close it, reopen, then try again.");
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
          "Freighter signing timed out — please approve in the extension."
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
