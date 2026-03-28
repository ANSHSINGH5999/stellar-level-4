import React from "react";
import { Toaster } from "react-hot-toast";
import { Star, Github, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { useContract } from "./hooks/useContract.js";
import { useEvents } from "./hooks/useEvents.js";
import { useStakingData } from "./hooks/useStakingData.js";
import { WalletConnect } from "./components/WalletConnect.jsx";
import { TokenInfo } from "./components/TokenInfo.jsx";
import { StakingPanel } from "./components/StakingPanel.jsx";
import { EventFeed } from "./components/EventFeed.jsx";

export default function App() {
  const {
    account, chainId, tokenContract, stakingContract,
    isConnecting, error: walletError, connect, disconnect,
    tokenAddress, stakingAddress,
  } = useContract();

  const stakingData = useStakingData({ tokenContract, stakingContract, account });
  const { events, isListening, clearEvents } = useEvents({
    tokenContract, stakingContract, account,
  });

  const isReady = !!(account && tokenContract && stakingContract);

  return (
    <div className="min-h-screen flex flex-col">
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

      {/* Header */}
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
            chainId={chainId}
            isConnecting={isConnecting}
            error={walletError}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">

        {/* Not connected banner */}
        {!account && (
          <div className="card flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-14 h-14 bg-stellar-700/40 rounded-full flex items-center justify-center flex-shrink-0">
              <Star size={24} className="text-stellar-400" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-100 text-lg mb-1">Welcome to Stellar DeFi</h2>
              <p className="text-gray-400 text-sm">
                Stake STLR tokens to earn <span className="text-green-400 font-semibold">12% APY</span> in
                on-chain rewards. Connect your wallet to get started.
              </p>
            </div>
            <button onClick={connect} disabled={isConnecting} className="btn-primary flex-shrink-0">
              Connect Wallet
            </button>
          </div>
        )}

        {/* Contract addresses */}
        {(tokenAddress || stakingAddress) && (
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            {tokenAddress && (
              <div className="flex items-center gap-1.5 bg-stellar-900/50 border border-stellar-700/30 rounded-lg px-3 py-1.5">
                <span className="text-gray-500">Token:</span>
                <span className="text-stellar-300">{tokenAddress.slice(0, 10)}…{tokenAddress.slice(-6)}</span>
              </div>
            )}
            {stakingAddress && (
              <div className="flex items-center gap-1.5 bg-stellar-900/50 border border-stellar-700/30 rounded-lg px-3 py-1.5">
                <span className="text-gray-500">Staking:</span>
                <span className="text-stellar-300">{stakingAddress.slice(0, 10)}…{stakingAddress.slice(-6)}</span>
              </div>
            )}
          </div>
        )}

        {/* Warning if contracts not configured */}
        {account && !tokenAddress && (
          <div className="flex items-center gap-2 text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-xl p-3 text-sm">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>
              Contract addresses not configured. Deploy contracts and set{" "}
              <code className="font-mono text-xs bg-stellar-800 px-1 rounded">VITE_TOKEN_ADDRESS</code>{" "}
              and{" "}
              <code className="font-mono text-xs bg-stellar-800 px-1 rounded">VITE_STAKING_ADDRESS</code>{" "}
              in <code className="font-mono text-xs bg-stellar-800 px-1 rounded">frontend/.env</code>.
            </span>
          </div>
        )}

        {/* Dashboard */}
        {isReady && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm text-gray-400 font-medium">Dashboard</h2>
              <button
                onClick={stakingData.refresh}
                disabled={stakingData.isLoading}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <RefreshCw size={12} className={stakingData.isLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            <TokenInfo
              tokenBalance={stakingData.tokenBalance}
              totalStaked={stakingData.totalStaked}
              totalRewardsMinted={stakingData.totalRewardsMinted}
              apyRate={stakingData.apyRate}
              stakersCount={stakingData.stakersCount}
              tokenPaused={stakingData.tokenPaused}
              stakingPaused={stakingData.stakingPaused}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <StakingPanel
                tokenContract={tokenContract}
                stakingContract={stakingContract}
                account={account}
                tokenBalance={stakingData.tokenBalance}
                stakedAmount={stakingData.stakedAmount}
                pendingReward={stakingData.pendingReward}
                cooldownEnd={stakingData.cooldownEnd}
                allowance={stakingData.allowance}
                stakingPaused={stakingData.stakingPaused}
                onRefresh={stakingData.refresh}
              />

              <EventFeed
                events={events}
                isListening={isListening}
                onClear={clearEvents}
              />
            </div>
          </>
        )}

        {/* Show event feed even when not fully ready but connected */}
        {account && !isReady && (
          <EventFeed events={events} isListening={isListening} onClear={clearEvents} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stellar-800/50 py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <span>© 2024 Stellar DeFi Platform • MIT License</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              className="flex items-center gap-1 hover:text-gray-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={12} /> GitHub
            </a>
            <a
              href="#"
              className="flex items-center gap-1 hover:text-gray-300 transition-colors"
            >
              <ExternalLink size={12} /> Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
