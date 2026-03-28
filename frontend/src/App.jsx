import React, { useState, useCallback } from "react";
import { Toaster } from "react-hot-toast";
import { Star, Github, ExternalLink, RefreshCw, Wallet, AlertTriangle, Eye } from "lucide-react";
import { useFreighter } from "./hooks/useFreighter.js";
import { useStellarData } from "./hooks/useStellarData.js";
import { useStellarStaking } from "./hooks/useStellarStaking.js";
import { useStellarEvents } from "./hooks/useStellarEvents.js";
import { WalletConnect } from "./components/WalletConnect.jsx";
import { TokenInfo } from "./components/TokenInfo.jsx";
import { StakingPanel } from "./components/StakingPanel.jsx";
import { SplashScreen } from "./components/SplashScreen.jsx";
import { EventFeed } from "./components/EventFeed.jsx";
import { APY_RATE, IS_CONFIGURED } from "./lib/stellar.js";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const onSplashDone = useCallback(() => setShowSplash(false), []);

  const freighter = useFreighter();
  const account = freighter.account;

  const data = useStellarData(account);
  const { events, isListening, clearEvents } = useStellarEvents(account);

  const ops = useStellarStaking({
    account,
    signTx: freighter.signTx,
    onRefresh: data.refresh,
  });

  return (
    <div className="min-h-screen flex flex-col">
      {showSplash && <SplashScreen onDone={onSplashDone} />}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1e1b4b",
            color: "#e2e8f0",
            border: "1px solid rgba(99,102,241,0.3)",
            fontSize: "13px",
          },
          success: { iconTheme: { primary: "#4ade80", secondary: "#1e1b4b" } },
          error: { iconTheme: { primary: "#f87171", secondary: "#1e1b4b" } },
        }}
      />

      {/* ── Header ── */}
      <header className="border-b border-stellar-800/50 bg-stellar-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-stellar-600 rounded-lg flex items-center justify-center shadow-lg shadow-stellar-900">
              <Star size={16} fill="white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-100 leading-none">Stellar DeFi</h1>
              <p className="text-xs text-gray-500">Stake • Earn • STLR</p>
            </div>
          </div>

          <WalletConnect
            account={account}
            network={freighter.network}
            networkInfo={freighter.networkInfo}
            isConnecting={freighter.isConnecting}
            isFreighterInstalled={freighter.isFreighterInstalled}
            isXBullInstalled={freighter.isXBullInstalled}
            isViewOnly={freighter.isViewOnly}
            walletType={freighter.walletType}
            error={freighter.error}
            onConnect={freighter.connect}
            onConnectXBull={freighter.connectXBull}
            onConnectManual={freighter.connectManual}
            onDisconnect={freighter.disconnect}
          />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">

        {/* Config warning — only shown when env vars are missing */}
        {!IS_CONFIGURED && (
          <div className="flex items-start gap-3 bg-yellow-900/20 border border-yellow-500/30 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-300 text-sm font-medium">Environment not configured</p>
              <p className="text-yellow-600 text-xs mt-0.5">
                Set <code className="font-mono bg-black/30 px-1 rounded">VITE_STLR_ISSUER</code> and{" "}
                <code className="font-mono bg-black/30 px-1 rounded">VITE_STAKING_ACCOUNT</code> in your
                environment, then rebuild. Run <code className="font-mono bg-black/30 px-1 rounded">npm run setup</code> locally to generate accounts.
              </p>
            </div>
          </div>
        )}

        {/* View-only banner */}
        {account && freighter.isViewOnly && (
          <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-500/30 rounded-xl px-4 py-3">
            <Eye size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-amber-300 text-sm font-medium">View-Only Mode</p>
              <p className="text-amber-600 text-xs mt-0.5">
                You can see real balances and rewards. To stake, unstake or claim — open this app in{" "}
                <strong className="text-amber-400">Freighter's browser tab</strong> and reconnect.
              </p>
            </div>
            <button
              onClick={freighter.connect}
              className="text-xs bg-amber-700/40 hover:bg-amber-700/60 border border-amber-600/40 text-amber-300 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
            >
              Connect Freighter
            </button>
          </div>
        )}

        {/* Not connected */}
        {!account && (
          <div className="card flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-14 h-14 bg-stellar-700/40 rounded-full flex items-center justify-center flex-shrink-0">
              <Star size={24} className="text-stellar-400" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-100 text-lg mb-1">Welcome to Stellar DeFi</h2>
              <p className="text-gray-400 text-sm">
                Stake <span className="text-white font-semibold">STLR tokens</span> and earn{" "}
                <span className="text-green-400 font-semibold">{(APY_RATE * 100).toFixed(0)}% APY</span> in on-chain rewards.
                Connect Freighter or paste your address to get started.
              </p>
            </div>
            <WalletConnect
              account={account}
              network={freighter.network}
              networkInfo={freighter.networkInfo}
              isConnecting={freighter.isConnecting}
              isFreighterInstalled={freighter.isFreighterInstalled}
              isXBullInstalled={freighter.isXBullInstalled}
              isViewOnly={freighter.isViewOnly}
              walletType={freighter.walletType}
              error={freighter.error}
              onConnect={freighter.connect}
              onConnectXBull={freighter.connectXBull}
              onConnectManual={freighter.connectManual}
              onDisconnect={freighter.disconnect}
            />
          </div>
        )}

        {/* Connected account card */}
        {account && (
          <div className="card flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5">
            <div className="flex items-center gap-2 flex-shrink-0">
              {freighter.isViewOnly
                ? <Eye size={18} className="text-amber-400" />
                : (
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                    <rect width="24" height="24" rx="6" fill="#6366F1" />
                    <path d="M6 12 L12 6 L18 12 L12 18 Z" fill="white" opacity="0.9" />
                    <circle cx="12" cy="12" r="2.5" fill="#6366F1" />
                  </svg>
                )
              }
              <span className="text-sm font-semibold text-gray-200">
                {freighter.walletType === "xbull" ? "xBull" : freighter.isViewOnly ? "View Only" : "Freighter"}
              </span>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">Stellar Public Key</p>
              <p className="font-mono text-sm text-gray-200 break-all leading-relaxed">
                {account}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={data.refresh}
                disabled={data.isLoading}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors bg-stellar-800/50 border border-stellar-700/30 px-2.5 py-1.5 rounded-lg"
              >
                <RefreshCw size={11} className={data.isLoading ? "animate-spin" : ""} />
                Refresh
              </button>
              <a
                href={`https://stellar.expert/explorer/${freighter.network === "PUBLIC" ? "public" : "testnet"}/account/${account}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-stellar-400 hover:text-stellar-300 bg-stellar-800/50 border border-stellar-700/30 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                <ExternalLink size={11} /> Explorer
              </a>
            </div>
          </div>
        )}

        {/* Staking Dashboard */}
        {account && (
          <>
            <TokenInfo
              stlrBalance={data.stlrBalance}
              totalStaked={data.totalStaked}
              rewardPool={data.rewardPool}
              totalStakers={data.totalStakers}
              apyRate={data.apyRate}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <StakingPanel
                stlrBalance={data.stlrBalance}
                stakedAmount={data.stakedAmount}
                pendingReward={data.pendingReward}
                cooldownEnd={data.cooldownEnd}
                hasTrust={data.hasTrust}
                ops={ops}
              />
              <EventFeed
                events={events}
                isListening={isListening}
                onClear={clearEvents}
              />
            </div>
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-stellar-800/50 py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <span>© 2025 Stellar DeFi Platform · MIT License</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-300 transition-colors"
            >
              <Github size={12} /> GitHub
            </a>
            <a
              href="https://freighter.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-300 transition-colors"
            >
              <ExternalLink size={12} /> Freighter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
