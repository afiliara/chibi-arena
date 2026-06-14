// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title IM2TreasuryVault
/// @notice Interface for treasury backstop transfers used by arena settlement.
interface IM2TreasuryVault {
    /// @notice Requests an automatic backstop payout from treasury.
    /// @param receiver The address receiving treasury funds.
    /// @param amount Desired backstop amount.
    /// @param roundId The associated round id for accounting.
    /// @return sentAmount Actual amount transferred, which may be smaller if treasury is insufficient.
    function requestBackstop(address receiver, uint256 amount, uint256 roundId) external returns (uint256 sentAmount);
}
