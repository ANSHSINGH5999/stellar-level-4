const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("StellarToken", function () {
  async function deployTokenFixture() {
    const [owner, user1, user2, staking] = await ethers.getSigners();
    const StellarToken = await ethers.getContractFactory("StellarToken");
    const token = await StellarToken.deploy(owner.address);
    await token.waitForDeployment();
    return { token, owner, user1, user2, staking };
  }

  describe("Deployment", function () {
    it("Should set correct name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.name()).to.equal("StellarToken");
      expect(await token.symbol()).to.equal("STLR");
    });

    it("Should mint initial supply to owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      const initialSupply = ethers.parseEther("10000000");
      expect(await token.balanceOf(owner.address)).to.equal(initialSupply);
    });

    it("Should set correct MAX_SUPPLY", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.MAX_SUPPLY()).to.equal(ethers.parseEther("100000000"));
    });

    it("Should emit TokensMinted on deploy", async function () {
      const [owner] = await ethers.getSigners();
      const StellarToken = await ethers.getContractFactory("StellarToken");
      const token = await StellarToken.deploy(owner.address);
      await token.waitForDeployment();
      // Verify via totalMinted which is set in constructor during mint
      expect(await token.totalMinted()).to.equal(ethers.parseEther("10000000"));
    });
  });

  describe("Staking Contract Link", function () {
    it("Should allow owner to set staking contract", async function () {
      const { token, owner, staking } = await loadFixture(deployTokenFixture);
      await expect(token.setStakingContract(staking.address))
        .to.emit(token, "StakingContractUpdated")
        .withArgs(ethers.ZeroAddress, staking.address);
      expect(await token.stakingContract()).to.equal(staking.address);
    });

    it("Should revert on zero address", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      await expect(token.setStakingContract(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(token, "ZeroAddress");
    });

    it("Should revert if non-owner sets staking contract", async function () {
      const { token, user1, staking } = await loadFixture(deployTokenFixture);
      await expect(token.connect(user1).setStakingContract(staking.address))
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("Minting", function () {
    it("Owner can mint within max supply", async function () {
      const { token, owner, user1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("1000");
      await expect(token.mint(user1.address, amount, "test"))
        .to.emit(token, "TokensMinted")
        .withArgs(user1.address, amount, "test");
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should revert if minting exceeds max supply", async function () {
      const { token, owner, user1 } = await loadFixture(deployTokenFixture);
      const excess = await token.MAX_SUPPLY();
      await expect(token.mint(user1.address, excess, "test"))
        .to.be.revertedWithCustomError(token, "ExceedsMaxSupply");
    });

    it("Staking contract can call mintRewards", async function () {
      const { token, staking, user1 } = await loadFixture(deployTokenFixture);
      await token.setStakingContract(staking.address);
      const amount = ethers.parseEther("100");
      await expect(token.connect(staking).mintRewards(user1.address, amount))
        .to.emit(token, "TokensMinted")
        .withArgs(user1.address, amount, "staking_reward");
    });

    it("Non-minter cannot call mintRewards", async function () {
      const { token, user1 } = await loadFixture(deployTokenFixture);
      await expect(token.connect(user1).mintRewards(user1.address, 100))
        .to.be.revertedWithCustomError(token, "NotAuthorized");
    });
  });

  describe("Burning", function () {
    it("User can burn their own tokens", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseEther("500");
      const before = await token.balanceOf(owner.address);
      await token.burn(burnAmount);
      expect(await token.balanceOf(owner.address)).to.equal(before - burnAmount);
    });
  });

  describe("Pause (Circuit Breaker)", function () {
    it("Owner can pause and unpause", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      await expect(token.pause()).to.emit(token, "CircuitBreakerTriggered");
      expect(await token.paused()).to.be.true;
      await token.unpause();
      expect(await token.paused()).to.be.false;
    });

    it("Transfers fail when paused", async function () {
      const { token, owner, user1 } = await loadFixture(deployTokenFixture);
      await token.pause();
      await expect(token.transfer(user1.address, 1))
        .to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("Non-owner cannot pause", async function () {
      const { token, user1 } = await loadFixture(deployTokenFixture);
      await expect(token.connect(user1).pause())
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("remainingMintable", function () {
    it("Returns correct remaining mintable amount", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      const max = await token.MAX_SUPPLY();
      const supply = await token.totalSupply();
      expect(await token.remainingMintable()).to.equal(max - supply);
    });
  });
});
