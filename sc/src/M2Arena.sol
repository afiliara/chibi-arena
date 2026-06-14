// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IM2AgentRegistry} from "./interfaces/IM2AgentRegistry.sol";
import {IM2ReputationRegistry} from "./interfaces/IM2ReputationRegistry.sol";
import {IM2TreasuryVault} from "./interfaces/IM2TreasuryVault.sol";
import "./common/M2Errors.sol";

/// @title M2Arena
/// @notice Round-based staking and settlement contract for the M2 Gamified Agent arena.
contract M2Arena is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ROUND_OPERATOR_ROLE = keccak256("ROUND_OPERATOR_ROLE");

    uint256 private constant CREATOR_REWARD_BPS = 1_500;
    uint256 private constant MAX_BOND_SLASH_BPS = 2_000;
    uint256 private constant MIN_PARTICIPANTS = 4;

    IERC20 public immutable STAKING_ASSET; // immutable: the arena settles a single ERC-20 asset for all rounds.
    IM2AgentRegistry public immutable AGENT_REGISTRY; // immutable: the arena is permanently bound to one ERC-8004-aligned identity registry.
    IM2ReputationRegistry public immutable REPUTATION_REGISTRY; // immutable: reputation writes are pinned to one registry deployment.
    IM2TreasuryVault public immutable TREASURY_VAULT; // immutable: backstop and slash flows are routed to one treasury vault.
    address public immutable VALIDATION_REGISTRY; // immutable: validation integrations are anchored to a single registry deployment.

    enum RoundStatus {
        NONE,
        OPEN,
        LOCKED,
        SETTLED
    }

    struct Round {
        RoundStatus status;
        uint64 stakeOpenAt;
        uint64 stakeCloseAt;
        uint32 participantCount;
        uint256 totalStaked;
        uint256 losingPool;
        uint256 treasuryTopUpUsed;
        uint256 backstopCap;
        bytes32 resultHash;
        uint256[3] winnerAgentIds;
    }

    struct RoundAgentState {
        bool joined;
        bool isHouseAgent;
        bool isWinner;
        bool creatorClaimed;
        address creator;
        uint8 rank;
        int32 finalPnlBps;
        uint16 bondSlashBps;
        uint256 bondSlashed;
        uint256 totalStake;
        uint256 winnerBucket;
        uint256 stakerRewardPool;
        uint256 creatorReward;
    }

    uint256 public currentOpenRoundId;
    uint256 public lastRoundId;

    mapping(uint256 => Round) private rounds;
    mapping(uint256 => uint256[]) private roundParticipants;
    mapping(uint256 => mapping(uint256 => RoundAgentState)) private roundAgentStates;
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) private stakePositions;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) private stakerClaims;

    event RoundOpened(
        address indexed operator, uint256 roundId, uint64 stakeOpenAt, uint64 stakeCloseAt, uint256 backstopCap
    );
    event RoundLocked(address indexed operator, uint256 roundId);
    event AgentCreatedAndJoined(address indexed creator, uint256 roundId, uint256 agentId, uint256 initialBond);
    event AgentJoinedRound(address indexed caller, uint256 roundId, uint256 agentId, address creator);
    event StakePlaced(
        address indexed staker, uint256 roundId, uint256 agentId, uint256 requestedAmount, uint256 receivedAmount
    );
    event RoundSettled(
        address indexed operator, uint256 roundId, bytes32 resultHash, uint256 losingPool, uint256 treasuryTopUpUsed
    );
    event StakerClaimed(address indexed staker, uint256 roundId, uint256 agentId, uint256 payout);
    event CreatorClaimed(address indexed creator, uint256 roundId, uint256 agentId, uint256 payout);
    event TreasuryRedirected(
        address indexed recipient, uint256 roundId, uint256 agentId, uint256 amount, string reason
    );
    event BackstopShortfall(address indexed operator, uint256 roundId, uint256 requestedAmount, uint256 receivedAmount);

    /// @notice Deploys the arena settlement contract.
    /// @param admin Address receiving the default admin role.
    /// @param operator Address allowed to open, lock, and settle rounds.
    /// @param stakingAsset_ ERC-20 asset used for staking and payouts.
    /// @param agentRegistry_ ERC-8004-aligned identity registry.
    /// @param reputationRegistry_ ERC-8004-aligned reputation registry.
    /// @param validationRegistry_ Validation registry address retained for future integrations.
    /// @param treasuryVault_ Treasury vault handling slash proceeds and backstop flows.
    constructor(
        address admin,
        address operator,
        address stakingAsset_,
        address agentRegistry_,
        address reputationRegistry_,
        address validationRegistry_,
        address treasuryVault_
    ) {
        if (
            admin == address(0) || operator == address(0) || stakingAsset_ == address(0) || agentRegistry_ == address(0)
                || reputationRegistry_ == address(0) || validationRegistry_ == address(0)
                || treasuryVault_ == address(0)
        ) revert ZeroAddress();

        STAKING_ASSET = IERC20(stakingAsset_);
        AGENT_REGISTRY = IM2AgentRegistry(agentRegistry_);
        REPUTATION_REGISTRY = IM2ReputationRegistry(reputationRegistry_);
        VALIDATION_REGISTRY = validationRegistry_;
        TREASURY_VAULT = IM2TreasuryVault(treasuryVault_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ROUND_OPERATOR_ROLE, operator);
    }

    /// @notice Opens a new staking round and seeds it with house agents.
    /// @param stakeOpenAt Timestamp when staking becomes available.
    /// @param stakeCloseAt Timestamp when staking closes.
    /// @param backstopCap Maximum treasury top-up permitted for the round.
    /// @param houseAgentIds Seeded house agents that keep the arena populated.
    /// @return roundId Newly opened round id.
    function openRound(uint64 stakeOpenAt, uint64 stakeCloseAt, uint256 backstopCap, uint256[] calldata houseAgentIds)
        external
        onlyRole(ROUND_OPERATOR_ROLE)
        whenNotPaused
        returns (uint256 roundId)
    {
        if (currentOpenRoundId != 0) revert InvalidRoundStatus();
        if (stakeCloseAt <= stakeOpenAt) revert InvalidTimestamp();
        if (houseAgentIds.length < MIN_PARTICIPANTS) revert MinimumParticipantsNotMet();

        roundId = ++lastRoundId;
        currentOpenRoundId = roundId;

        Round storage round = rounds[roundId];
        round.status = RoundStatus.OPEN;
        round.stakeOpenAt = stakeOpenAt;
        round.stakeCloseAt = stakeCloseAt;
        round.backstopCap = backstopCap;

        for (uint256 i; i < houseAgentIds.length; i++) {
            _joinAgent(roundId, houseAgentIds[i], address(0), true);
        }

        emit RoundOpened(msg.sender, roundId, stakeOpenAt, stakeCloseAt, backstopCap);
    }

    /// @notice Creates a new user agent through the registry and auto-joins the current open round.
    /// @param agentURI ERC-8004 metadata URI for the new agent.
    /// @param configHash Hash of the off-chain agent configuration.
    /// @param initialBond Initial creator bond denominated in the staking asset.
    /// @return agentId Newly minted agent identity token id.
    /// @return roundId Current open round joined by the new agent.
    function createAgentAndJoinCurrentRound(string calldata agentURI, bytes32 configHash, uint256 initialBond)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 agentId, uint256 roundId)
    {
        roundId = currentOpenRoundId;
        if (!_isRoundOpenForStaking(roundId)) revert RoundNotOpen();

        agentId = AGENT_REGISTRY.registerCreatorAgent(msg.sender, agentURI, configHash, initialBond);
        _joinAgent(roundId, agentId, msg.sender, false);

        emit AgentCreatedAndJoined(msg.sender, roundId, agentId, initialBond);
    }

    /// @notice Adds an already registered agent into the current open round.
    /// @param agentId Existing agent identity token id.
    function joinOpenRound(uint256 agentId) external whenNotPaused {
        uint256 roundId = currentOpenRoundId;
        if (!_isRoundOpenForStaking(roundId)) revert RoundNotOpen();
        if (!AGENT_REGISTRY.isAuthorizedOrOwner(msg.sender, agentId)) revert Unauthorized();
        _joinAgent(roundId, agentId, msg.sender, false);
    }

    /// @notice Stakes the arena settlement asset on a joined agent in the active round.
    /// @param agentId Agent being supported by the staker.
    /// @param amount Requested stake amount.
    function stake(uint256 agentId, uint256 amount) external whenNotPaused nonReentrant {
        uint256 roundId = currentOpenRoundId;
        if (!_isRoundOpenForStaking(roundId)) revert RoundNotOpen();
        if (amount == 0) revert ZeroAmount();

        RoundAgentState storage agentState = roundAgentStates[roundId][agentId];
        if (!agentState.joined) revert AgentNotInRound();

        uint256 balanceBefore = STAKING_ASSET.balanceOf(address(this));
        STAKING_ASSET.safeTransferFrom(msg.sender, address(this), amount);
        uint256 receivedAmount = STAKING_ASSET.balanceOf(address(this)) - balanceBefore;
        if (receivedAmount == 0) revert ZeroAmount();

        stakePositions[roundId][agentId][msg.sender] += receivedAmount;
        agentState.totalStake += receivedAmount;
        rounds[roundId].totalStaked += receivedAmount;

        emit StakePlaced(msg.sender, roundId, agentId, amount, receivedAmount);
    }

    /// @notice Locks the current open round and prevents further joins or stakes.
    /// @param roundId Round being locked.
    function lockRound(uint256 roundId) external onlyRole(ROUND_OPERATOR_ROLE) whenNotPaused {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.OPEN) revert InvalidRoundStatus();
        if (round.participantCount < MIN_PARTICIPANTS) revert MinimumParticipantsNotMet();

        round.status = RoundStatus.LOCKED;
        if (currentOpenRoundId == roundId) {
            currentOpenRoundId = 0;
        }

        emit RoundLocked(msg.sender, roundId);
    }

    /// @notice Submits final round results, applies bond slash, and finalizes settlement.
    /// @param roundId Round being settled.
    /// @param agentIds Ordered participant list for the result payload.
    /// @param ranks Deterministic unique ranks corresponding to `agentIds`.
    /// @param finalPnlBps Final PnL for each agent, expressed in basis points.
    /// @param resultHash Hash of the off-chain execution artifact.
    function submitRoundResult(
        uint256 roundId,
        uint256[] calldata agentIds,
        uint256[] calldata ranks,
        int256[] calldata finalPnlBps,
        bytes32 resultHash
    ) external onlyRole(ROUND_OPERATOR_ROLE) whenNotPaused nonReentrant {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.LOCKED) revert RoundNotLocked();
        if (round.resultHash != bytes32(0)) revert ResultAlreadySubmitted();
        if (
            agentIds.length != ranks.length || agentIds.length != finalPnlBps.length
                || agentIds.length != round.participantCount
        ) {
            revert InvalidArrayLength();
        }

        uint256 participantLength = agentIds.length;
        bool[] memory seenRanks = new bool[](participantLength + 1);
        uint256[3] memory topAgentIds;
        uint256 losingPool;
        uint256 redirectedToTreasury;

        for (uint256 i; i < participantLength; i++) {
            uint256 rank = ranks[i];
            int256 pnlBps = finalPnlBps[i];
            if (rank == 0 || rank > participantLength) revert InvalidRank();
            if (seenRanks[rank]) revert DuplicateRank();
            if (pnlBps < type(int32).min || pnlBps > type(int32).max) revert InvalidResult();
            seenRanks[rank] = true;
            (bool isWinner, uint256 losingStake) = _processAgentResult(roundId, agentIds[i], rank, pnlBps, resultHash);
            if (isWinner) {
                topAgentIds[rank - 1] = agentIds[i];
            } else {
                losingPool += losingStake;
            }
        }

        round.losingPool = losingPool;
        round.winnerAgentIds = topAgentIds;

        for (uint256 j; j < 3; j++) {
            uint256 winnerAgentId = topAgentIds[j];
            if (winnerAgentId == 0) revert InvalidResult();

            redirectedToTreasury += _finalizeWinnerBucket(roundId, winnerAgentId, _winnerWeightBps(j));
        }

        if (redirectedToTreasury > 0) {
            STAKING_ASSET.safeTransfer(address(TREASURY_VAULT), redirectedToTreasury);
        }

        uint256 claimableEscrow = _calculateClaimableEscrow(roundId);
        uint256 arenaBalance = STAKING_ASSET.balanceOf(address(this));
        if (arenaBalance < claimableEscrow) {
            uint256 shortage = claimableEscrow - arenaBalance;
            uint256 requested = shortage;
            if (requested > round.backstopCap) {
                requested = round.backstopCap;
            }

            if (requested > 0) {
                round.treasuryTopUpUsed = TREASURY_VAULT.requestBackstop(address(this), requested, roundId);
                if (round.treasuryTopUpUsed < shortage) {
                    emit BackstopShortfall(msg.sender, roundId, shortage, round.treasuryTopUpUsed);
                }
            }
        }

        round.status = RoundStatus.SETTLED;
        round.resultHash = resultHash;

        emit RoundSettled(msg.sender, roundId, resultHash, losingPool, round.treasuryTopUpUsed);
    }

    /// @notice Claims the winner payout for a staker position.
    /// @param roundId Settled round id.
    /// @param agentId Winning agent that the caller backed.
    /// @return payout Amount transferred to the staker.
    function claimStakerReward(uint256 roundId, uint256 agentId) external nonReentrant returns (uint256 payout) {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.SETTLED) revert RoundNotSettled();
        if (stakerClaims[roundId][agentId][msg.sender]) revert AlreadyClaimed();

        uint256 principal = stakePositions[roundId][agentId][msg.sender];
        if (principal == 0) revert NoClaimableReward();

        RoundAgentState storage agentState = roundAgentStates[roundId][agentId];
        if (!agentState.isWinner) revert NoClaimableReward();

        payout = principal;
        if (agentState.stakerRewardPool > 0 && agentState.totalStake > 0) {
            payout += (principal * agentState.stakerRewardPool) / agentState.totalStake;
        }

        stakerClaims[roundId][agentId][msg.sender] = true;
        STAKING_ASSET.safeTransfer(msg.sender, payout);

        emit StakerClaimed(msg.sender, roundId, agentId, payout);
    }

    /// @notice Claims the creator reward owed to the winning agent owner snapshot.
    /// @param roundId Settled round id.
    /// @param agentId Winning agent id.
    /// @return payout Amount transferred to the creator snapshot address.
    function claimCreatorReward(uint256 roundId, uint256 agentId) external nonReentrant returns (uint256 payout) {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.SETTLED) revert RoundNotSettled();

        RoundAgentState storage agentState = roundAgentStates[roundId][agentId];
        if (!agentState.isWinner || agentState.isHouseAgent) revert NoClaimableReward();
        if (agentState.creator != msg.sender) revert Unauthorized();
        if (agentState.creatorClaimed) revert AlreadyClaimed();

        payout = agentState.creatorReward;
        if (payout == 0) revert NoClaimableReward();

        agentState.creatorClaimed = true;
        STAKING_ASSET.safeTransfer(msg.sender, payout);

        emit CreatorClaimed(msg.sender, roundId, agentId, payout);
    }

    /// @notice Returns round-level accounting and status data.
    /// @param roundId Round id to inspect.
    /// @return round Full round struct.
    function getRound(uint256 roundId) external view returns (Round memory round) {
        round = rounds[roundId];
    }

    /// @notice Returns the participant ids for a round.
    /// @param roundId Round id to inspect.
    /// @return participants Ordered participant ids.
    function getRoundParticipants(uint256 roundId) external view returns (uint256[] memory participants) {
        participants = roundParticipants[roundId];
    }

    /// @notice Returns the per-round state for a specific agent.
    /// @param roundId Round id to inspect.
    /// @param agentId Agent id to inspect.
    /// @return state Round-scoped agent state.
    function getRoundAgentState(uint256 roundId, uint256 agentId) external view returns (RoundAgentState memory state) {
        state = roundAgentStates[roundId][agentId];
    }

    /// @notice Returns the raw stake position recorded for a staker.
    /// @param roundId Round id to inspect.
    /// @param agentId Agent id to inspect.
    /// @param staker Staker address to inspect.
    /// @return amount Raw principal staked by the address.
    function getStakePosition(uint256 roundId, uint256 agentId, address staker) external view returns (uint256 amount) {
        amount = stakePositions[roundId][agentId][staker];
    }

    /// @notice Previews the staker payout that would be claimable after settlement.
    /// @param roundId Round id to inspect.
    /// @param agentId Agent id to inspect.
    /// @param staker Staker address to inspect.
    /// @return payout Claimable payout for the staker.
    function previewStakerClaim(uint256 roundId, uint256 agentId, address staker)
        external
        view
        returns (uint256 payout)
    {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.SETTLED) {
            return 0;
        }

        uint256 principal = stakePositions[roundId][agentId][staker];
        RoundAgentState storage agentState = roundAgentStates[roundId][agentId];
        if (!agentState.isWinner || principal == 0) {
            return 0;
        }

        payout = principal;
        if (agentState.stakerRewardPool > 0 && agentState.totalStake > 0) {
            payout += (principal * agentState.stakerRewardPool) / agentState.totalStake;
        }
    }

    /// @notice Pauses joins, staking, and operator actions.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpauses joins, staking, and operator actions.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _joinAgent(uint256 roundId, uint256 agentId, address expectedCreator, bool expectHouseAgent) internal {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.OPEN) revert RoundNotOpen();
        if (roundAgentStates[roundId][agentId].joined) revert AgentAlreadyInRound();

        (address owner, bool isHouseAgent, bool isActive,,,,) = AGENT_REGISTRY.getAgent(agentId);

        if (!isActive) revert AgentNotActive();
        if (expectHouseAgent && !isHouseAgent) revert InvalidAgent();
        if (!expectHouseAgent && expectedCreator != address(0) && owner != expectedCreator) revert Unauthorized();

        roundAgentStates[roundId][agentId].joined = true;
        roundAgentStates[roundId][agentId].isHouseAgent = isHouseAgent;
        roundAgentStates[roundId][agentId].creator = owner;
        roundParticipants[roundId].push(agentId);
        round.participantCount += 1;

        AGENT_REGISTRY.recordJoinRound(agentId, roundId);

        emit AgentJoinedRound(expectedCreator == address(0) ? msg.sender : expectedCreator, roundId, agentId, owner);
    }

    function _isRoundOpenForStaking(uint256 roundId) internal view returns (bool) {
        Round storage round = rounds[roundId];
        return round.status == RoundStatus.OPEN && block.timestamp >= round.stakeOpenAt
            && block.timestamp <= round.stakeCloseAt;
    }

    function _winnerWeightBps(uint256 winnerIndex) internal pure returns (uint256 weightBps) {
        if (winnerIndex == 0) return 5_000;
        if (winnerIndex == 1) return 3_000;
        return 2_000;
    }

    function _processAgentResult(uint256 roundId, uint256 agentId, uint256 rank, int256 pnlBps, bytes32 resultHash)
        internal
        returns (bool isWinner, uint256 losingStake)
    {
        RoundAgentState storage agentState = roundAgentStates[roundId][agentId];
        if (!agentState.joined) revert AgentNotInRound();
        if (agentState.rank != 0) revert AgentAlreadySettled();

        agentState.rank = uint8(rank);
        agentState.finalPnlBps = int32(pnlBps);
        AGENT_REGISTRY.recordSettlementRound(agentId, roundId);

        if (rank <= 3) {
            agentState.isWinner = true;
            isWinner = true;
        } else {
            losingStake = agentState.totalStake;
        }

        if (pnlBps < 0) {
            uint256 slashBps = uint256(-pnlBps);
            if (slashBps > MAX_BOND_SLASH_BPS) {
                slashBps = MAX_BOND_SLASH_BPS;
            }

            (uint256 slashedAmount,,) = AGENT_REGISTRY.slashBond(agentId, slashBps, address(TREASURY_VAULT));
            agentState.bondSlashBps = uint16(slashBps);
            agentState.bondSlashed = slashedAmount;
        }

        REPUTATION_REGISTRY.giveFeedback(
            agentId, int128(int32(pnlBps)), 2, "arena", "round-performance", "m2-arena", "", resultHash
        );
    }

    function _finalizeWinnerBucket(uint256 roundId, uint256 winnerAgentId, uint256 winnerWeightBps)
        internal
        returns (uint256 redirectedToTreasury)
    {
        Round storage round = rounds[roundId];
        RoundAgentState storage winnerState = roundAgentStates[roundId][winnerAgentId];
        uint256 winnerBucket = (round.losingPool * winnerWeightBps) / 10_000;
        uint256 creatorReward = (winnerBucket * CREATOR_REWARD_BPS) / 10_000;
        uint256 stakerRewardPool = winnerBucket - creatorReward;

        winnerState.winnerBucket = winnerBucket;
        winnerState.creatorReward = creatorReward;
        winnerState.stakerRewardPool = stakerRewardPool;

        if (winnerState.isHouseAgent && creatorReward > 0) {
            winnerState.creatorReward = 0;
            redirectedToTreasury += creatorReward;
            emit TreasuryRedirected(
                address(TREASURY_VAULT), roundId, winnerAgentId, creatorReward, "house creator reward"
            );
        }

        if (winnerState.totalStake == 0 && stakerRewardPool > 0) {
            winnerState.stakerRewardPool = 0;
            redirectedToTreasury += stakerRewardPool;
            emit TreasuryRedirected(
                address(TREASURY_VAULT), roundId, winnerAgentId, stakerRewardPool, "winner has no stakers"
            );
        }
    }

    function _calculateClaimableEscrow(uint256 roundId) internal view returns (uint256 totalClaimableEscrow) {
        Round storage round = rounds[roundId];
        for (uint256 i; i < 3; i++) {
            uint256 winnerAgentId = round.winnerAgentIds[i];
            if (winnerAgentId == 0) {
                continue;
            }

            RoundAgentState storage state = roundAgentStates[roundId][winnerAgentId];
            totalClaimableEscrow += state.totalStake + state.stakerRewardPool + state.creatorReward;
        }
    }
}
