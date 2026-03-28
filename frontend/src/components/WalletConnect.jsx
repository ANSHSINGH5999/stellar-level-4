import React from "react";
import { Wallet, LogOut, AlertCircle, Loader2 } from "lucide-react";

const CHAIN_NAMES = {
  "1": "Ethereum Mainnet",
  "11155111": "Sepolia Testnet",
  "31337": "Hardhat Local",
};

export function WalletConnect({ account, chainId, isConnecting, error, onConnect, onDisconnect }) {
  const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
  const shortAddr = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-1.5">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}

      {account ? (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-stellar-800/50 border border-stellar-600/30 rounded-xl px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
            <span className="font-mono text-sm text-gray-200">{shortAddr}</span>
          </div>
          <span className="badge badge-blue">{chainName}</span>
          <button
            onClick={onDisconnect}
            className="btn-secondary py-1.5 px-3 flex items-center gap-1.5"
          >
            <LogOut size={13} />
            <span>Disconnect</span>
          </button>
        </div>
      ) : (
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="btn-primary flex items-center gap-2"
        >
          {isConnecting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              <Wallet size={15} />
              Connect Wallet
            </>
          )}
        </button>
      )}
    </div>
  );
}
