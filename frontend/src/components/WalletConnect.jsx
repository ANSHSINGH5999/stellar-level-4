import React, { useState, useMemo } from "react";
import {
  Wallet, LogOut, X, ExternalLink, AlertCircle,
  Loader2, Eye, KeyRound, CheckCircle2,
} from "lucide-react";
import { isValidStellarAddress } from "../hooks/useFreighter.js";

const isMobile = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

const FreighterIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" className="w-5 h-5 flex-shrink-0">
    <rect width="40" height="40" rx="10" fill="#6366F1" />
    <path d="M10 20 L20 10 L30 20 L20 30 Z" fill="white" opacity="0.9" />
    <circle cx="20" cy="20" r="4" fill="#6366F1" />
  </svg>
);

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
        copied ? "bg-green-700/50 text-green-300" : "bg-indigo-700/50 text-indigo-300 hover:bg-indigo-600/50"
      }`}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function AddressInput({ onConnect }) {
  const [addr, setAddr] = useState("");
  const valid = isValidStellarAddress(addr);

  return (
    <div className="space-y-3">
      <label className="text-xs text-gray-400 font-medium block">
        Paste your Stellar wallet address
      </label>
      <input
        type="text"
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        placeholder="GABC…XYZ  (starts with G, 56 chars)"
        className="w-full bg-stellar-800/60 border border-stellar-700/40 rounded-xl px-3 py-2.5 text-sm text-gray-100 font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500/60"
        autoComplete="off"
        spellCheck={false}
      />
      {addr && (
        <p className={`text-xs ${valid ? "text-green-400" : "text-red-400"}`}>
          {valid ? "✓ Valid Stellar address" : "✗ Invalid — must start with G, 56 characters"}
        </p>
      )}
      <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-xl px-3 py-2">
        <Eye size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300">
          <strong>View-only</strong> — see balances &amp; rewards. Staking needs Freighter.
        </p>
      </div>
      <button
        onClick={() => valid && onConnect(addr.trim())}
        disabled={!valid}
        className="w-full btn-primary py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        View My Portfolio
      </button>
    </div>
  );
}

function FreighterMobileGuide() {
  const appUrl    = window.location.href;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const storeUrl  = isAndroid
    ? "https://play.google.com/store/apps/details?id=io.freighter"
    : "https://apps.apple.com/app/freighter/id1669889725";

  return (
    <div className="space-y-3">
      <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl px-3 py-2.5">
        <p className="text-xs text-amber-300">
          ⚠️ <strong>Use Freighter's browser tab</strong> — does not work in Chrome/Safari
        </p>
      </div>
      {[
        {
          n: 1, title: "Install Freighter",
          body: "Download the official Freighter wallet app",
          action: (
            <a href={storeUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
              <ExternalLink size={11} /> {isAndroid ? "Google Play" : "App Store"}
            </a>
          ),
        },
        {
          n: 2, title: 'Open Freighter → tap "Browser" 🌐',
          body: "Use the globe icon in the bottom navigation bar",
        },
        {
          n: 3, title: "Paste this URL",
          body: "Copy and open this link in Freighter's browser",
          action: (
            <div className="mt-2 bg-stellar-900/60 border border-stellar-700/40 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="font-mono text-xs text-indigo-300 flex-1 truncate">{appUrl}</span>
              <CopyButton text={appUrl} />
            </div>
          ),
        },
        {
          n: 4, title: "Tap Connect — approve popup",
          body: "Freighter will ask for permission — tap Allow",
        },
      ].map(s => (
        <div key={s.n} className="flex gap-3 bg-stellar-800/20 border border-stellar-800/40 rounded-2xl px-4 py-3">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">{s.n}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-100">{s.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.body}</p>
            {s.action}
          </div>
        </div>
      ))}
    </div>
  );
}

const NETWORK_BADGE = { PUBLIC: "badge-green", TESTNET: "badge-yellow", FUTURENET: "badge-blue" };

export function WalletConnect({
  account, network, networkInfo,
  isConnecting, isFreighterInstalled,
  isViewOnly, walletType, error,
  onConnect, onConnectManual, onDisconnect,
}) {
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackTab, setFallbackTab]   = useState("guide"); // 'guide' | 'address'
  const [connecting, setConnecting]     = useState(false);
  const mobile = useMemo(() => isMobile(), []);

  const shortAddr   = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : null;
  const walletLabel = walletType === "manual" ? "View Only" : "Freighter";

  // ── Connected state ────────────────────────────────────────────────────────
  if (account) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {isViewOnly && (
          <span className="inline-flex items-center gap-1 text-xs bg-amber-900/30 border border-amber-700/40 text-amber-300 px-2 py-1 rounded-full font-medium">
            <Eye size={10} /> View Only
          </span>
        )}
        <div className="flex items-center gap-2 bg-stellar-800/50 border border-stellar-600/30 rounded-xl px-3 py-1.5">
          {walletType === "manual"
            ? <Eye size={14} className="text-amber-400" />
            : <FreighterIcon />}
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
          <span className="font-mono text-sm text-gray-200">{shortAddr}</span>
          <span className="text-xs text-gray-500">{walletLabel}</span>
        </div>
        <span className={`badge ${NETWORK_BADGE[network] || "badge-blue"}`}>
          {networkInfo?.name || network || "Stellar"}
        </span>
        <button onClick={onDisconnect} className="btn-secondary py-1.5 px-3 flex items-center gap-1.5">
          <LogOut size={13} /> Disconnect
        </button>
      </div>
    );
  }

  // ── One-tap connect: tap button → directly call Freighter ─────────────────
  const handleConnect = async () => {
    setConnecting(true);
    const ok = await onConnect();
    setConnecting(false);
    if (!ok) {
      // Failed → open fallback modal so user can see the error + alternatives
      setShowFallback(true);
      setFallbackTab(mobile && !isFreighterInstalled ? "guide" : "address");
    }
  };

  const busy = isConnecting || connecting;

  return (
    <>
      {/* ── Single connect button — NO modal, direct Freighter call ── */}
      <button
        onClick={handleConnect}
        disabled={busy}
        className="btn-primary flex items-center gap-2"
      >
        {busy
          ? <><Loader2 size={15} className="animate-spin" /> Connecting…</>
          : <><Wallet size={15} /> Connect Wallet</>
        }
      </button>

      {/* Error hint under button (outside fallback modal) */}
      {error && !showFallback && (
        <p className="text-xs text-red-400 mt-1 max-w-xs">{error}</p>
      )}

      {/* ── Fallback sheet — only opens when connect() fails ── */}
      {showFallback && (
        <div
          className={`fixed inset-0 z-50 flex ${mobile ? "items-end" : "items-center"} justify-center p-4`}
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowFallback(false); }}
        >
          <div className={`w-full max-w-md bg-stellar-900 border border-stellar-700/50 shadow-2xl overflow-hidden ${mobile ? "rounded-t-3xl" : "rounded-2xl"}`}>

            {mobile && (
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-stellar-700" />
              </div>
            )}

            <div className="flex items-center justify-between px-5 py-4 border-b border-stellar-800/50">
              <h2 className="font-bold text-gray-100 text-base">Connection Help</h2>
              <button
                onClick={() => setShowFallback(false)}
                className="text-gray-500 hover:text-gray-300 p-1.5 rounded-xl hover:bg-stellar-800/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mx-5 mt-4 flex items-start gap-2 text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2.5 text-sm">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-stellar-800/50 mt-3">
              {mobile && !isFreighterInstalled && (
                <button
                  onClick={() => setFallbackTab("guide")}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    fallbackTab === "guide"
                      ? "text-indigo-400 border-b-2 border-indigo-500"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <Wallet size={12} /> How to Use Freighter
                </button>
              )}
              <button
                onClick={() => setFallbackTab("address")}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                  fallbackTab === "address"
                    ? "text-amber-400 border-b-2 border-amber-500"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <KeyRound size={12} /> Paste Address
              </button>
              {(!mobile || isFreighterInstalled) && (
                <button
                  onClick={() => setFallbackTab("retry")}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    fallbackTab === "retry"
                      ? "text-indigo-400 border-b-2 border-indigo-500"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <Wallet size={12} /> Freighter
                </button>
              )}
            </div>

            <div className="p-5 max-h-[65vh] overflow-y-auto">

              {/* Mobile guide */}
              {fallbackTab === "guide" && <FreighterMobileGuide />}

              {/* Paste address */}
              {fallbackTab === "address" && (
                <AddressInput
                  onConnect={(addr) => {
                    onConnectManual(addr);
                    setShowFallback(false);
                  }}
                />
              )}

              {/* Retry Freighter */}
              {fallbackTab === "retry" && (
                <div className="space-y-3">
                  {isFreighterInstalled
                    ? (
                      <div className="flex items-center gap-2 bg-green-900/20 border border-green-700/30 rounded-xl px-3 py-2">
                        <CheckCircle2 size={13} className="text-green-400" />
                        <p className="text-xs text-green-300">Freighter detected ✓</p>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 bg-indigo-900/20 border border-indigo-700/30 rounded-xl px-3 py-2.5">
                        <AlertCircle size={13} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-indigo-300">
                          Freighter not detected.{" "}
                          <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="underline text-indigo-200">
                            Install it here
                          </a>{" "}then refresh.
                        </p>
                      </div>
                    )
                  }
                  <p className="text-xs text-gray-500">
                    If Freighter is installed but not responding, force-close it and reopen, then try again.
                  </p>
                  <button
                    onClick={async () => {
                      setConnecting(true);
                      const ok = await onConnect();
                      setConnecting(false);
                      if (ok) setShowFallback(false);
                    }}
                    disabled={busy}
                    className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                  >
                    {busy
                      ? <><Loader2 size={15} className="animate-spin" /> Connecting…</>
                      : <><Wallet size={15} /> Retry Freighter</>
                    }
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
