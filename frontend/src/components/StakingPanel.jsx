import React, { useState, useCallback } from "react";
import { ethers } from "ethers";
import { Loader2, Lock, Unlock, Gift, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import toast from "react-hot-toast";
import * as Sentry from "@sentry/react";

function formatCountdown(cooldownEnd) {
  if (!cooldownEnd) return null;
  const now = Date.now();
  const diff = cooldownEnd.getTime() - now;
  if (diff <= 0) return "Ready to unstake";
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${mins}m remaining`;
}

export function StakingPanel({
  tokenContract,
  stakingContract,
  account,
  tokenBalance,
  stakedAmount,
  pendingReward,
  cooldownEnd,
  allowance,
  stakingPaused,
  onRefresh,
}) {
  const [stakeAmount, setStakeAmount] = useState("");
  const [loading, setLoading] = useState(null); // 'approve' | 'stake' | 'requestUnstake' | 'unstake' | 'claim'

  const needsApproval =
    stakeAmount &&
    parseFloat(allowance) < parseFloat(stakeAmount || "0");

  const run = useCallback(
    async (label, fn) => {
      setLoading(label);
      const toastId = toast.loading(`${label}...`);
      try {
        const tx = await fn();
        await tx.wait();
        toast.success(`${label} successful!`, { id: toastId });
        onRefresh();
        if (label === "stake") setStakeAmount("");
      } catch (err) {
        Sentry.captureException(err, { tags: { action: label } });
        const msg = err?.reason || err?.shortMessage || err?.message || "Transaction failed";
        toast.error(msg.slice(0, 100), { id: toastId });
      } finally {
        setLoading(null);
      }
    },
    [onRefresh]
  );

  const handleApprove = () =>
    run("approve", () =>
      tokenContract.approve(
        stakingContract.target || stakingContract.address,
        ethers.MaxUint256
      )
    );

  const handleStake = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    run("stake", () =>
      stakingContract.stake(ethers.parseEther(stakeAmount))
    );
  };

  const handleRequestUnstake = () =>
    run("requestUnstake", () => stakingContract.requestUnstake());

  const handleUnstake = () =>
    run("unstake", () => stakingContract.unstake());

  const handleClaim = () =>
    run("claim", () => stakingContract.claimRewards());

  const setMax = () => setStakeAmount(parseFloat(tokenBalance).toFixed(4));

  const cooldownText = formatCountdown(cooldownEnd);
  const canUnstake = cooldownEnd && cooldownEnd.getTime() <= Date.now();

  return (
    <div className="card space-y-5">
      <h2 className="font-bold text-gray-100 text-lg">Staking</h2>

      {stakingPaused && (
        <div className="flex items-center gap-2 text-yellow-400 bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 text-sm">
          <AlertTriangle size={14} />
          <span>Staking is currently paused by the protocol.</span>
        </div>
      )}

      {/* Stake Section */}
      <div className="space-y-3">
        <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">
          Stake STLR
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              className="input-field pr-16"
              placeholder="0.0"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              min="0"
              step="any"
              disabled={!!loading || stakingPaused}
            />
            <button
              onClick={setMax}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stellar-400 hover:text-stellar-300 font-medium"
            >
              MAX
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Balance: <span className="text-gray-300 font-mono">{parseFloat(tokenBalance).toFixed(2)} STLR</span>
        </p>

        {needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={!!loading || stakingPaused}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading === "approve" ? (
              <><Loader2 size={14} className="animate-spin" /> Approving…</>
            ) : (
              <><CheckCircle2 size={14} /> Approve STLR</>
            )}
          </button>
        ) : (
          <button
            onClick={handleStake}
            disabled={!!loading || stakingPaused || !stakeAmount}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading === "stake" ? (
              <><Loader2 size={14} className="animate-spin" /> Staking…</>
            ) : (
              <><Lock size={14} /> Stake STLR</>
            )}
          </button>
        )}
      </div>

      {/* Current Position */}
      {parseFloat(stakedAmount) > 0 && (
        <div className="border-t border-stellar-800/50 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card">
              <span className="stat-label">Staked</span>
              <span className="stat-value text-base">{parseFloat(stakedAmount).toFixed(2)}</span>
              <span className="text-xs text-gray-500">STLR</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Pending Reward</span>
              <span className="stat-value text-base text-green-400">
                {parseFloat(pendingReward).toFixed(6)}
              </span>
              <span className="text-xs text-gray-500">STLR</span>
            </div>
          </div>

          {/* Claim */}
          <button
            onClick={handleClaim}
            disabled={!!loading || stakingPaused || parseFloat(pendingReward) === 0}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            {loading === "claim" ? (
              <><Loader2 size={14} className="animate-spin" /> Claiming…</>
            ) : (
              <><Gift size={14} /> Claim Rewards</>
            )}
          </button>

          {/* Unstake flow */}
          {!cooldownEnd ? (
            <button
              onClick={handleRequestUnstake}
              disabled={!!loading || stakingPaused}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              {loading === "requestUnstake" ? (
                <><Loader2 size={14} className="animate-spin" /> Processing…</>
              ) : (
                <><Unlock size={14} /> Request Unstake (3-day cooldown)</>
              )}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-400 bg-stellar-800/30 rounded-lg px-3 py-2">
                <Clock size={12} />
                <span>{cooldownText}</span>
              </div>
              {canUnstake && (
                <button
                  onClick={handleUnstake}
                  disabled={!!loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600"
                >
                  {loading === "unstake" ? (
                    <><Loader2 size={14} className="animate-spin" /> Unstaking…</>
                  ) : (
                    <><Unlock size={14} /> Unstake & Claim All</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
