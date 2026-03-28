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

const MANUAL_KEY   = "stellar_manual_address";
const WALLET_TYPE  = "stellar_wallet_type"; // 'freighter' | 'xbull' | 'manual'

// ── Wait for wallet injection ─────────────────────────────────────────────
const waitFor = (check, timeout = 8000) =>
  new Promise((resolve) => {
    if (check()) { resolve(true); return; }
    const start = Date.now();
    const poll = () => {
      if (check()) { resolve(true); return; }
      if (Date.now() - start > timeout) { resolve(false); return; }
      setTimeout(poll, 500);
    };
    poll();
  });

const hasFreighter = () => typeof window !== "undefined" && !!window.freighter;
const hasXBull     = () => typeof window !== "undefined" && !!window.xBullSDK;

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
  const [account, setAccount]       = useState(() => localStorage.getItem(MANUAL_KEY) || null);
  const [network, setNetwork]       = useState("TESTNET");
  const [walletType, setWalletType] = useState(() => localStorage.getItem(WALLET_TYPE) || null);
  const [isViewOnly, setIsViewOnly] = useState(() => localStorage.getItem(WALLET_TYPE) === "manual");
  const [isFreighterInstalled, setFreighterInstalled] = useState(() => hasFreighter());
  const [isXBullInstalled, setXBullInstalled]         = useState(() => hasXBull());
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError]               = useState(null);

  // ── Auto-detect + auto-reconnect on mount ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Detect xBull
      const xbullFound = await waitFor(hasXBull, 2000);
      if (xbullFound && !cancelled) setXBullInstalled(true);

      // Detect Freighter
      const freighterFound = await waitFor(hasFreighter, 3000);
      if (freighterFound && !cancelled) setFreighterInstalled(true);

      if (cancelled) return;

      const savedType = localStorage.getItem(WALLET_TYPE);

      // Auto-reconnect xBull if previously used
      if (xbullFound && savedType === "xbull") {
        try {
          const res = await window.xBullSDK.connect({
            canRequestPublicKey: true,
            canRequestSign: true,
          });
          const addr = res?.publicKey || res;
          if (addr && isValidStellarAddress(addr) && !cancelled) {
            setAccount(addr); setNetwork("TESTNET");
            setWalletType("xbull"); setIsViewOnly(false);
            return;
          }
        } catch {}
      }

      // Auto-reconnect Freighter if detected
      if (freighterFound) {
        try {
          const allowedRes     = await isAllowed();
          const alreadyAllowed = allowedRes?.isAllowed ?? false;

          let addr = "";
          let net  = "TESTNET";

          if (alreadyAllowed) {
            const addrRes = await getAddress();
            addr = addrRes?.address || "";
            const netRes = await getNetwork();
            net = netRes?.network || "TESTNET";
          } else if (!savedType || savedType === "freighter") {
            // Inside Freighter browser but not yet allowed → auto-request
            const result = await requestAccess();
            if (result?.error) return;
            addr = result?.address || "";
            const netRes = await getNetwork();
            net = netRes?.network || "TESTNET";
          }

          if (!cancelled && addr && isValidStellarAddress(addr)) {
            localStorage.setItem(WALLET_TYPE, "freighter");
            localStorage.removeItem(MANUAL_KEY);
            setAccount(addr); setNetwork(net);
            setWalletType("freighter"); setIsViewOnly(false);
          }
        } catch {}
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Freighter connect ──────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setIsConnecting(true); setError(null);
    try {
      const found = await waitFor(hasFreighter, 8000);
      if (!found) {
        setError("Freighter not found. Open this app inside Freighter's browser.");
        return false;
      }
      setFreighterInstalled(true);

      const allowedRes     = await isAllowed();
      const alreadyAllowed = allowedRes?.isAllowed ?? false;

      let addr = "";
      let net  = "TESTNET";

      if (alreadyAllowed) {
        const addrRes = await getAddress();
        addr = addrRes?.address || "";
        const netRes = await getNetwork();
        net = netRes?.network || "TESTNET";
      } else {
        let result;
        // Retry once — Freighter service worker may restart (causes "message port closed")
        for (let i = 0; i < 2; i++) {
          try {
            result = await requestAccess();
            break;
          } catch (e) {
            const isPortErr = e?.message?.includes("message channel closed") ||
              e?.message?.includes("listener indicated");
            if (isPortErr && i === 0) { await new Promise(r => setTimeout(r, 800)); continue; }
            throw e;
          }
        }
        if (result?.error) {
          const errMsg = result.error?.message || String(result.error) || "Access denied";
          setError(errMsg);
          return false;
        }
        // requestAccess() returns { address } directly in Freighter API v6
        addr = result?.address || "";
        const netRes = await getNetwork();
        net = netRes?.network || "TESTNET";
      }

      if (!addr || !isValidStellarAddress(addr)) {
        setError("Could not get wallet address. Please try again.");
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
      if (msg.includes("message channel closed") || msg.includes("listener indicated")) {
        setError("Freighter timed out — force close & reopen, then try again.");
      } else if (msg.toLowerCase().includes("declined") || msg.toLowerCase().includes("denied")) {
        setError("Connection rejected — tap Approve in Freighter.");
      } else {
        setError(msg);
      }
      return false;
    } finally { setIsConnecting(false); }
  }, []);

  // ── xBull connect ─────────────────────────────────────────────────────────
  const connectXBull = useCallback(async () => {
    setIsConnecting(true); setError(null);
    try {
      const found = await waitFor(hasXBull, 5000);
      if (!found) {
        setError("xBull Wallet not found. Install the xBull extension first.");
        return false;
      }
      setXBullInstalled(true);

      const res  = await window.xBullSDK.connect({
        canRequestPublicKey: true,
        canRequestSign: true,
      });
      const addr = res?.publicKey || res;

      if (!addr || !isValidStellarAddress(addr)) {
        setError("Could not get xBull address. Please try again.");
        return false;
      }

      localStorage.setItem(WALLET_TYPE, "xbull");
      localStorage.removeItem(MANUAL_KEY);
      setAccount(addr); setNetwork("TESTNET");
      setWalletType("xbull"); setIsViewOnly(false);
      return true;
    } catch (err) {
      Sentry.captureException(err);
      const msg = err?.message || String(err) || "xBull connection failed";
      setError(msg.includes("User rejected") ? "Connection rejected — approve in xBull." : msg);
      return false;
    } finally { setIsConnecting(false); }
  }, []);

  // ── Manual address (view-only) ─────────────────────────────────────────────
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

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    localStorage.removeItem(MANUAL_KEY);
    localStorage.removeItem(WALLET_TYPE);
    setAccount(null); setNetwork(null);
    setWalletType(null); setIsViewOnly(false); setError(null);
  }, []);

  // ── Sign transaction ───────────────────────────────────────────────────────
  const signTx = useCallback(async (xdr, networkPassphrase) => {
    if (!account) throw new Error("Wallet not connected");
    if (isViewOnly) throw new Error("VIEW_ONLY: Open this app in Freighter or xBull to sign transactions.");

    const passphrase =
      networkPassphrase ||
      STELLAR_NETWORKS[network]?.passphrase ||
      STELLAR_NETWORKS.TESTNET.passphrase;

    // xBull signing
    if (walletType === "xbull") {
      try {
        const res = await window.xBullSDK.signXDR(xdr, {
          network: network === "PUBLIC" ? "PUBLIC" : "TESTNET",
        });
        const signed = res?.signedXDR || res?.xdr || res;
        if (!signed || typeof signed !== "string") throw new Error("xBull returned empty signature");
        return signed;
      } catch (err) {
        throw new Error(err?.message || "xBull signing failed");
      }
    }

    // Freighter signing
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await signTransaction(xdr, { networkPassphrase: passphrase, address: account });
        if (result?.error) throw new Error(result.error?.message || String(result.error));
        const signed = result?.signedTxXdr || null;
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
  }, [account, network, walletType, isViewOnly]);

  return {
    account,
    network,
    walletType,
    networkInfo: STELLAR_NETWORKS[network] || { name: network || "Unknown", passphrase: "" },
    isFreighterInstalled,
    isXBullInstalled,
    isConnecting,
    isViewOnly,
    error,
    isConnected: !!account,
    connect,
    connectXBull,
    connectManual,
    disconnect,
    signTx,
  };
}
