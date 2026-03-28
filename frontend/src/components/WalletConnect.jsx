import React, { useState } from "react";
import {
  Wallet, LogOut, X, ExternalLink, CheckCircle2,
  Star, AlertCircle, Loader2,
} from "lucide-react";

const WALLETS = [
  {
    id: "ledger",
    name: "Ledger",
    description: "Hardware wallet — most secure",
    recommended: false,
    installUrl: "https://ledger.com",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8 flex-shrink-0">
        <rect width="40" height="40" rx="10" fill="#1c1c1c" />
        <rect x="10" y="14" width="20" height="14" rx="2" stroke="white" strokeWidth="1.5" fill="none" />
        <rect x="13" y="17" width="8" height="8" rx="1" fill="white" opacity="0.7" />
        <rect x="23" y="20" width="4" height="1.5" rx="0.75" fill="white" opacity="0.5" />
        <rect x="23" y="23" width="4" height="1.5" rx="0.75" fill="white" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: "lobstr",
    name: "LOBSTR",
    description: "Mobile-first Stellar wallet",
    recommended: false,
    installUrl: "https://lobstr.co",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8 flex-shrink-0">
        <rect width="40" height="40" rx="10" fill="#0ea5e9" />
        <text
          x="50%"
          y="55%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="20"
          fontWeight="bold"
          fontFamily="Arial, sans-serif"
        >L</text>
      </svg>
    ),
  },
  {
    id: "albedo",
    name: "Albedo",
    description: "Web-based Stellar transaction signer",
    recommended: false,
    installUrl: "https://albedo.link",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8 flex-shrink-0">
        <rect width="40" height="40" rx="10" fill="#1a1a2e" />
        <circle cx="20" cy="20" r="10" stroke="#7c3aed" strokeWidth="2" fill="none" />
        <circle cx="20" cy="20" r="4" fill="#7c3aed" />
      </svg>
    ),
  },
  {
    id: "xbull",
    name: "xBull",
    description: "Feature-rich Stellar wallet",
    recommended: false,
    installUrl: "https://xbull.app",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8 flex-shrink-0">
        <rect width="40" height="40" rx="10" fill="#0f172a" />
        <path d="M12 14 L20 26 L28 14" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 26 L20 14 L28 26" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
      </svg>
    ),
  },
  {
    id: "freighter",
    name: "Freighter",
    description: "Official Stellar browser extension by SDF",
    recommended: true,
    installUrl: "https://freighter.app",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8 flex-shrink-0">
        <rect width="40" height="40" rx="10" fill="#6366F1" />
        <path d="M10 20 L20 10 L30 20 L20 30 Z" fill="white" opacity="0.9" />
        <circle cx="20" cy="20" r="4" fill="#6366F1" />
      </svg>
    ),
  },
  {
    id: "rabet",
    name: "Rabet",
    description: "Stellar browser extension wallet",
    recommended: false,
    installUrl: "https://rabet.io",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8 flex-shrink-0">
        <rect width="40" height="40" rx="10" fill="#7c3aed" />
        <path d="M13 28 L13 16 Q13 12 17 12 L23 12 Q27 12 27 16 Q27 20 23 20 L17 20 L23 28"
          stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "hana",
    name: "Hana Wallet",
    description: "Multi-chain wallet with Stellar support",
    recommended: false,
    installUrl: "https://hanawallet.io",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8 flex-shrink-0">
        <rect width="40" height="40" rx="10" fill="#ec4899" />
        <path d="M14 28 L14 12 M14 20 L26 12 M26 28 L26 12"
          stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const NETWORK_BADGE = {
  PUBLIC: "badge-green",
  TESTNET: "badge-yellow",
  FUTURENET: "badge-blue",
};

export function WalletConnect({
  account,
  network,
  networkInfo,
  isConnecting,
  isFreighterInstalled,
  error,
  onConnect,
  onDisconnect,
}) {
  const [showModal, setShowModal] = useState(false);
  const [connectingId, setConnectingId] = useState(null);

  const shortAddr = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : null;

  const handleWalletClick = async (wallet) => {
    if (wallet.id !== "freighter") {
      window.open(wallet.installUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!isFreighterInstalled) {
      window.open("https://freighter.app", "_blank", "noopener,noreferrer");
      return;
    }
    setConnectingId(wallet.id);
    setShowModal(false);
    await onConnect();
    setConnectingId(null);
  };

  // Connected state
  if (account) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-stellar-800/50 border border-stellar-600/30 rounded-xl px-3 py-1.5">
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 flex-shrink-0">
            <rect width="16" height="16" rx="4" fill="#6366F1" />
            <path d="M4 8 L8 4 L12 8 L8 12 Z" fill="white" opacity="0.9" />
            <circle cx="8" cy="8" r="1.5" fill="#6366F1" />
          </svg>
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
          <span className="font-mono text-sm text-gray-200">{shortAddr}</span>
        </div>

        <span className={`badge ${NETWORK_BADGE[network] || "badge-blue"}`}>
          {networkInfo?.name || network || "Stellar"}
        </span>

        <button
          onClick={onDisconnect}
          className="btn-secondary py-1.5 px-3 flex items-center gap-1.5"
        >
          <LogOut size={13} />
          Disconnect
        </button>
      </div>
    );
  }

  // Disconnected state
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isConnecting || !!connectingId}
        className="btn-primary flex items-center gap-2"
      >
        {isConnecting || connectingId ? (
          <><Loader2 size={15} className="animate-spin" /> Connecting…</>
        ) : (
          <><Wallet size={15} /> Connect Wallet</>
        )}
      </button>

      {/* Wallet selector modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-md bg-stellar-900 border border-stellar-700/50 rounded-2xl shadow-2xl animate-slide-up overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stellar-800/50">
              <div>
                <h2 className="font-bold text-gray-100 text-lg">Connect a Wallet</h2>
                <p className="text-xs text-gray-500 mt-0.5">Stellar Network · Choose your wallet</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg hover:bg-stellar-800/50 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mt-4 flex items-start gap-2 text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2.5 text-sm">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Wallet list */}
            <div className="p-3 space-y-1.5 max-h-[65vh] overflow-y-auto">
              {WALLETS.map((wallet) => {
                const isActive = connectingId === wallet.id;
                const isInstalled = wallet.id === "freighter" && isFreighterInstalled;
                const needsInstall = wallet.id === "freighter" && !isFreighterInstalled;

                return (
                  <button
                    key={wallet.id}
                    onClick={() => handleWalletClick(wallet)}
                    disabled={isActive}
                    className={[
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150",
                      wallet.recommended
                        ? "bg-stellar-700/30 border border-stellar-500/40 hover:bg-stellar-700/50 hover:border-stellar-400/60"
                        : "bg-stellar-800/20 border border-stellar-800/30 hover:bg-stellar-800/40",
                      isActive ? "opacity-60 cursor-wait" : "cursor-pointer",
                    ].join(" ")}
                  >
                    {wallet.icon}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-100 text-sm">
                          {wallet.name}
                        </span>

                        {wallet.recommended && (
                          <span className="inline-flex items-center gap-0.5 text-xs bg-stellar-600/40 text-stellar-300 border border-stellar-500/30 px-1.5 py-0.5 rounded-full font-medium">
                            <Star size={9} fill="currentColor" /> Recommended
                          </span>
                        )}

                        {isInstalled && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-green-400 bg-green-900/30 border border-green-700/30 px-1.5 py-0.5 rounded-full">
                            <CheckCircle2 size={9} /> Installed
                          </span>
                        )}

                        {(needsInstall || wallet.id !== "freighter") && (
                          <span className="text-xs text-gray-500 flex items-center gap-0.5">
                            <ExternalLink size={9} />
                            {needsInstall ? "Install" : "Open"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {wallet.description}
                      </p>
                    </div>

                    {isActive && (
                      <Loader2 size={16} className="animate-spin text-stellar-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-stellar-800/50 text-center">
              <p className="text-xs text-gray-500">
                New to Stellar?{" "}
                <a
                  href="https://freighter.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stellar-400 hover:text-stellar-300 underline"
                >
                  Get Freighter
                </a>{" "}
                — the official Stellar browser wallet
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
