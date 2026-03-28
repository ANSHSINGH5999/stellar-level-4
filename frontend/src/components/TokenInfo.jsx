import React from "react";
import { Coins, TrendingUp, Users, Shield } from "lucide-react";

function fmt(value, decimals = 2) {
  const n = parseFloat(value);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(decimals);
}

export function TokenInfo({
  tokenBalance,
  totalStaked,
  totalRewardsMinted,
  apyRate,
  stakersCount,
  tokenPaused,
  stakingPaused,
}) {
  const apyPercent = (apyRate / 100).toFixed(2);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-stellar-600 flex items-center justify-center">
            <Coins size={16} />
          </div>
          <div>
            <h2 className="font-bold text-gray-100">STLR Token</h2>
            <p className="text-xs text-gray-500">StellarToken • ERC-20</p>
          </div>
        </div>
        <div className="flex gap-2">
          {tokenPaused && <span className="badge badge-red">Token Paused</span>}
          {stakingPaused && <span className="badge badge-yellow">Staking Paused</span>}
          {!tokenPaused && !stakingPaused && (
            <span className="badge badge-green">Live</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card">
          <span className="stat-label flex items-center gap-1">
            <Coins size={10} /> Your Balance
          </span>
          <span className="stat-value">{fmt(tokenBalance)}</span>
          <span className="text-xs text-gray-500">STLR</span>
        </div>

        <div className="stat-card">
          <span className="stat-label flex items-center gap-1">
            <Shield size={10} /> Total Staked
          </span>
          <span className="stat-value">{fmt(totalStaked)}</span>
          <span className="text-xs text-gray-500">STLR</span>
        </div>

        <div className="stat-card">
          <span className="stat-label flex items-center gap-1">
            <TrendingUp size={10} /> APY Rate
          </span>
          <span className="stat-value text-green-400">{apyPercent}%</span>
          <span className="text-xs text-gray-500">Annual yield</span>
        </div>

        <div className="stat-card">
          <span className="stat-label flex items-center gap-1">
            <Users size={10} /> Stakers
          </span>
          <span className="stat-value">{stakersCount}</span>
          <span className="text-xs text-gray-500">Total stakers</span>
        </div>
      </div>

      <div className="mt-3 p-3 bg-stellar-800/30 rounded-xl text-xs text-gray-400 font-mono">
        <span className="text-gray-500">Rewards minted: </span>
        <span className="text-stellar-300">{fmt(totalRewardsMinted)} STLR</span>
        <span className="ml-4 text-gray-500">Max supply: </span>
        <span className="text-stellar-300">100M STLR</span>
      </div>
    </div>
  );
}
