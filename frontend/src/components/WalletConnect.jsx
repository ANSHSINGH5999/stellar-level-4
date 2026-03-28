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

// ── Wallet icons ────────────────────────────────────────────────────────────
const FreighterIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8 flex-shrink-0">
    <rect width="40" height="40" rx="10" fill="#6366F1" />
    <path d="M10 20 L20 10 L30 20 L20 30 Z" fill="white" opacity="0.9" />
    <circle cx="20" cy="20" r="4" fill="#6366F1" />
  </svg>
);

const XBullIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8 flex-shrink-0">
    <rect width="40" height="40" rx="10" fill="#0f172a" />
    <path d="M12 14 L20 26 L28 14" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 26 L20 14 L28 26" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
  </svg>
);

// ── Copy URL button ─────────────────────────────────────────────────────────
function CopyButton({ text, label = "Copy" }) {
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
      {copied ? "Copied ✓" : label}
    </button>
  );
}

// ── Address input (view-only) ───────────────────────────────────────────────
function AddressInput({ onConnect }) {
  const [addr, setAddr] = useState("");
  const [err, setErr]   = useState("");
  const valid = isValidStellarAddress(addr);

  const submit = () => {
    if (!valid) { setErr("Invalid address — must start with G, 56 characters."); return; }
    onConnect(addr.trim());
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400 font-medium block mb-1.5">
          Paste your Stellar wallet address
        </label>
        <input
          type="text"
          value={addr}
          onChange={(e) => { setAddr(e.target.value); setErr(""); }}
          placeholder="GABC…XYZ  (starts with G, 56 chars)"
          className="w-full bg-stellar-800/60 border border-stellar-700/40 rounded-xl px-3 py-2.5 text-sm text-gray-100 font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500/60"
          autoComplete="off"
          spellCheck={false}
        />
        {err  && <p className="text-xs text-red-400 mt-1">{err}</p>}
        {addr && !err && (
          <p className={`text-xs mt-1 ${valid ? "text-green-400" : "text-red-400"}`}>
            {valid ? "✓ Valid Stellar address" : "✗ Invalid — check and try again"}
          </p>
        )}
      </div>
      <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-xl px-3 py-2">
        <Eye size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300">
          <strong>View-only</strong> — see real balances &amp; rewards. Staking needs Freighter or xBull.
        </p>
      </div>
      <button
        onClick={submit}
        disabled={!valid}
        className="w-full btn-primary py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        View My Portfolio
      </button>
    </div>
  );
}

