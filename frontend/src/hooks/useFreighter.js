import { useState, useCallback, useEffect } from "react";
import * as FreighterAPI from "@stellar/freighter-api";
import * as Sentry from "@sentry/react";

export const STELLAR_NETWORKS = {
  PUBLIC: { name: "Stellar Mainnet", passphrase: "Public Global Stellar Network ; September 2015" },
  TESTNET: { name: "Stellar Testnet", passphrase: "Test SDF Network ; September 2015" },
  FUTURENET: { name: "Stellar Futurenet", passphrase: "Test SDF Future Network ; October 2022" },
};

export function useFreighter() {
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Normalise a Freighter API result — handles both {value, error} and plain returns
  function unwrap(result, key) {
    if (result === null || result === undefined) return null;
    if (typeof result === "object" && key in result) return result[key];
    if (typeof result === "object" && "error" in result && result.error) return null;
    return result; // plain value (older API versions)
  }

  // Check if Freighter is installed on mount
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const result = await FreighterAPI.isConnected();
        const installed = unwrap(result, "isConnected") ?? result ?? false;
        if (cancelled) return;
        setIsFreighterInstalled(!!installed);

        if (installed) {
          const allowedResult = await FreighterAPI.isAllowed();
          const allowed = unwrap(allowedResult, "isAllowed") ?? allowedResult ?? false;
          if (!cancelled && allowed) {
            const addrResult = await FreighterAPI.getAddress();
            const addr = unwrap(addrResult, "address");
            const netResult = await FreighterAPI.getNetwork();
            const net = unwrap(netResult, "network");
            if (!cancelled) {
              if (addr) setAccount(addr);
              if (net) setNetwork(net);
            }
          }
        }
      } catch {
        if (!cancelled) setIsFreighterInstalled(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Check installation
      const connResult = await FreighterAPI.isConnected();
      const installed = unwrap(connResult, "isConnected") ?? connResult ?? false;
      if (!installed) {
        setError("Freighter is not installed. Click 'Get Freighter' to install.");
        return false;
      }

      // Request access
      const accessResult = await FreighterAPI.requestAccess();
      const accessError = accessResult?.error;
      if (accessError) {
        setError(typeof accessError === "string" ? accessError : "Access denied by user");
        return false;
      }

      // Get address
      const addrResult = await FreighterAPI.getAddress();
      const addr = unwrap(addrResult, "address");
      if (!addr) {
        setError(addrResult?.error || "Could not retrieve wallet address");
        return false;
      }

      // Get network
      const netResult = await FreighterAPI.getNetwork();
      const net = unwrap(netResult, "network") || "TESTNET";

      setAccount(addr);
      setNetwork(net);
      return true;
    } catch (err) {
      Sentry.captureException(err);
      const msg = err?.message || "Failed to connect Freighter";
      setError(msg);
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

  const signTx = useCallback(
    async (xdr, networkPassphrase) => {
      if (!account) throw new Error("Wallet not connected");

      const passphrase =
        networkPassphrase ||
        STELLAR_NETWORKS[network]?.passphrase ||
        STELLAR_NETWORKS.TESTNET.passphrase;

      // Retry once on the Chrome extension "listener closed" race condition
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
          const isListenerError = err?.message?.includes("message channel closed") ||
            err?.message?.includes("listener indicated");
          if (isListenerError && attempt === 1) {
            // Brief pause then retry — extension service worker may have restarted
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          Sentry.captureException(err);
          throw err;
        }
      }
    },
    [account, network]
  );

  const networkInfo = STELLAR_NETWORKS[network] || {
    name: network || "Unknown Network",
    passphrase: "",
  };

  return {
    account,
    network,
    networkInfo,
    isFreighterInstalled,
    isConnecting,
    error,
    isConnected: !!account,
    connect,
    disconnect,
    signTx,
  };
}
