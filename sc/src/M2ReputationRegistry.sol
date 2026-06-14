// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IM2AgentRegistry} from "./interfaces/IM2AgentRegistry.sol";
import "./common/M2Errors.sol";

/// @title M2ReputationRegistry
/// @notice ERC-8004-aligned reputation registry used to persist arena feedback signals.
contract M2ReputationRegistry is AccessControl {
    int128 private constant MAX_ABS_VALUE = 1e18;

    IM2AgentRegistry public immutable identityRegistry; // immutable: reputation signals are pinned to one identity registry at deploy time.

    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        bool isRevoked;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
    }

    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) private feedbackByAgentClient;
    mapping(uint256 => mapping(address => uint64)) private lastFeedbackIndex;
    mapping(uint256 => address[]) private clientsByAgent;
    mapping(uint256 => mapping(address => bool)) private seenClient;

    event FeedbackRecorded(
        address indexed client,
        uint256 agentId,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );
    event FeedbackRevoked(address indexed client, uint256 agentId, uint64 feedbackIndex);

    /// @notice Deploys the ERC-8004-aligned reputation registry.
    /// @param admin Address receiving the default admin role.
    /// @param identityRegistry_ Agent registry that anchors valid agent ids.
    constructor(address admin, address identityRegistry_) {
        if (admin == address(0) || identityRegistry_ == address(0)) revert ZeroAddress();
        identityRegistry = IM2AgentRegistry(identityRegistry_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Records a reputation signal for an agent.
    /// @param agentId The agent identity token id.
    /// @param value Signed feedback value.
    /// @param valueDecimals Decimal precision applied to `value`.
    /// @param tag1 Primary tag used for aggregation.
    /// @param tag2 Secondary tag used for aggregation.
    /// @param endpoint Human-readable endpoint/source label.
    /// @param feedbackURI Optional rich payload URI.
    /// @param feedbackHash Optional payload hash or evidence hash.
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        if (valueDecimals > 18 || value > MAX_ABS_VALUE || value < -MAX_ABS_VALUE) {
            revert InvalidResult();
        }
        if (identityRegistry.isAuthorizedOrOwner(msg.sender, agentId)) revert SelfFeedbackNotAllowed();

        uint64 feedbackIndex = ++lastFeedbackIndex[agentId][msg.sender];
        feedbackByAgentClient[agentId][msg.sender][feedbackIndex] = Feedback({
            value: value,
            valueDecimals: valueDecimals,
            isRevoked: false,
            tag1: tag1,
            tag2: tag2,
            endpoint: endpoint,
            feedbackURI: feedbackURI,
            feedbackHash: feedbackHash
        });

        if (!seenClient[agentId][msg.sender]) {
            seenClient[agentId][msg.sender] = true;
            clientsByAgent[agentId].push(msg.sender);
        }

        emit FeedbackRecorded(
            msg.sender, agentId, feedbackIndex, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash
        );
    }

    /// @notice Revokes a feedback entry previously posted by the caller.
    /// @param agentId The agent identity token id.
    /// @param feedbackIndex The caller-scoped feedback index to revoke.
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback storage entry = feedbackByAgentClient[agentId][msg.sender][feedbackIndex];
        if (
            feedbackIndex == 0 || bytes(entry.tag1).length == 0 && bytes(entry.tag2).length == 0
                && entry.feedbackHash == bytes32(0) && bytes(entry.endpoint).length == 0 && entry.value == 0
                && entry.valueDecimals == 0 && bytes(entry.feedbackURI).length == 0
        ) {
            revert FeedbackNotFound();
        }
        if (entry.isRevoked) revert AlreadyClaimed();
        entry.isRevoked = true;
        emit FeedbackRevoked(msg.sender, agentId, feedbackIndex);
    }

    /// @notice Reads a single feedback entry.
    /// @param agentId The agent identity token id.
    /// @param client The feedback author.
    /// @param feedbackIndex The client-scoped feedback index.
    /// @return entry Full stored feedback record.
    function readFeedback(uint256 agentId, address client, uint64 feedbackIndex)
        external
        view
        returns (Feedback memory entry)
    {
        entry = feedbackByAgentClient[agentId][client][feedbackIndex];
    }

    /// @notice Returns the highest feedback index written by a client for an agent.
    /// @param agentId The agent identity token id.
    /// @param client The feedback author.
    /// @return index Latest feedback index for the pair.
    function getLastIndex(uint256 agentId, address client) external view returns (uint64 index) {
        index = lastFeedbackIndex[agentId][client];
    }

    /// @notice Returns all client addresses that have posted feedback for an agent.
    /// @param agentId The agent identity token id.
    /// @return clients Unique feedback authors.
    function getClients(uint256 agentId) external view returns (address[] memory clients) {
        clients = clientsByAgent[agentId];
    }
}
