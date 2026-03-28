import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import * as Sentry from "@sentry/react";

// Default ABIs for development (fallback when deployed ABIs not yet generated)
const DEFAULT_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function remainingMintable() view returns (uint256)",
  "function stakingContract() view returns (address)",
  "function paused() view returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event TokensMinted(address indexed to, uint256 amount, string reason)",
  "event CircuitBreakerTriggered(address indexed triggeredBy)",
];

const DEFAULT_STAKING_ABI = [
  "function stake(uint256 amount)",
  "function requestUnstake()",
  "function unstake()",
  "function claimRewards()",
  "function emergencyWithdraw()",
  "function pendingReward(address user) view returns (uint256)",
  "function getStakeInfo(address user) view returns (uint256 amount, uint256 stakedAt, uint256 lastClaimAt, uint256 cooldownStart, uint256 pending)",
  "function totalStaked() view returns (uint256)",
  "function totalRewardsMinted() view returns (uint256)",
  "function apyRate() view returns (uint256)",
  "function UNSTAKE_COOLDOWN() view returns (uint256)",
  "function getStakersCount() view returns (uint256)",
  "function paused() view returns (bool)",
  "event Staked(address indexed user, uint256 amount, uint256 timestamp)",
  "event UnstakeRequested(address indexed user, uint256 amount, uint256 cooldownEnd)",
  "event Unstaked(address indexed user, uint256 amount, uint256 timestamp)",
  "event RewardsClaimed(address indexed user, uint256 rewardAmount, uint256 timestamp)",
  "event EmergencyWithdraw(address indexed user, uint256 amount)",
  "event CircuitBreakerTriggered(address indexed triggeredBy)",
];

// Contract addresses — populated by deploy script, override with env vars
const ADDRESSES = {
  token: import.meta.env.VITE_TOKEN_ADDRESS || "",
  staking: import.meta.env.VITE_STAKING_ADDRESS || "",
};

export function useContract() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);
  const [stakingContract, setStakingContract] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask not detected. Please install MetaMask.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ethProvider = new ethers.BrowserProvider(window.ethereum);
      await ethProvider.send("eth_requestAccounts", []);
      const ethSigner = await ethProvider.getSigner();
      const address = await ethSigner.getAddress();
      const network = await ethProvider.getNetwork();

      setProvider(ethProvider);
      setSigner(ethSigner);
      setAccount(address);
      setChainId(network.chainId.toString());

      // Load contract ABIs (from deployed artifacts or defaults)
      let tokenAbi = DEFAULT_TOKEN_ABI;
      let stakingAbi = DEFAULT_STAKING_ABI;
      let tokenAddress = ADDRESSES.token;
      let stakingAddress = ADDRESSES.staking;

      try {
        const [tokenMeta, stakingMeta] = await Promise.all([
          import("../abis/StellarToken.json"),
          import("../abis/StellarStaking.json"),
        ]);
        tokenAbi = tokenMeta.abi || DEFAULT_TOKEN_ABI;
        stakingAbi = stakingMeta.abi || DEFAULT_STAKING_ABI;
        tokenAddress = tokenMeta.address || tokenAddress;
        stakingAddress = stakingMeta.address || stakingAddress;
      } catch {
        // ABIs not yet generated — use defaults with env-var addresses
      }

      if (tokenAddress) {
        setTokenContract(new ethers.Contract(tokenAddress, tokenAbi, ethSigner));
      }
      if (stakingAddress) {
        setStakingContract(new ethers.Contract(stakingAddress, stakingAbi, ethSigner));
      }
    } catch (err) {
      Sentry.captureException(err);
      setError(err.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setTokenContract(null);
    setStakingContract(null);
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== account) {
        connect();
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [account, connect, disconnect]);

  return {
    provider,
    signer,
    account,
    chainId,
    tokenContract,
    stakingContract,
    isConnecting,
    error,
    connect,
    disconnect,
    isConnected: !!account,
    tokenAddress: ADDRESSES.token,
    stakingAddress: ADDRESSES.staking,
  };
}
