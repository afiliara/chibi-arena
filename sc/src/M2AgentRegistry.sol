// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./common/M2Errors.sol";

/// @title M2AgentRegistry
/// @notice ERC-8004-aligned agent identity registry with bond accounting for the arena.
contract M2AgentRegistry is AccessControl, ERC721URIStorage, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    string private constant AGENT_WALLET_KEY = "agentWallet";

    IERC20 public immutable stakingAsset; // immutable: single bond asset is fixed for the registry lifecycle.
    uint256 public immutable minimumActiveBond; // immutable: minimum active bond is a deployment invariant for all agents.

    struct Agent {
        bool isHouseAgent;
        bool isActive;
        uint256 remainingBond;
        bytes32 configHash;
        uint256 lastJoinedRoundId;
        uint256 lastSettledRoundId;
    }

    uint256 public lastAgentId;

    mapping(uint256 => Agent) private agents;
    mapping(uint256 => mapping(string => bytes)) private metadata;

    event AgentRegistered(
        address indexed owner, uint256 agentId, bool isHouseAgent, uint256 initialBond, string agentURI
    );
    event BondToppedUp(address indexed caller, uint256 agentId, uint256 amount, uint256 newRemainingBond);
    event BondSlashed(
        address indexed receiver, uint256 agentId, uint256 slashBps, uint256 slashedAmount, uint256 remainingBond
    );
    event AgentURIUpdated(address indexed caller, uint256 agentId, string newURI);
    event AgentMetadataUpdated(address indexed caller, uint256 agentId, string metadataKey, bytes metadataValue);
    event AgentWalletUpdated(address indexed caller, uint256 agentId, address agentWallet);
    event AgentActiveStatusUpdated(address indexed caller, uint256 agentId, bool isActive);
    event RoundJoinRecorded(uint256 agentId, uint256 roundId);
    event RoundSettlementRecorded(uint256 agentId, uint256 roundId);

    /// @notice Deploys the ERC-8004-aligned identity registry used by the arena.
    /// @param admin The address receiving the default admin role.
    /// @param stakingAsset_ ERC-20 asset used for creator bonds.
    /// @param minimumActiveBond_ Minimum bond required for an agent to remain active.
    constructor(address admin, address stakingAsset_, uint256 minimumActiveBond_)
        ERC721("M2 Agent Identity", "M2AGENT")
    {
        if (admin == address(0) || stakingAsset_ == address(0)) {
            revert ZeroAddress();
        }
        stakingAsset = IERC20(stakingAsset_);
        minimumActiveBond = minimumActiveBond_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Registers a user-controlled agent and pulls the initial bond from the owner.
    /// @param owner_ The creator who owns the identity NFT.
    /// @param agentURI The ERC-8004 metadata URI for the agent.
    /// @param configHash Hash of the agent's off-chain configuration.
    /// @param initialBond Initial bond amount denominated in the staking asset.
    /// @return agentId Newly minted agent identity token id.
    function registerCreatorAgent(address owner_, string calldata agentURI, bytes32 configHash, uint256 initialBond)
        external
        onlyRole(REGISTRAR_ROLE)
        nonReentrant
        returns (uint256 agentId)
    {
        if (owner_ == address(0)) revert ZeroAddress();
        if (initialBond < minimumActiveBond) revert BondBelowMinimum();
        agentId = _registerAgent(owner_, agentURI, configHash, initialBond, false);
    }

    /// @notice Registers a platform-controlled house agent.
    /// @param owner_ The address that owns the identity NFT.
    /// @param agentURI The ERC-8004 metadata URI for the agent.
    /// @param configHash Hash of the agent's off-chain configuration.
    /// @param initialBond Initial bond amount denominated in the staking asset.
    /// @return agentId Newly minted agent identity token id.
    function registerHouseAgent(address owner_, string calldata agentURI, bytes32 configHash, uint256 initialBond)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        returns (uint256 agentId)
    {
        if (owner_ == address(0)) revert ZeroAddress();
        agentId = _registerAgent(owner_, agentURI, configHash, initialBond, true);
    }

    /// @notice Increases the remaining bond of an existing agent.
    /// @param agentId The agent identity token id.
    /// @param amount Additional bond amount.
    function topUpBond(uint256 agentId, uint256 amount) external nonReentrant {
        if (!_exists(agentId)) revert InvalidAgent();
        if (amount == 0) revert ZeroAmount();
        if (!_isApprovedOrOwner(msg.sender, agentId)) revert Unauthorized();

        stakingAsset.safeTransferFrom(msg.sender, address(this), amount);

        Agent storage agent = agents[agentId];
        agent.remainingBond += amount;
        if (agent.remainingBond >= minimumActiveBond) {
            agent.isActive = true;
        }

        emit BondToppedUp(msg.sender, agentId, amount, agent.remainingBond);
        emit AgentActiveStatusUpdated(msg.sender, agentId, agent.isActive);
    }

    /// @notice Slashes an agent's bond and forwards the slashed funds.
    /// @param agentId The agent identity token id.
    /// @param slashBps Slash rate expressed in basis points against the remaining bond.
    /// @param receiver Recipient that receives the slashed bond proceeds.
    /// @return slashedAmount Actual amount removed from the bond.
    /// @return remainingBond Updated remaining bond after slash.
    /// @return isActive Updated active status after slash.
    function slashBond(uint256 agentId, uint256 slashBps, address receiver)
        external
        onlyRole(SLASHER_ROLE)
        nonReentrant
        returns (uint256 slashedAmount, uint256 remainingBond, bool isActive)
    {
        if (!_exists(agentId)) revert InvalidAgent();
        if (receiver == address(0)) revert ZeroAddress();

        Agent storage agent = agents[agentId];
        uint256 effectiveSlashBps = slashBps > 2_000 ? 2_000 : slashBps;
        if (effectiveSlashBps == 0 || agent.remainingBond == 0) {
            return (0, agent.remainingBond, agent.isActive);
        }

        slashedAmount = (agent.remainingBond * effectiveSlashBps) / 10_000;
        if (slashedAmount == 0) {
            slashedAmount = 1;
        }
        if (slashedAmount > agent.remainingBond) {
            slashedAmount = agent.remainingBond;
        }

        agent.remainingBond -= slashedAmount;
        if (!agent.isHouseAgent && agent.remainingBond < minimumActiveBond) {
            agent.isActive = false;
        }

        stakingAsset.safeTransfer(receiver, slashedAmount);

        emit BondSlashed(receiver, agentId, effectiveSlashBps, slashedAmount, agent.remainingBond);
        emit AgentActiveStatusUpdated(msg.sender, agentId, agent.isActive);

        return (slashedAmount, agent.remainingBond, agent.isActive);
    }

    /// @notice Updates the ERC-8004 URI attached to an agent identity.
    /// @param agentId The agent identity token id.
    /// @param newURI New metadata URI.
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        if (!_isApprovedOrOwner(msg.sender, agentId)) revert Unauthorized();
        _setTokenURI(agentId, newURI);
        emit AgentURIUpdated(msg.sender, agentId, newURI);
    }

    /// @notice Sets arbitrary on-chain metadata for an agent.
    /// @param agentId The agent identity token id.
    /// @param metadataKey Metadata key to update.
    /// @param metadataValue Raw metadata payload.
    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external {
        if (!_isApprovedOrOwner(msg.sender, agentId)) revert Unauthorized();
        if (_isReservedMetadataKey(metadataKey)) revert ReservedMetadataKey();
        metadata[agentId][metadataKey] = metadataValue;
        emit AgentMetadataUpdated(msg.sender, agentId, metadataKey, metadataValue);
    }

    /// @notice Reads arbitrary on-chain metadata stored for an agent.
    /// @param agentId The agent identity token id.
    /// @param metadataKey Metadata key to read.
    /// @return metadataValue Raw metadata payload.
    function getMetadata(uint256 agentId, string calldata metadataKey)
        external
        view
        returns (bytes memory metadataValue)
    {
        return metadata[agentId][metadataKey];
    }

    /// @notice Sets the agent wallet helper field used by off-chain consumers.
    /// @param agentId The agent identity token id.
    /// @param agentWallet New wallet associated with the agent.
    function setAgentWallet(uint256 agentId, address agentWallet) external {
        if (!_isApprovedOrOwner(msg.sender, agentId)) revert Unauthorized();
        if (agentWallet == address(0)) revert ZeroAddress();
        metadata[agentId][AGENT_WALLET_KEY] = abi.encodePacked(agentWallet);
        emit AgentWalletUpdated(msg.sender, agentId, agentWallet);
    }

    /// @notice Returns the wallet associated with an agent identity.
    /// @param agentId The agent identity token id.
    /// @return agentWallet Current wallet recorded for the agent.
    function getAgentWallet(uint256 agentId) external view returns (address agentWallet) {
        bytes memory rawWallet = metadata[agentId][AGENT_WALLET_KEY];
        if (rawWallet.length == 20) {
            agentWallet = address(bytes20(rawWallet));
        }
    }

    /// @notice Records the latest round joined by an agent.
    /// @param agentId The agent identity token id.
    /// @param roundId The round the agent joined.
    function recordJoinRound(uint256 agentId, uint256 roundId) external onlyRole(REGISTRAR_ROLE) {
        if (!_exists(agentId)) revert InvalidAgent();
        agents[agentId].lastJoinedRoundId = roundId;
        emit RoundJoinRecorded(agentId, roundId);
    }

    /// @notice Records the latest settled round for an agent.
    /// @param agentId The agent identity token id.
    /// @param roundId The round that settled.
    function recordSettlementRound(uint256 agentId, uint256 roundId) external onlyRole(SLASHER_ROLE) {
        if (!_exists(agentId)) revert InvalidAgent();
        agents[agentId].lastSettledRoundId = roundId;
        emit RoundSettlementRecorded(agentId, roundId);
    }

    /// @notice Reads the full tracked state of an agent.
    /// @param agentId The agent identity token id.
    /// @return owner The ERC-721 owner.
    /// @return isHouseAgent Whether the agent is platform-controlled.
    /// @return isActive Whether the agent may join new rounds.
    /// @return remainingBond Bond currently backing the agent.
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
        )
    {
        if (!_exists(agentId)) revert InvalidAgent();
        Agent memory agent = agents[agentId];
        return (
            ownerOf(agentId),
            agent.isHouseAgent,
            agent.isActive,
            agent.remainingBond,
            agent.configHash,
            agent.lastJoinedRoundId,
            agent.lastSettledRoundId
        );
    }

    /// @notice Checks whether a spender controls or is approved for an agent.
    /// @param spender The address being checked.
    /// @param agentId The agent identity token id.
    /// @return authorized True when the spender may manage the agent.
    function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool authorized) {
        authorized = _isApprovedOrOwner(spender, agentId);
    }

    function _registerAgent(
        address owner_,
        string calldata agentURI,
        bytes32 configHash,
        uint256 initialBond,
        bool isHouseAgent
    ) internal returns (uint256 agentId) {
        if (bytes(agentURI).length == 0) revert InvalidAgent();

        agentId = ++lastAgentId;
        _safeMint(owner_, agentId);
        _setTokenURI(agentId, agentURI);

        if (initialBond > 0) {
            stakingAsset.safeTransferFrom(owner_, address(this), initialBond);
        }

        Agent storage agent = agents[agentId];
        agent.isHouseAgent = isHouseAgent;
        agent.isActive = isHouseAgent || initialBond >= minimumActiveBond;
        agent.remainingBond = initialBond;
        agent.configHash = configHash;

        metadata[agentId][AGENT_WALLET_KEY] = abi.encodePacked(owner_);

        emit AgentRegistered(owner_, agentId, isHouseAgent, initialBond, agentURI);
        emit AgentWalletUpdated(owner_, agentId, owner_);
        emit AgentActiveStatusUpdated(owner_, agentId, agent.isActive);
    }

    function _isReservedMetadataKey(string calldata metadataKey) internal pure returns (bool isReserved) {
        isReserved = keccak256(bytes(metadataKey)) == keccak256(bytes(AGENT_WALLET_KEY));
    }

    /// @notice Exposes ERC-165 support for both ERC-721 and AccessControl interfaces.
    /// @param interfaceId Interface selector being queried.
    /// @return supported True when the interface is implemented.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl, ERC721URIStorage)
        returns (bool supported)
    {
        supported = super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
        if (from != address(0) && to != address(0)) {
            metadata[firstTokenId][AGENT_WALLET_KEY] = abi.encodePacked(to);
            emit AgentWalletUpdated(to, firstTokenId, to);
        }
    }
}
