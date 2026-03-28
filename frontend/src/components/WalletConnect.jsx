import React, { useState, useMemo } from "react";
import {
  Wallet, LogOut, X, ExternalLink, CheckCircle2,
  Star, AlertCircle, Loader2, Smartphone,
} from "lucide-react";

const isMobile = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

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

function CopyUrlButton({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-2 bg-stellar-900/60 border border-stellar-700/40 rounded-xl px-3 py-2 flex items-center gap-2">
      <span className="font-mono text-xs text-indigo-300 flex-1 truncate">{url}</span>
      <button
        onClick={copy}
        className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
          copied ? "bg-green-700/50 text-green-300" : "bg-indigo-700/50 text-indigo-300 hover:bg-indigo-600/50"
        }`}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

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
  const mobile = useMemo(() => isMobile(), []);

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

  // ── Mobile: inside Freighter browser → normal connect ────────────────────
  if (mobile && !account && isFreighterInstalled) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={async () => { setConnectingId("freighter"); await onConnect(); setConnectingId(null); }}
          disabled={isConnecting || !!connectingId}
          className="btn-primary flex items-center gap-2"
        >
          {isConnecting || connectingId ? (
            <><Loader2 size={15} className="animate-spin" /> Connecting…</>
          ) : (
            <><Wallet size={15} /> Connect Freighter</>
          )}
        </button>
        {error && (
          <div className="flex items-start gap-1.5 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2 text-xs text-red-400">
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  // ── Mobile: NOT in Freighter browser → step-by-step guide ────────────────
  if (mobile && !account && !isFreighterInstalled) {
    const appUrl = window.location.href;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const storeUrl = isAndroid
      ? "https://play.google.com/store/apps/details?id=io.freighter"
      : "https://apps.apple.com/app/freighter/id1669889725";

    const steps = [
      {
        title: "Install Freighter Mobile",
        desc: "Download the official Freighter wallet app",
        action: (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            <ExternalLink size={12} />
            {isAndroid ? "Download on Google Play" : "Download on App Store"}
          </a>
        ),
      },
      {
        title: 'Open Freighter → tap "Browser" 🌐',
        desc: "In the bottom nav, tap the Globe icon to open Freighter's in-app browser",
        action: null,
      },
      {
        title: "Paste this URL and go",
        desc: "Copy the link below, paste it in Freighter's browser address bar, and press Enter",
        action: (
          <CopyUrlButton url={appUrl} />
        ),
      },
      {
        title: 'Tap "Connect Wallet" here',
        desc: "Freighter will pop up automatically — tap Approve to connect",
        action: null,
      },
    ];

    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Smartphone size={15} /> Connect Wallet
        </button>

        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(6px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <div className="w-full max-w-lg bg-stellar-900 border border-stellar-700/50 rounded-t-3xl shadow-2xl overflow-hidden">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-stellar-700" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-stellar-800/50">
                <div>
                  <h2 className="font-bold text-gray-100 text-base">Connect Wallet on Mobile</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Follow these steps to use Freighter</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300 p-1.5 rounded-xl hover:bg-stellar-800/50 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Warning */}
              <div className="mx-4 mt-4 flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  <strong>Do NOT use Chrome or Safari</strong> — wallet connection only works inside Freighter's browser
                </p>
              </div>

              {/* Steps */}
              <div className="p-4 space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex gap-3 bg-stellar-800/20 border border-stellar-800/40 rounded-2xl px-4 py-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-100">{step.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                      {step.action}
                    </div>
                  </div>
                ))}
              </div>

              {/* Already in Freighter? Try connect directly */}
              <div className="px-4 pb-6 pt-2">
                <div className="border-t border-stellar-800/50 pt-4">
                  <p className="text-xs text-gray-500 text-center mb-3">
                    Already opened this app inside Freighter browser?
                  </p>
                  <button
                    onClick={async () => { setShowModal(false); await onConnect(); }}
                    className="w-full btn-primary flex items-center justify-center gap-2 py-3"
                  >
                    <Wallet size={15} /> Connect Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

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
                const desktopOnly = false;
                const showRecommended = wallet.recommended;

                return (
                  <button
                    key={wallet.id}
                    onClick={() => handleWalletClick(wallet)}
                    disabled={isActive}
                    className={[
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150",
                      showRecommended
                        ? "bg-stellar-700/30 border border-stellar-500/40 hover:bg-stellar-700/50 hover:border-stellar-400/60"
                        : "bg-stellar-800/20 border border-stellar-800/30 hover:bg-stellar-800/40",
                      desktopOnly ? "opacity-40 cursor-not-allowed" : "",
                      isActive ? "opacity-60 cursor-wait" : "",
                    ].join(" ")}
                  >
                    {wallet.icon}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-100 text-sm">
                          {wallet.name}
                        </span>

                        {showRecommended && (
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
