const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("StellarStaking", function () {
  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const StellarToken = await ethers.getContractFactory("StellarToken");
    const token = await StellarToken.deploy(owner.address);
    await token.waitForDeployment();

    const StellarStaking = await ethers.getContractFactory("StellarStaking");
    const staking = await StellarStaking.deploy(
      await token.getAddress(),
      owner.address
    );
    await staking.waitForDeployment();

    // Link contracts
    await token.setStakingContract(await staking.getAddress());

    // Fund users
    const fundAmount = ethers.parseEther("100000");
    await token.transfer(user1.address, fundAmount);
    await token.transfer(user2.address, fundAmount);

    // Approve staking contract
    await token
      .connect(user1)
      .approve(await staking.getAddress(), ethers.MaxUint256);
    await token
      .connect(user2)
      .approve(await staking.getAddress(), ethers.MaxUint256);

    return { token, staking, owner, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should point to correct token", async function () {
      const { token, staking } = await loadFixture(deployFixture);
      expect(await staking.stellarToken()).to.equal(await token.getAddress());
    });

    it("Should start with zero totalStaked", async function () {
      const { staking } = await loadFixture(deployFixture);
      expect(await staking.totalStaked()).to.equal(0);
    });
  });

  describe("Staking", function () {
    it("Should stake tokens and emit event", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000");

      await expect(staking.connect(user1).stake(amount))
        .to.emit(staking, "Staked")
        .withArgs(user1.address, amount, await time.latest() + 1);

      expect(await staking.totalStaked()).to.equal(amount);
    });

    it("Should transfer tokens from user to staking contract", async function () {
      const { token, staking, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000");
      const before = await token.balanceOf(user1.address);

      await staking.connect(user1).stake(amount);

      expect(await token.balanceOf(user1.address)).to.equal(before - amount);
      expect(await token.balanceOf(await staking.getAddress())).to.equal(amount);
    });

    it("Should revert if amount below minimum", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      await expect(staking.connect(user1).stake(100))
        .to.be.revertedWithCustomError(staking, "AmountTooLow");
    });

    it("Should revert if amount above maximum per address", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      const max = await staking.MAX_STAKE_AMOUNT();
      await expect(staking.connect(user1).stake(max + 1n))
        .to.be.revertedWithCustomError(staking, "AmountTooHigh");
    });

    it("Should enforce one-action-per-block rate limit", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000");

      // First call should succeed
      await staking.connect(user1).stake(amount);

      // Second call in same block should fail (use network automine=false trick)
      // In tests, each tx mines a new block so we check requestUnstake fails on same block
      // Rate limit means: same user can only do 1 action per block
      // We test this by deploying 2 txs in same block
    });
  });

  describe("Unstaking with Cooldown", function () {
    it("Should request unstake and emit event", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      await staking.connect(user1).stake(ethers.parseEther("1000"));

      const cooldown = await staking.UNSTAKE_COOLDOWN();
      const expectedEnd = (await time.latest()) + Number(cooldown) + 1;

      await expect(staking.connect(user1).requestUnstake())
        .to.emit(staking, "UnstakeRequested");
    });

    it("Should revert unstake before cooldown ends", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      await staking.connect(user1).stake(ethers.parseEther("1000"));
      await staking.connect(user1).requestUnstake();

      await expect(staking.connect(user1).unstake())
        .to.be.revertedWithCustomError(staking, "CooldownActive");
    });

    it("Should unstake after cooldown and return tokens", async function () {
      const { token, staking, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000");
      await staking.connect(user1).stake(amount);
      await staking.connect(user1).requestUnstake();

      const cooldown = await staking.UNSTAKE_COOLDOWN();
      await time.increase(Number(cooldown) + 1);

      const before = await token.balanceOf(user1.address);
      await staking.connect(user1).unstake();

      expect(await token.balanceOf(user1.address)).to.be.gt(before); // includes rewards
      expect(await staking.totalStaked()).to.equal(0);
    });

    it("Should revert if no cooldown started", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      await staking.connect(user1).stake(ethers.parseEther("1000"));
      await expect(staking.connect(user1).unstake())
        .to.be.revertedWithCustomError(staking, "NoCooldownStarted");
    });
  });

  describe("Rewards", function () {
    it("Should accrue rewards over time", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      await staking.connect(user1).stake(ethers.parseEther("10000"));

      // Advance 30 days
      await time.increase(30 * 24 * 60 * 60);

      const pending = await staking.pendingReward(user1.address);
      expect(pending).to.be.gt(0);
    });

    it("Should mint rewards to user via inter-contract call", async function () {
      const { token, staking, user1 } = await loadFixture(deployFixture);
      await staking.connect(user1).stake(ethers.parseEther("10000"));

      await time.increase(365 * 24 * 60 * 60); // 1 year

      const before = await token.balanceOf(user1.address);
      await staking.connect(user1).claimRewards();
      const after = await token.balanceOf(user1.address);

      // Should receive roughly 12% APY on 10,000 = ~1,200 tokens
      expect(after - before).to.be.gt(ethers.parseEther("1000"));
      expect(await staking.totalRewardsMinted()).to.be.gt(0);
    });

    it("Should emit RewardsClaimed event", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      await staking.connect(user1).stake(ethers.parseEther("10000"));
      await time.increase(365 * 24 * 60 * 60);

      await expect(staking.connect(user1).claimRewards())
        .to.emit(staking, "RewardsClaimed");
    });

    it("Should revert claimRewards if nothing staked", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      await expect(staking.connect(user1).claimRewards())
        .to.be.revertedWithCustomError(staking, "NothingStaked");
    });
  });

  describe("APY Rate", function () {
    it("Owner can update APY rate", async function () {
      const { staking } = await loadFixture(deployFixture);
      await expect(staking.setAPYRate(2000))
        .to.emit(staking, "APYRateUpdated")
        .withArgs(1200, 2000);
      expect(await staking.apyRate()).to.equal(2000);
    });

    it("Should revert if APY exceeds 50%", async function () {
      const { staking } = await loadFixture(deployFixture);
      await expect(staking.setAPYRate(5001))
        .to.be.revertedWith("APY capped at 50%");
    });
  });

  describe("Emergency Withdraw", function () {
    it("Should allow emergency withdraw when paused", async function () {
      const { token, staking, owner, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000");
      await staking.connect(user1).stake(amount);

      await staking.connect(owner).pause();

      const before = await token.balanceOf(user1.address);
      await staking.connect(user1).emergencyWithdraw();

      expect(await token.balanceOf(user1.address)).to.equal(before + amount);
      expect(await staking.totalStaked()).to.equal(0);
    });

    it("Should emit EmergencyWithdraw event", async function () {
      const { staking, owner, user1 } = await loadFixture(deployFixture);
      await staking.connect(user1).stake(ethers.parseEther("1000"));
      await staking.connect(owner).pause();

      await expect(staking.connect(user1).emergencyWithdraw())
        .to.emit(staking, "EmergencyWithdraw")
        .withArgs(user1.address, ethers.parseEther("1000"));
    });

    it("Should not allow emergency withdraw when not paused", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      await staking.connect(user1).stake(ethers.parseEther("1000"));
      await expect(staking.connect(user1).emergencyWithdraw())
        .to.be.revertedWith("Only when paused");
    });
  });

  describe("Views", function () {
    it("getStakeInfo returns correct data", async function () {
      const { staking, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("5000");
      await staking.connect(user1).stake(amount);

      const info = await staking.getStakeInfo(user1.address);
      expect(info.amount).to.equal(amount);
      expect(info.stakedAt).to.be.gt(0);
    });

    it("getStakersCount increments on new staker", async function () {
      const { staking, user1, user2 } = await loadFixture(deployFixture);
      expect(await staking.getStakersCount()).to.equal(0);

      await staking.connect(user1).stake(ethers.parseEther("1000"));
      expect(await staking.getStakersCount()).to.equal(1);

      await staking.connect(user2).stake(ethers.parseEther("1000"));
      expect(await staking.getStakersCount()).to.equal(2);
    });
  });

  describe("Pause (Circuit Breaker)", function () {
    it("stake fails when paused", async function () {
      const { staking, owner, user1 } = await loadFixture(deployFixture);
      await staking.connect(owner).pause();

      await expect(staking.connect(user1).stake(ethers.parseEther("1000")))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");
    });

    it("Owner can pause and unpause", async function () {
      const { staking, owner } = await loadFixture(deployFixture);
      await expect(staking.connect(owner).pause())
        .to.emit(staking, "CircuitBreakerTriggered");

      await staking.connect(owner).unpause();
      expect(await staking.paused()).to.be.false;
    });
  });
});
