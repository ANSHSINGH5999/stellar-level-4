import { useState, useCallback, useEffect } from "react";
import * as FreighterAPI from "@stellar/freighter-api";
import * as Sentry from "@sentry/react";

export const STELLAR_NETWORKS = {
  PUBLIC:     { name: "Stellar Mainnet", passphrase: "Public Global Stellar Network ; September 2015" },
  TESTNET:    { name: "Stellar Testnet", passphrase: "Test SDF Network ; September 2015" },
  FUTURENET:  { name: "Stellar Futurenet", passphrase: "Test SDF Future Network ; October 2022" },
};

// Check if window.freighter is available (works for both extension and mobile in-app browser)
function hasFreighter() {
  return typeof window !== "undefined" && (!!window.freighter || !!window.freighterApi);
}

// Unwrap SDK result — handles {value, error} and plain returns
function unwrap(result, key) {
  if (result === null || result === undefined) return null;
  if (typeof result === "object" && key in result) return result[key];
  if (typeof result === "object" && "error" in result && result.error) return null;
  return result;
}

// Try SDK first, fall back to window.freighter direct call
async function requestAccess() {
  try {
    const r = await FreighterAPI.requestAccess();
    if (r?.error) throw new Error(r.error);
    return r;
  } catch {
    if (window.freighter?.requestAccess) return window.freighter.requestAccess();
    throw new Error("Freighter requestAccess not available");
  }
}

async function getAddress() {
  try {
    const r = await FreighterAPI.getAddress();
    const addr = unwrap(r, "address") || r;
    if (addr && typeof addr === "string") return addr;
  } catch {}
  // Direct fallback
  if (window.freighter?.getPublicKey) return window.freighter.getPublicKey();
  if (window.freighter?.getAddress) {
    const r = await window.freighter.getAddress();
    return unwrap(r, "address") || r;
  }
  return null;
}

async function getNetwork() {
  try {
    const r = await FreighterAPI.getNetwork();
    const net = unwrap(r, "network") || r;
    if (net && typeof net === "string") return net;
  } catch {}
  if (window.freighter?.getNetwork) {
    const r = await window.freighter.getNetwork();
    return unwrap(r, "network") || r || "TESTNET";
  }
  return "TESTNET";
}

export function useFreighter() {
  const [account, setAccount]                   = useState(null);
  const [network, setNetwork]                   = useState(null);
  const [isFreighterInstalled, setInstalled]    = useState(() => hasFreighter());
  const [isConnecting, setIsConnecting]         = useState(false);
  const [error, setError]                       = useState(null);

  // Re-check after a short delay in case mobile browser injects window.freighter late
  useEffect(() => {
    let t1 = setTimeout(() => { if (hasFreighter()) setInstalled(true); }, 300);
    let t2 = setTimeout(() => { if (hasFreighter()) setInstalled(true); }, 1500);

    async function tryAutoReconnect() {
      if (!hasFreighter()) return;
      setInstalled(true);
      try {
        const allowedResult = await FreighterAPI.isAllowed();
        const allowed = unwrap(allowedResult, "isAllowed") ?? allowedResult ?? false;
        if (allowed) {
          const addr = await getAddress();
          const net  = await getNetwork();
          if (addr) setAccount(addr);
          if (net)  setNetwork(net);
        }
      } catch {}
    }
    tryAutoReconnect();
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Check availability — prefer window.freighter direct check over async SDK
      if (!hasFreighter()) {
        // Give it one more second (mobile may inject late)
        await new Promise(r => setTimeout(r, 1000));
        if (!hasFreighter()) {
          setError("Freighter not found. Open this app inside Freighter's browser.");
          return false;
        }
      }
      setInstalled(true);

      // Request access
      await requestAccess();

      // Get address
      const addr = await getAddress();
      if (!addr) {
        setError("Could not get wallet address. Please try again.");
        return false;
      }

      // Get network
      const net = await getNetwork();

      setAccount(addr);
      setNetwork(net || "TESTNET");
      return true;
    } catch (err) {
      Sentry.captureException(err);
      const msg = err?.message || String(err) || "Connection failed";
      // Filter non-error messages
      if (msg.includes("message channel closed") || msg.includes("listener indicated")) {
        setError("Freighter timed out — please try again.");
      } else if (msg.includes("User declined") || msg.includes("denied")) {
        setError("Connection rejected. Please approve in Freighter.");
      } else {
        setError(msg);
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setNetwork(null);
    setError(null);
  }, []);

  const signTx = useCallback(async (xdr, networkPassphrase) => {
    if (!account) throw new Error("Wallet not connected");

    const passphrase =
      networkPassphrase ||
      STELLAR_NETWORKS[network]?.passphrase ||
      STELLAR_NETWORKS.TESTNET.passphrase;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await FreighterAPI.signTransaction(xdr, {
          networkPassphrase: passphrase,
          address: account,
        });
        if (result?.error) throw new Error(result.error);
        const signedXdr = unwrap(result, "signedTxXdr");
        if (!signedXdr) throw new Error("Freighter returned empty signature");
        return signedXdr;
      } catch (err) {
        const isListenerError =
          err?.message?.includes("message channel closed") ||
          err?.message?.includes("listener indicated");
        if (isListenerError && attempt === 1) {
          await new Promise(r => setTimeout(r, 600));
          continue;
        }
        Sentry.captureException(err);
        throw err;
      }
    }
  }, [account, network]);

  return {
    account,
    network,
    networkInfo: STELLAR_NETWORKS[network] || { name: network || "Unknown", passphrase: "" },
    isFreighterInstalled,
    isConnecting,
    error,
    isConnected: !!account,
    connect,
    disconnect,
    signTx,
  };
}
