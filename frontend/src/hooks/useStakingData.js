import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import * as Sentry from "@sentry/react";

const POLL_INTERVAL = 15_000; // 15 seconds

export function useStakingData({ tokenContract, stakingContract, account }) {
  const [tokenBalance, setTokenBalance] = useState("0");
  const [stakedAmount, setStakedAmount] = useState("0");
  const [pendingReward, setPendingReward] = useState("0");
  const [cooldownEnd, setCooldownEnd] = useState(null);
  const [totalStaked, setTotalStaked] = useState("0");
  const [totalRewardsMinted, setTotalRewardsMinted] = useState("0");
  const [apyRate, setApyRate] = useState(1200);
  const [stakersCount, setStakersCount] = useState(0);
  const [tokenPaused, setTokenPaused] = useState(false);
  const [stakingPaused, setStakingPaused] = useState(false);
  const [allowance, setAllowance] = useState("0");
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tokenContract || !stakingContract || !account) return;

    setIsLoading(true);
    try {
      const stakingAddress = await stakingContract.getAddress();

      const [
        balance,
        stakeInfo,
        total,
        totalRewards,
        apy,
        count,
        tPaused,
        sPaused,
        allow,
      ] = await Promise.all([
        tokenContract.balanceOf(account).catch(() => 0n),
        stakingContract.getStakeInfo(account).catch(() => ({
          amount: 0n, stakedAt: 0n, lastClaimAt: 0n, cooldownStart: 0n, pending: 0n,
        })),
        stakingContract.totalStaked().catch(() => 0n),
        stakingContract.totalRewardsMinted().catch(() => 0n),
        stakingContract.apyRate().catch(() => 1200n),
        stakingContract.getStakersCount().catch(() => 0n),
        tokenContract.paused().catch(() => false),
        stakingContract.paused().catch(() => false),
        tokenContract.allowance(account, stakingAddress).catch(() => 0n),
      ]);

      setTokenBalance(ethers.formatEther(balance));
      setStakedAmount(ethers.formatEther(stakeInfo.amount));
      setPendingReward(ethers.formatEther(stakeInfo.pending));
      setTotalStaked(ethers.formatEther(total));
      setTotalRewardsMinted(ethers.formatEther(totalRewards));
      setApyRate(Number(apy));
      setStakersCount(Number(count));
      setTokenPaused(tPaused);
      setStakingPaused(sPaused);
      setAllowance(ethers.formatEther(allow));

      // Cooldown
      if (stakeInfo.cooldownStart > 0n) {
        const cooldownDuration = await stakingContract.UNSTAKE_COOLDOWN().catch(() => 259200n);
        setCooldownEnd(new Date(Number(stakeInfo.cooldownStart + cooldownDuration) * 1000));
      } else {
        setCooldownEnd(null);
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { source: "staking_data" } });
    } finally {
      setIsLoading(false);
    }
  }, [tokenContract, stakingContract, account]);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    tokenBalance,
    stakedAmount,
    pendingReward,
    cooldownEnd,
    totalStaked,
    totalRewardsMinted,
    apyRate,
    stakersCount,
    tokenPaused,
    stakingPaused,
    allowance,
    isLoading,
    refresh: fetchData,
  };
}
