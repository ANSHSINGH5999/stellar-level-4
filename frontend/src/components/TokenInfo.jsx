import React from "react";
import { Coins, TrendingUp, Users, Shield } from "lucide-react";
import { APY_RATE } from "../lib/stellar.js";

function fmt(value, decimals = 2) {
  const n = parseFloat(value || "0");
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(decimals)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export function TokenInfo({
  stlrBalance,
  totalStaked,
  rewardPool,
  totalStakers,
  apyRate,
}) {
  const apy = ((apyRate ?? APY_RATE) * 100).toFixed(2);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-stellar-600 flex items-center justify-center flex-shrink-0">
            <Coins size={16} />
          </div>
          <div>
            <h2 className="font-bold text-gray-100">STLR Token</h2>
            <p className="text-xs text-gray-500">Stellar Custom Asset · {apy}% APY · Testnet</p>
          </div>
        </div>

        <span className="badge badge-green">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card">
          <span className="stat-label flex items-center gap-1">
            <Coins size={10} /> Your Balance
          </span>
          <span className="stat-value">{fmt(stlrBalance)}</span>
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
          <span className="stat-value text-green-400">{apy}%</span>
          <span className="text-xs text-gray-500">Annual yield</span>
        </div>

        <div className="stat-card">
          <span className="stat-label flex items-center gap-1">
            <Users size={10} /> Stakers
          </span>
          <span className="stat-value">{totalStakers}</span>
          <span className="text-xs text-gray-500">Total stakers</span>
        </div>
      </div>

      <div className="mt-3 p-3 bg-stellar-800/30 rounded-xl text-xs text-gray-400 font-mono flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="text-gray-500">Reward pool: </span>
          <span className="text-stellar-300">{fmt(rewardPool)} STLR</span>
        </span>
        <span>
          <span className="text-gray-500">Network: </span>
          <span className="text-stellar-300">Stellar Testnet</span>
        </span>
      </div>
    </div>
  );
}
