// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./common/M2Errors.sol";

/// @title M2TreasuryVault
/// @notice Treasury that accumulates slash proceeds and serves as the arena backstop reserve.
contract M2TreasuryVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant BACKSTOP_ROLE = keccak256("BACKSTOP_ROLE");

    IERC20 public immutable stakingAsset; // immutable: treasury holds a single settlement asset chosen at deployment.

    event TreasurySeeded(address indexed from, uint256 amount);
    event BackstopProvided(address indexed receiver, uint256 roundId, uint256 requestedAmount, uint256 sentAmount);

    /// @notice Deploys the treasury vault used for bond slashes and backstop flows.
    /// @param admin Address receiving the default admin role.
    /// @param stakingAsset_ ERC-20 asset stored by treasury.
    constructor(address admin, address stakingAsset_) {
        if (admin == address(0) || stakingAsset_ == address(0)) revert ZeroAddress();
        stakingAsset = IERC20(stakingAsset_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Adds protocol-owned funds into the treasury.
    /// @param amount Treasury seed amount.
    function seedTreasury(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        stakingAsset.safeTransferFrom(msg.sender, address(this), amount);
        emit TreasurySeeded(msg.sender, amount);
    }

    /// @notice Provides an automatic backstop payout to a receiver.
    /// @param receiver Recipient of treasury funds.
    /// @param amount Desired backstop amount.
    /// @param roundId Associated round id used for accounting.
    /// @return sentAmount Actual amount transferred.
    function requestBackstop(address receiver, uint256 amount, uint256 roundId)
        external
        onlyRole(BACKSTOP_ROLE)
        nonReentrant
        returns (uint256 sentAmount)
    {
        if (receiver == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 treasuryBalance = stakingAsset.balanceOf(address(this));
        sentAmount = treasuryBalance < amount ? treasuryBalance : amount;
        if (sentAmount > 0) {
            stakingAsset.safeTransfer(receiver, sentAmount);
        }

        emit BackstopProvided(receiver, roundId, amount, sentAmount);
    }
}
