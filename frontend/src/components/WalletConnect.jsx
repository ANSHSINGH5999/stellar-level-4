import React, { useState, useMemo } from "react";
import {
  Wallet, LogOut, X, ExternalLink, CheckCircle2,
  Star, AlertCircle, Loader2, Smartphone, Eye, KeyRound,
} from "lucide-react";
import { isValidStellarAddress } from "../hooks/useFreighter.js";

const isMobile = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

// ── Address Input (View-Only mode) ─────────────────────────────────────────
function AddressInput({ onConnect, onClose }) {
  const [addr, setAddr]   = useState("");
  const [err, setErr]     = useState("");
  const valid = isValidStellarAddress(addr);

  const submit = () => {
    if (!valid) { setErr("Invalid address. Must start with G, 56 characters."); return; }
    onConnect(addr.trim());
    onClose?.();
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400 font-medium mb-1.5 block">
          Paste your Stellar wallet address
        </label>
        <input
          type="text"
          value={addr}
          onChange={(e) => { setAddr(e.target.value); setErr(""); }}
          placeholder="GABC…XYZ (starts with G, 56 chars)"
          className="w-full bg-stellar-800/60 border border-stellar-700/40 rounded-xl px-3 py-2.5 text-sm text-gray-100 font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500/60"
          autoComplete="off"
          spellCheck={false}
        />
        {err && <p className="text-xs text-red-400 mt-1">{err}</p>}
        {addr && !err && (
          <p className={`text-xs mt-1 ${valid ? "text-green-400" : "text-red-400"}`}>
            {valid ? "✓ Valid Stellar address" : "✗ Invalid address"}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-xl px-3 py-2">
        <Eye size={12} className="text-amber-400 flex-shrink-0" />
        <p className="text-xs text-amber-300">
          <strong>View-only mode</strong> — balances &amp; rewards visible. Staking requires Freighter.
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

const NETWORK_BADGE = {
  PUBLIC:    "badge-green",
  TESTNET:   "badge-yellow",
  FUTURENET: "badge-blue",
};

export function WalletConnect({
  account,
  network,
  networkInfo,
  isConnecting,
  isFreighterInstalled,
  isViewOnly,
  error,
  onConnect,
  onConnectManual,
  onDisconnect,
}) {
  const [showModal, setShowModal]   = useState(false);
  const [tab, setTab]               = useState("freighter"); // "freighter" | "address"
  const [connectingId, setConnectingId] = useState(null);
  const mobile = useMemo(() => isMobile(), []);

  const shortAddr = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : null;

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
          {isViewOnly
            ? <Eye size={14} className="text-amber-400 flex-shrink-0" />
            : (
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 flex-shrink-0">
                <rect width="16" height="16" rx="4" fill="#6366F1" />
                <path d="M4 8 L8 4 L12 8 L8 12 Z" fill="white" opacity="0.9" />
                <circle cx="8" cy="8" r="1.5" fill="#6366F1" />
              </svg>
            )
          }
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
          <span className="font-mono text-sm text-gray-200">{shortAddr}</span>
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

  // ── Mobile: inside Freighter browser → direct connect ─────────────────────
  if (mobile && !account && isFreighterInstalled && !isViewOnly) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={async () => { setConnectingId("freighter"); await onConnect(); setConnectingId(null); }}
            disabled={isConnecting || !!connectingId}
            className="btn-primary flex items-center gap-2"
          >
            {isConnecting || connectingId
              ? <><Loader2 size={15} className="animate-spin" /> Connecting…</>
              : <><Wallet size={15} /> Connect Freighter</>
            }
          </button>
          <button onClick={() => setShowModal(true)} className="btn-secondary px-3 py-2" title="Enter address manually">
            <KeyRound size={15} />
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-1.5 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2 text-xs text-red-400">
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        {showModal && (
          <AddressModal onConnect={onConnectManual} onClose={() => setShowModal(false)} />
        )}
      </div>
    );
  }

  // ── Disconnected state (desktop + mobile fallback) ─────────────────────────
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isConnecting || !!connectingId}
        className="btn-primary flex items-center gap-2"
      >
        {isConnecting || connectingId
          ? <><Loader2 size={15} className="animate-spin" /> Connecting…</>
          : <><Wallet size={15} /> Connect Wallet</>
        }
      </button>

      {showModal && (
        <div
          className={`fixed inset-0 z-50 flex ${mobile ? "items-end" : "items-center"} justify-center p-4`}
          style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className={`w-full max-w-md bg-stellar-900 border border-stellar-700/50 shadow-2xl overflow-hidden ${mobile ? "rounded-t-3xl" : "rounded-2xl"}`}>

            {/* Handle (mobile) */}
            {mobile && (
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-stellar-700" />
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stellar-800/50">
              <h2 className="font-bold text-gray-100 text-base">Connect Wallet</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300 p-1.5 rounded-xl hover:bg-stellar-800/50 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stellar-800/50">
              <button
                onClick={() => setTab("freighter")}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  tab === "freighter"
                    ? "text-indigo-400 border-b-2 border-indigo-500"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Wallet size={13} /> Freighter
              </button>
              <button
                onClick={() => setTab("address")}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  tab === "address"
                    ? "text-amber-400 border-b-2 border-amber-500"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <KeyRound size={13} /> Paste Address
              </button>
            </div>

            <div className="p-5">
              {/* Error */}
              {error && tab === "freighter" && (
                <div className="mb-4 flex items-start gap-2 text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2.5 text-sm">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
                </div>
              )}

              {/* Freighter tab */}
              {tab === "freighter" && (
                <div className="space-y-3">
                  {mobile && (
                    <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-amber-300 font-medium mb-1">📱 Mobile users:</p>
                      <p className="text-xs text-amber-400">Open this app inside <strong>Freighter app → Browser tab 🌐</strong>, then tap Connect.</p>
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      setConnectingId("freighter");
                      const ok = await onConnect();
                      setConnectingId(null);
                      if (ok) setShowModal(false);
                    }}
                    disabled={isConnecting || !!connectingId}
                    className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                  >
                    {isConnecting || connectingId
                      ? <><Loader2 size={15} className="animate-spin" /> Connecting…</>
                      : <><Wallet size={15} /> Connect with Freighter</>
                    }
                  </button>
                  {!isFreighterInstalled && !mobile && (
                    <a
                      href="https://freighter.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 py-2"
                    >
                      <ExternalLink size={13} /> Get Freighter Extension
                    </a>
                  )}
                </div>
              )}

              {/* Address tab */}
              {tab === "address" && (
                <AddressInput
                  onConnect={(addr) => { onConnectManual(addr); setShowModal(false); }}
                  onClose={() => setShowModal(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AddressModal({ onConnect, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-stellar-900 border border-stellar-700/50 rounded-t-3xl shadow-2xl overflow-hidden">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-stellar-700" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stellar-800/50">
          <h2 className="font-bold text-gray-100 text-base flex items-center gap-2"><KeyRound size={15} /> Paste Wallet Address</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1.5 rounded-xl"><X size={18} /></button>
        </div>
        <div className="p-5">
          <AddressInput onConnect={onConnect} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
