// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StellarToken (STLR)
 * @notice ERC-20 token with minting, burning, pause, and staking-reward capabilities.
 * @dev The staking contract is granted the MINTER role so it can mint rewards
 *      without requiring a separate transferFrom the treasury — this is the primary
 *      inter-contract communication vector.
 *
 * Tokenomics:
 *   - Symbol:       STLR
 *   - Max Supply:   100,000,000 STLR  (100 million)
 *   - Initial Mint: 10,000,000 STLR   (10 million) to deployer
 *   - Staking Pool: Up to 40,000,000 STLR minted over time as rewards
 *   - Decimals:     18 (standard)
 */
contract StellarToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable {
    // ─── Constants ──────────────────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10 ** 18;
    uint256 public constant INITIAL_SUPPLY = 10_000_000 * 10 ** 18;

    // ─── State ───────────────────────────────────────────────────────────────
    address public stakingContract;
    uint256 public totalMinted;

    // ─── Events ──────────────────────────────────────────────────────────────
    event TokensMinted(address indexed to, uint256 amount, string reason);
    event StakingContractUpdated(address indexed oldContract, address indexed newContract);
    event CircuitBreakerTriggered(address indexed triggeredBy);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error ExceedsMaxSupply(uint256 requested, uint256 available);
    error NotAuthorized(address caller);
    error ZeroAddress();

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address initialOwner) ERC20("StellarToken", "STLR") Ownable(initialOwner) {
        _mint(initialOwner, INITIAL_SUPPLY);
        totalMinted = INITIAL_SUPPLY;
        emit TokensMinted(initialOwner, INITIAL_SUPPLY, "initial_supply");
    }

    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier onlyMinter() {
        if (msg.sender != owner() && msg.sender != stakingContract) {
            revert NotAuthorized(msg.sender);
        }
        _;
    }

    // ─── Owner Functions ─────────────────────────────────────────────────────

    /**
     * @notice Set the staking contract address — grants it minting rights.
     * @dev Inter-contract link: StellarStaking calls mintRewards() using this access.
     */
    function setStakingContract(address _stakingContract) external onlyOwner {
        if (_stakingContract == address(0)) revert ZeroAddress();
        address old = stakingContract;
        stakingContract = _stakingContract;
        emit StakingContractUpdated(old, _stakingContract);
    }

    /**
     * @notice Pause all token transfers (circuit breaker).
     */
    function pause() external onlyOwner {
        _pause();
        emit CircuitBreakerTriggered(msg.sender);
    }

    /**
     * @notice Unpause token transfers.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Minting ─────────────────────────────────────────────────────────────

    /**
     * @notice Mint tokens — callable by owner or the staking contract.
     * @dev This is the cross-contract call entry point: StellarStaking calls this
     *      to mint staking rewards directly to stakers.
     */
    function mintRewards(address to, uint256 amount) external onlyMinter {
        uint256 available = MAX_SUPPLY - totalSupply();
        if (amount > available) revert ExceedsMaxSupply(amount, available);
        totalMinted += amount;
        _mint(to, amount);
        emit TokensMinted(to, amount, "staking_reward");
    }

    /**
     * @notice Owner-only general mint (for treasury, partnerships, etc.).
     */
    function mint(address to, uint256 amount, string calldata reason) external onlyOwner {
        uint256 available = MAX_SUPPLY - totalSupply();
        if (amount > available) revert ExceedsMaxSupply(amount, available);
        totalMinted += amount;
        _mint(to, amount);
        emit TokensMinted(to, amount, reason);
    }

    // ─── View Helpers ────────────────────────────────────────────────────────

    function remainingMintable() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    // ─── Internal Overrides ──────────────────────────────────────────────────

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
