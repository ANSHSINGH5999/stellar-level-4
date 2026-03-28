import React, { useState, useCallback } from "react";
import {
  Loader2, Lock, Unlock, Gift,
  CheckCircle2, Clock, Droplets,
} from "lucide-react";
import toast from "react-hot-toast";
import * as Sentry from "@sentry/react";
import { COOLDOWN_SECONDS, IS_CONFIGURED } from "../lib/stellar.js";

function formatCountdown(cooldownEnd) {
  if (!cooldownEnd || !(cooldownEnd instanceof Date) || isNaN(cooldownEnd.getTime())) return null;
  const diff = cooldownEnd.getTime() - Date.now();
  if (diff <= 0) return "Ready to unstake!";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
}

export function StakingPanel({
  stlrBalance, stakedAmount, pendingReward, cooldownEnd, hasTrust, ops,
}) {
  const [amount, setAmount]   = useState("");
  const [loading, setLoading] = useState(null);
  const [lastTx, setLastTx]   = useState(null); // { hash, label }

  const run = useCallback(async (label, fn) => {
    setLoading(label);
    setLastTx(null);
    const id = toast.loading(label + "…");
    try {
      const hash = await fn();
      toast.success(`${label} successful!`, { id });
      if (hash) setLastTx({ hash, label });
      if (label === "stake") setAmount("");
    } catch (err) {
      Sentry.captureException(err, { tags: { action: label } });
      const msg = err?.message || "Transaction failed";
      toast.error(msg.slice(0, 120), { id });
    } finally {
      setLoading(null);
    }
  }, []);

  const stakedNum  = parseFloat(stakedAmount || "0");
  const balNum     = parseFloat(stlrBalance  || "0");
  const rewardNum  = parseFloat(pendingReward || "0");
  const amountNum  = parseFloat(amount       || "0");

  const cooldownText = formatCountdown(cooldownEnd);
  const canUnstake = cooldownEnd instanceof Date &&
    !isNaN(cooldownEnd.getTime()) &&
    cooldownEnd.getTime() <= Date.now();

  if (!IS_CONFIGURED) {
    return (
      <div className="card space-y-3">
        <h2 className="font-bold text-gray-100 text-lg">Staking</h2>
        <div className="border border-yellow-500/30 bg-yellow-900/10 rounded-xl p-4 text-center">
          <p className="text-yellow-300 text-sm font-medium mb-1">App not configured</p>
          <p className="text-yellow-600 text-xs">
            <code className="font-mono bg-black/30 px-1 rounded">VITE_STLR_ISSUER</code> is missing.
            Add environment variables in Vercel and redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-5">
      <h2 className="font-bold text-gray-100 text-lg">Staking</h2>

      {/* ── Trustline ── */}
      {!hasTrust && (
        <div className="space-y-3 border border-stellar-600/30 bg-stellar-800/20 rounded-xl p-4">
          <p className="text-sm text-gray-300 font-medium">Step 1 — Activate STLR wallet</p>
          <p className="text-xs text-gray-500">You need a STLR trustline before you can receive or stake tokens.</p>
          <button
            onClick={() => run("activate", ops.establishTrustline)}
            disabled={!!loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading === "activate"
              ? <><Loader2 size={14} className="animate-spin" /> Activating…</>
              : <><CheckCircle2 size={14} /> Activate STLR Wallet</>}
          </button>
        </div>
      )}

      {/* ── Faucet ── */}
      {hasTrust && balNum < 1 && stakedNum === 0 && (
        <div className="space-y-3 border border-blue-600/30 bg-blue-900/10 rounded-xl p-4">
          <p className="text-sm text-gray-300 font-medium">Step 2 — Get test STLR</p>
          <p className="text-xs text-gray-500">Receive 10,000 STLR from the testnet faucet to start staking.</p>
          <button
            onClick={() => run("faucet", ops.requestFaucet)}
            disabled={!!loading}
            className="btn-primary w-full flex items-center justify-center gap-2 !bg-blue-700 hover:!bg-blue-600"
          >
            {loading === "faucet"
              ? <><Loader2 size={14} className="animate-spin" /> Requesting…</>
              : <><Droplets size={14} /> Get 10,000 STLR (Testnet Faucet)</>}
          </button>
        </div>
      )}

      {/* ── Stake ── */}
      {hasTrust && (
        <div className="space-y-3">
          <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">
            Stake STLR
          </label>
          <div className="relative">
            <input
              type="number"
              className="input-field pr-16"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="any"
              disabled={!!loading || balNum <= 0}
            />
            <button
              onClick={() => setAmount(balNum.toFixed(7))}
              disabled={balNum <= 0}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stellar-400 hover:text-stellar-300 font-medium disabled:opacity-40"
            >
              MAX
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Balance:{" "}
            <span className="text-gray-300 font-mono">
              {balNum.toLocaleString(undefined, { maximumFractionDigits: 2 })} STLR
            </span>
          </p>
          <button
            onClick={() => run("stake", () => ops.stake(parseFloat(amount).toFixed(7)))}
            disabled={!!loading || amountNum <= 0 || amountNum > balNum}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading === "stake"
              ? <><Loader2 size={14} className="animate-spin" /> Staking…</>
              : <><Lock size={14} /> Stake STLR</>}
          </button>
        </div>
      )}

      {/* ── Current Position ── */}
      {stakedNum > 0 && (
        <div className="border-t border-stellar-800/50 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card">
              <span className="stat-label">Staked</span>
              <span className="stat-value text-base">
                {stakedNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-gray-500">STLR</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Pending Reward</span>
              <span className="stat-value text-base text-green-400">
                {rewardNum.toFixed(6)}
              </span>
              <span className="text-xs text-gray-500">STLR · live</span>
            </div>
          </div>

          {/* Claim */}
          <button
            onClick={() => run("claim", () => ops.claimRewards(pendingReward))}
            disabled={!!loading || rewardNum < 0.000001}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            {loading === "claim"
              ? <><Loader2 size={14} className="animate-spin" /> Claiming…</>
              : <><Gift size={14} /> Claim Rewards</>}
          </button>

          {/* Unstake flow */}
          {!cooldownEnd ? (
            <button
              onClick={() => run("request-unstake", ops.requestUnstake)}
              disabled={!!loading}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              {loading === "request-unstake"
                ? <><Loader2 size={14} className="animate-spin" /> Processing…</>
                : <><Unlock size={14} /> Request Unstake (3-day cooldown)</>}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-400 bg-stellar-800/30 rounded-lg px-3 py-2">
                <Clock size={12} />
                <span>{cooldownText || "Cooldown active"}</span>
              </div>
              {canUnstake && (
                <button
                  onClick={() => run("unstake", () => ops.unstake(stakedAmount, pendingReward))}
                  disabled={!!loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 !bg-emerald-700 hover:!bg-emerald-600"
                >
                  {loading === "unstake"
                    ? <><Loader2 size={14} className="animate-spin" /> Unstaking…</>
                    : <><Unlock size={14} /> Unstake & Claim All</>}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Last Transaction ID ── */}
      {lastTx && (
        <div className="border-t border-white/10 pt-4 space-y-1">
          <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Last Transaction</p>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <CheckCircle2 size={12} className="text-green-400 flex-shrink-0" />
            <span className="text-xs text-white/50 capitalize">{lastTx.label}</span>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${lastTx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto font-mono text-xs text-white/60 hover:text-white transition-colors truncate"
              title={lastTx.hash}
            >
              {lastTx.hash.slice(0, 12)}…{lastTx.hash.slice(-8)}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
