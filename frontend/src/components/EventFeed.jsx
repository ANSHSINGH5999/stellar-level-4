import React from "react";
import {
  Activity, Lock, Unlock, Gift, Coins, AlertTriangle,
  ArrowRightLeft, Radio, Trash2, Clock
} from "lucide-react";

const EVENT_CONFIG = {
  Staked: {
    icon: Lock,
    color: "text-blue-400",
    bg: "bg-blue-900/20 border-blue-700/20",
    label: "Staked",
    format: (d) => `${parseFloat(d.amount).toFixed(4)} STLR staked by ${short(d.user)}`,
  },
  UnstakeRequested: {
    icon: Clock,
    color: "text-yellow-400",
    bg: "bg-yellow-900/20 border-yellow-700/20",
    label: "Unstake Requested",
    format: (d) =>
      `${parseFloat(d.amount).toFixed(4)} STLR • cooldown ends ${d.cooldownEnd}`,
  },
  Unstaked: {
    icon: Unlock,
    color: "text-emerald-400",
    bg: "bg-emerald-900/20 border-emerald-700/20",
    label: "Unstaked",
    format: (d) => `${parseFloat(d.amount).toFixed(4)} STLR unstaked by ${short(d.user)}`,
  },
  RewardsClaimed: {
    icon: Gift,
    color: "text-purple-400",
    bg: "bg-purple-900/20 border-purple-700/20",
    label: "Rewards Claimed",
    format: (d) => `${parseFloat(d.amount).toFixed(6)} STLR rewards by ${short(d.user)}`,
  },
  TokensMinted: {
    icon: Coins,
    color: "text-stellar-400",
    bg: "bg-stellar-900/30 border-stellar-700/20",
    label: "Tokens Minted",
    format: (d) =>
      `${parseFloat(d.amount).toFixed(4)} STLR minted to ${short(d.to)} (${d.reason})`,
  },
  Transfer: {
    icon: ArrowRightLeft,
    color: "text-gray-400",
    bg: "bg-gray-900/20 border-gray-700/20",
    label: "Transfer",
    format: (d) =>
      `${parseFloat(d.amount).toFixed(4)} STLR: ${short(d.from)} → ${short(d.to)}`,
  },
  CircuitBreakerTriggered: {
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-900/20 border-red-700/20",
    label: "Circuit Breaker",
    format: (d) => `Triggered by ${short(d.triggeredBy)}`,
  },
};

function short(addr) {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return "mint";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function EventFeed({ events, isListening, onClear }) {
  return (
    <div className="card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio
            size={14}
            className={isListening ? "text-green-400 animate-pulse" : "text-gray-500"}
          />
          <h2 className="font-bold text-gray-100">Live Events</h2>
          {events.length > 0 && (
            <span className="badge badge-blue">{events.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${isListening ? "text-green-400" : "text-gray-500"}`}
          >
            {isListening ? "Listening" : "Disconnected"}
          </span>
          {events.length > 0 && (
            <button
              onClick={onClear}
              className="text-gray-500 hover:text-gray-300 p-1 rounded transition-colors"
              title="Clear events"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Event types legend */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {["Staked", "Unstaked", "RewardsClaimed", "TokensMinted"].map((type) => {
          const cfg = EVENT_CONFIG[type];
          const Icon = cfg.icon;
          return (
            <span key={type} className={`badge border ${cfg.bg} ${cfg.color}`}>
              <Icon size={9} />
              {cfg.label}
            </span>
          );
        })}
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 max-h-96 lg:max-h-full">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Activity size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No events yet</p>
            <p className="text-xs mt-1 opacity-60">
              {isListening
                ? "Waiting for on-chain activity…"
                : "Connect your wallet to start listening"}
            </p>
          </div>
        ) : (
          events.map((evt) => {
            const cfg = EVENT_CONFIG[evt.type] || {
              icon: Activity,
              color: "text-gray-400",
              bg: "bg-gray-900/20 border-gray-700/20",
              label: evt.type,
              format: (d) => JSON.stringify(d),
            };
            const Icon = cfg.icon;

            return (
              <div
                key={evt.id}
                className={`event-row border ${cfg.bg} ${evt.historical ? "opacity-70" : ""}`}
              >
                <div className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {evt.historical && (
                      <span className="text-xs text-gray-600">(historical)</span>
                    )}
                    <span className="text-xs text-gray-600 ml-auto flex-shrink-0">
                      {timeAgo(evt.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5 break-all">
                    {cfg.format(evt.data)}
                  </p>
                  {evt.txHash && (
                    <p className="text-xs text-gray-600 font-mono mt-0.5 truncate">
                      {evt.txHash}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
