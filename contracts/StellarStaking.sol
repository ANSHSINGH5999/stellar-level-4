// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title IStellarToken
 * @dev Interface for the cross-contract calls into StellarToken.
 */
interface IStellarToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function mintRewards(address to, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title StellarStaking
 * @notice Staking contract that communicates with StellarToken for deposits,
 *         withdrawals, and reward minting.
 *
 * @dev Inter-contract communication pattern:
 *   1. stake()     → calls token.transferFrom(user → this)
 *   2. unstake()   → calls token.transfer(this → user)
 *   3. claimRewards() → calls token.mintRewards(user, rewardAmount)
 *
 * Reward formula:
 *   pendingReward = stakedAmount * APY_RATE * elapsedSeconds / (SECONDS_PER_YEAR * RATE_PRECISION)
 *   APY_RATE = 1200  →  12% APY  (adjustable by owner)
 */
contract StellarStaking is ReentrancyGuard, Ownable, Pausable {
    // ─── Constants ──────────────────────────────────────────────────────────
    uint256 public constant RATE_PRECISION = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant MIN_STAKE_AMOUNT = 1 * 10 ** 18; // 1 STLR
    uint256 public constant MAX_STAKE_AMOUNT = 1_000_000 * 10 ** 18; // 1M STLR per address
    uint256 public constant UNSTAKE_COOLDOWN = 3 days;

    // ─── State ───────────────────────────────────────────────────────────────
    IStellarToken public immutable stellarToken;

    uint256 public apyRate = 1200; // 12% APY in basis points
    uint256 public totalStaked;
    uint256 public totalRewardsMinted;

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 lastClaimAt;
        uint256 cooldownStart; // timestamp when unstake was requested (0 = not requested)
    }

    mapping(address => StakeInfo) public stakes;
    address[] private stakers; // for enumeration
    mapping(address => bool) private isStaker;

    // ─── Rate limiting ───────────────────────────────────────────────────────
    mapping(address => uint256) public lastActionBlock;

    // ─── Events ──────────────────────────────────────────────────────────────
    event Staked(address indexed user, uint256 amount, uint256 timestamp);
    event UnstakeRequested(address indexed user, uint256 amount, uint256 cooldownEnd);
    event Unstaked(address indexed user, uint256 amount, uint256 timestamp);
    event RewardsClaimed(address indexed user, uint256 rewardAmount, uint256 timestamp);
    event APYRateUpdated(uint256 oldRate, uint256 newRate);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event CircuitBreakerTriggered(address indexed triggeredBy);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error AmountTooLow(uint256 provided, uint256 minimum);
    error AmountTooHigh(uint256 provided, uint256 maximum);
    error NothingStaked();
    error CooldownActive(uint256 cooldownEnd);
    error NoCooldownStarted();
    error RateLimitExceeded();
    error ZeroRewards();
    error ZeroAddress();

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address _stellarToken, address initialOwner) Ownable(initialOwner) {
        if (_stellarToken == address(0)) revert ZeroAddress();
        stellarToken = IStellarToken(_stellarToken);
    }

    // ─── Rate Limiting ────────────────────────────────────────────────────────
    modifier rateLimit() {
        if (lastActionBlock[msg.sender] == block.number) revert RateLimitExceeded();
        lastActionBlock[msg.sender] = block.number;
        _;
    }

    // ─── Core Staking ─────────────────────────────────────────────────────────

    /**
     * @notice Stake STLR tokens.
     * @dev Inter-contract call #1: transferFrom user to this contract.
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused rateLimit {
        if (amount < MIN_STAKE_AMOUNT) revert AmountTooLow(amount, MIN_STAKE_AMOUNT);

        StakeInfo storage info = stakes[msg.sender];
        uint256 newTotal = info.amount + amount;
        if (newTotal > MAX_STAKE_AMOUNT) revert AmountTooHigh(newTotal, MAX_STAKE_AMOUNT);

        // Auto-claim pending rewards before adding to stake
        if (info.amount > 0) {
            _claimRewards(msg.sender);
        }

        // Cross-contract call: pull tokens from user
        stellarToken.transferFrom(msg.sender, address(this), amount);

        info.amount += amount;
        info.stakedAt = info.stakedAt == 0 ? block.timestamp : info.stakedAt;
        info.lastClaimAt = block.timestamp;
        info.cooldownStart = 0; // reset any pending cooldown

        totalStaked += amount;

        if (!isStaker[msg.sender]) {
            isStaker[msg.sender] = true;
            stakers.push(msg.sender);
        }

        emit Staked(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Request to unstake — starts the cooldown timer.
     */
    function requestUnstake() external nonReentrant whenNotPaused rateLimit {
        StakeInfo storage info = stakes[msg.sender];
        if (info.amount == 0) revert NothingStaked();

        info.cooldownStart = block.timestamp;
        emit UnstakeRequested(msg.sender, info.amount, block.timestamp + UNSTAKE_COOLDOWN);
    }

    /**
     * @notice Unstake tokens after cooldown period.
     * @dev Inter-contract call #2: transfer tokens back to user.
     *      Also triggers a reward claim before unstaking.
     */
    function unstake() external nonReentrant whenNotPaused rateLimit {
        StakeInfo storage info = stakes[msg.sender];
        if (info.amount == 0) revert NothingStaked();
        if (info.cooldownStart == 0) revert NoCooldownStarted();

        uint256 cooldownEnd = info.cooldownStart + UNSTAKE_COOLDOWN;
        if (block.timestamp < cooldownEnd) revert CooldownActive(cooldownEnd);

        // Claim any pending rewards first
        _claimRewards(msg.sender);

        uint256 amount = info.amount;
        info.amount = 0;
        info.cooldownStart = 0;
        info.stakedAt = 0;

        totalStaked -= amount;

        // Cross-contract call: send tokens back to user
        stellarToken.transfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Claim accrued staking rewards.
     * @dev Inter-contract call #3: mints new STLR tokens directly to user.
     */
    function claimRewards() external nonReentrant whenNotPaused rateLimit {
        StakeInfo storage info = stakes[msg.sender];
        if (info.amount == 0) revert NothingStaked();

        uint256 reward = _claimRewards(msg.sender);
        if (reward == 0) revert ZeroRewards();
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _claimRewards(address user) internal returns (uint256 reward) {
        reward = _pendingReward(user);
        if (reward == 0) return 0;

        stakes[user].lastClaimAt = block.timestamp;
        totalRewardsMinted += reward;

        // Cross-contract call: mint rewards to user via StellarToken
        stellarToken.mintRewards(user, reward);

        emit RewardsClaimed(user, reward, block.timestamp);
    }

    function _pendingReward(address user) internal view returns (uint256) {
        StakeInfo storage info = stakes[user];
        if (info.amount == 0) return 0;

        uint256 elapsed = block.timestamp - info.lastClaimAt;
        return (info.amount * apyRate * elapsed) / (SECONDS_PER_YEAR * RATE_PRECISION);
    }

    // ─── Emergency ────────────────────────────────────────────────────────────

    /**
     * @notice Emergency withdraw — skips cooldown, forfeits pending rewards.
     * @dev Only callable when contract is paused.
     */
    function emergencyWithdraw() external nonReentrant {
        require(paused(), "Only when paused");
        StakeInfo storage info = stakes[msg.sender];
        if (info.amount == 0) revert NothingStaked();

        uint256 amount = info.amount;
        info.amount = 0;
        info.cooldownStart = 0;
        totalStaked -= amount;

        stellarToken.transfer(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }

    // ─── Owner Functions ──────────────────────────────────────────────────────

    function setAPYRate(uint256 newRate) external onlyOwner {
        require(newRate <= 5000, "APY capped at 50%");
        uint256 old = apyRate;
        apyRate = newRate;
        emit APYRateUpdated(old, newRate);
    }

    function pause() external onlyOwner {
        _pause();
        emit CircuitBreakerTriggered(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function pendingReward(address user) external view returns (uint256) {
        return _pendingReward(user);
    }

    function getStakeInfo(address user)
        external
        view
        returns (
            uint256 amount,
            uint256 stakedAt,
            uint256 lastClaimAt,
            uint256 cooldownStart,
            uint256 pending
        )
    {
        StakeInfo storage info = stakes[user];
        return (
            info.amount,
            info.stakedAt,
            info.lastClaimAt,
            info.cooldownStart,
            _pendingReward(user)
        );
    }

    function getStakersCount() external view returns (uint256) {
        return stakers.length;
    }

    function getStakerAt(uint256 index) external view returns (address) {
        return stakers[index];
    }
}