// ── Mobile Freighter guide ──────────────────────────────────────────────────
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
          ⚠️ <strong>Do NOT use Chrome/Safari</strong> — only works inside Freighter's browser tab
        </p>
      </div>
      {[
        {
          n: 1, title: "Install Freighter Mobile",
          body: "Download the official Freighter wallet",
          action: (
            <a href={storeUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors">
              <ExternalLink size={11} /> {isAndroid ? "Google Play" : "App Store"}
            </a>
          ),
        },
        {
          n: 2, title: 'Open Freighter → tap "Browser" 🌐',
          body: "Tap the globe icon in the bottom navigation",
          action: null,
        },
        {
          n: 3, title: "Paste this URL and open",
          body: "Copy the link below, paste in Freighter's address bar",
          action: (
            <div className="mt-2 bg-stellar-900/60 border border-stellar-700/40 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="font-mono text-xs text-indigo-300 flex-1 truncate">{appUrl}</span>
              <CopyButton text={appUrl} />
            </div>
          ),
        },
        {
          n: 4, title: 'Tap "Connect Wallet" — approve popup',
          body: "Freighter will ask for permission — tap Allow",
          action: null,
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

// ── Main component ──────────────────────────────────────────────────────────
export function WalletConnect({
  account, network, networkInfo,
  isConnecting, isFreighterInstalled, isXBullInstalled,
  isViewOnly, walletType, error,
  onConnect, onConnectXBull, onConnectManual, onDisconnect,
}) {
  const [showModal, setShowModal]       = useState(false);
  const [tab, setTab]                   = useState("freighter");
  const [connecting, setConnecting]     = useState(null);
  const mobile = useMemo(() => isMobile(), []);

  const shortAddr = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : null;

  const walletLabel = walletType === "xbull" ? "xBull" : walletType === "manual" ? "View Only" : "Freighter";

  // ── Connected ─────────────────────────────────────────────────────────────
  if (account) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {isViewOnly && (
          <span className="inline-flex items-center gap-1 text-xs bg-amber-900/30 border border-amber-700/40 text-amber-300 px-2 py-1 rounded-full font-medium">
            <Eye size={10} /> View Only
          </span>
        )}
        <div className="flex items-center gap-2 bg-stellar-800/50 border border-stellar-600/30 rounded-xl px-3 py-1.5">
          {walletType === "xbull"  ? <XBullIcon />     :
           walletType === "manual" ? <Eye size={14} className="text-amber-400" /> :
           <FreighterIcon />}
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

  // ── Trigger helper ────────────────────────────────────────────────────────
  const tryConnect = async (type, fn) => {
    setConnecting(type);
    const ok = await fn();
    setConnecting(null);
    if (ok) setShowModal(false);
  };

  // ── Disconnected ──────────────────────────────────────────────────────────
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isConnecting || !!connecting}
        className="btn-primary flex items-center gap-2"
      >
        {isConnecting || connecting
          ? <><Loader2 size={15} className="animate-spin" /> Connecting…</>
          : <><Wallet size={15} /> Connect Wallet</>
        }
      </button>

      {showModal && (
        <div
          className={`fixed inset-0 z-50 flex ${mobile ? "items-end" : "items-center"} justify-center p-4`}
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className={`w-full max-w-md bg-stellar-900 border border-stellar-700/50 shadow-2xl overflow-hidden ${mobile ? "rounded-t-3xl" : "rounded-2xl"}`}>

            {mobile && <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-stellar-700" /></div>}

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stellar-800/50">
              <h2 className="font-bold text-gray-100 text-base">Connect Wallet</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300 p-1.5 rounded-xl hover:bg-stellar-800/50 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stellar-800/50">
              {[
                { id: "freighter", icon: <Wallet size={12} />, label: "Freighter" },
                { id: "xbull",     icon: <XBullIcon />,        label: "xBull" },
                { id: "address",   icon: <KeyRound size={12} />, label: "Paste Address" },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    tab === t.id
                      ? t.id === "xbull" ? "text-blue-400 border-b-2 border-blue-500"
                        : t.id === "address" ? "text-amber-400 border-b-2 border-amber-500"
                        : "text-indigo-400 border-b-2 border-indigo-500"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {t.id === "xbull"
                    ? <span className="w-3 h-3 rounded bg-blue-600 inline-block flex-shrink-0" />
                    : t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto">

              {/* Error */}
              {error && tab !== "address" && (
                <div className="mb-4 flex items-start gap-2 text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2.5 text-sm">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
                </div>
              )}

              {/* ── Freighter tab ── */}
              {tab === "freighter" && (
                <div className="space-y-3">
                  {mobile && !isFreighterInstalled
                    ? <FreighterMobileGuide />
                    : null
                  }
                  {(!mobile || isFreighterInstalled) && (
                    <>
                      {!isFreighterInstalled && (
                        <div className="flex items-start gap-2 bg-indigo-900/20 border border-indigo-700/30 rounded-xl px-3 py-2.5 mb-3">
                          <AlertCircle size={13} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-indigo-300">
                            Freighter extension not detected.{" "}
                            <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="underline text-indigo-200">Install it here</a>
                            {" "}then refresh.
                          </p>
                        </div>
                      )}
                      {isFreighterInstalled && (
                        <div className="flex items-center gap-2 bg-green-900/20 border border-green-700/30 rounded-xl px-3 py-2 mb-3">
                          <CheckCircle2 size={13} className="text-green-400" />
                          <p className="text-xs text-green-300">Freighter detected ✓</p>
                        </div>
                      )}
                      <button
                        onClick={() => tryConnect("freighter", onConnect)}
                        disabled={!!connecting}
                        className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                      >
                        {connecting === "freighter"
                          ? <><Loader2 size={15} className="animate-spin" /> Connecting…</>
                          : <><Wallet size={15} /> Connect with Freighter</>
                        }
                      </button>
                      {mobile && (
                        <p className="text-xs text-center text-gray-500">
                          Not working? Use the <strong className="text-gray-400">Paste Address</strong> tab as fallback.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── xBull tab ── */}
              {tab === "xbull" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-stellar-800/30 border border-stellar-700/30 rounded-2xl p-4">
                    <XBullIcon />
                    <div>
                      <p className="text-sm font-semibold text-gray-100">xBull Wallet</p>
                      <p className="text-xs text-gray-500">Feature-rich Stellar wallet</p>
                    </div>
                  </div>

                  {isXBullInstalled
                    ? (
                      <div className="flex items-center gap-2 bg-green-900/20 border border-green-700/30 rounded-xl px-3 py-2">
                        <CheckCircle2 size={13} className="text-green-400" />
                        <p className="text-xs text-green-300">xBull detected ✓</p>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 bg-blue-900/20 border border-blue-700/30 rounded-xl px-3 py-2.5">
                        <AlertCircle size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-300">
                          xBull not detected.{" "}
                          <a href="https://xbull.app" target="_blank" rel="noopener noreferrer" className="underline text-blue-200">Install xBull</a>
                          {" "}then refresh this page.
                        </p>
                      </div>
                    )
                  }

                  <button
                    onClick={() => tryConnect("xbull", onConnectXBull)}
                    disabled={!!connecting || !isXBullInstalled}
                    className="w-full py-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                  >
                    {connecting === "xbull"
                      ? <><Loader2 size={15} className="animate-spin" /> Connecting…</>
                      : "Connect with xBull"
                    }
                  </button>

                  {!isXBullInstalled && (
                    <a
                      href="https://xbull.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 py-2"
                    >
                      <ExternalLink size={13} /> Get xBull Wallet
                    </a>
                  )}
                </div>
              )}

              {/* ── Address tab ── */}
              {tab === "address" && (
                <AddressInput onConnect={(addr) => { onConnectManual(addr); setShowModal(false); }} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
