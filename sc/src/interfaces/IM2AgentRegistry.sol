// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title IM2AgentRegistry
/// @notice Interface for the ERC-8004-aligned agent identity and bond registry.
interface IM2AgentRegistry {
    /// @notice Registers a user-controlled agent and pulls the initial bond.
    /// @param owner_ The creator who owns the agent identity NFT.
    /// @param agentURI The ERC-8004-compatible metadata URI for the agent.
    /// @param configHash Hash of the off-chain reasoning configuration.
    /// @param initialBond Initial bond amount denominated in the staking asset.
    /// @return agentId Newly minted ERC-8004-aligned agent identity.
    function registerCreatorAgent(address owner_, string calldata agentURI, bytes32 configHash, uint256 initialBond)
        external
        returns (uint256 agentId);

    /// @notice Registers a platform-controlled house agent.
    /// @param owner_ The address that owns the identity NFT.
    /// @param agentURI The ERC-8004-compatible metadata URI for the agent.
    /// @param configHash Hash of the off-chain reasoning configuration.
    /// @param initialBond Initial bond amount denominated in the staking asset.
    /// @return agentId Newly minted ERC-8004-aligned agent identity.
    function registerHouseAgent(address owner_, string calldata agentURI, bytes32 configHash, uint256 initialBond)
        external
        returns (uint256 agentId);

    /// @notice Increases the bond backing an agent.
    /// @param agentId The agent identity token id.
    /// @param amount Additional bond amount.
    function topUpBond(uint256 agentId, uint256 amount) external;

    /// @notice Slashes an agent's remaining bond and forwards the proceeds.
    /// @param agentId The agent identity token id.
    /// @param slashBps Slash rate in basis points, capped by registry rules.
    /// @param receiver Recipient of the slashed bond.
    /// @return slashedAmount The bond amount actually removed.
    /// @return remainingBond Updated remaining bond after slash.
    /// @return isActive Updated active status after slash.
    function slashBond(uint256 agentId, uint256 slashBps, address receiver)
        external
        returns (uint256 slashedAmount, uint256 remainingBond, bool isActive);

    /// @notice Records the latest joined round for an agent.
    /// @param agentId The agent identity token id.
    /// @param roundId The round the agent joined.
    function recordJoinRound(uint256 agentId, uint256 roundId) external;

    /// @notice Records the latest settled round for an agent.
    /// @param agentId The agent identity token id.
    /// @param roundId The round that settled.
    function recordSettlementRound(uint256 agentId, uint256 roundId) external;

    /// @notice Reads the full on-chain state tracked for an agent.
    /// @param agentId The agent identity token id.
    /// @return owner The current ERC-721 owner.
    /// @return isHouseAgent Whether the agent is platform controlled.
    /// @return isActive Whether the agent may join new rounds.
    /// @return remainingBond Current remaining bond.
    /// @return configHash Hash of the off-chain configuration.
    /// @return lastJoinedRoundId Last round joined by the agent.
    /// @return lastSettledRoundId Last settled round involving the agent.
    function getAgent(uint256 agentId)
        external
        view
        returns (
            address owner,
            bool isHouseAgent,
            bool isActive,
            uint256 remainingBond,
            bytes32 configHash,
            uint256 lastJoinedRoundId,
            uint256 lastSettledRoundId
        );

    /// @notice Checks whether a spender controls or is approved for an agent.
    /// @param spender The address being checked.
    /// @param agentId The agent identity token id.
    /// @return authorized True when the spender may manage the agent.
    function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool authorized);

    /// @notice Returns the current owner of the ERC-721 identity.
    /// @param agentId The agent identity token id.
    /// @return owner The owner address.
    function ownerOf(uint256 agentId) external view returns (address owner);
}
