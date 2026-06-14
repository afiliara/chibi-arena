// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title IM2ReputationRegistry
/// @notice Interface for recording ERC-8004-style feedback signals for arena agents.
interface IM2ReputationRegistry {
    /// @notice Records a standardized ERC-8004-style feedback signal.
    /// @param agentId The agent identity token id.
    /// @param value Signed reputation signal value.
    /// @param valueDecimals Decimal precision used by `value`.
    /// @param tag1 Primary categorization tag.
    /// @param tag2 Secondary categorization tag.
    /// @param endpoint Human-readable endpoint/source label.
    /// @param feedbackURI Optional off-chain URI containing the rich payload.
    /// @param feedbackHash Hash of the off-chain payload or evidence.
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;
}
