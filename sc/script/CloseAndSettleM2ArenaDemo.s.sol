// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {M2Arena} from "../src/M2Arena.sol";

/// @title CloseAndSettleM2ArenaDemo
/// @notice Locks the active demo round and submits deterministic settlement data for fast claim testing.
/// @dev This script is intentionally demo-oriented. It ranks agents by total stake descending,
/// then breaks ties by lower agent id so the output stays deterministic across repeated runs.
contract CloseAndSettleM2ArenaDemo is Script {
    /// @notice Forces the target round into `SETTLED` by locking it when needed and submitting demo results.
    /// @dev Uses `ROUND_ID` from env when present, otherwise falls back to the arena's current open round.
    /// Supports both dry-run (`--sender`) and broadcast (`PRIVATE_KEY`) execution patterns used elsewhere in this repo.
    /// @return roundId The round that was locked and settled.
    /// @return resultHash The deterministic demo result hash submitted to the arena.
    function run() external returns (uint256 roundId, bytes32 resultHash) {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = vm.envOr("DEPLOYER_ADDRESS", address(0));
        address arenaAddress = vm.envAddress("M2_ARENA_ADDRESS");
        uint256 requestedRoundId = vm.envOr("ROUND_ID", uint256(0));

        if (deployerPrivateKey != 0) {
            deployer = vm.addr(deployerPrivateKey);
            vm.startBroadcast(deployerPrivateKey);
        } else {
            require(deployer != address(0), "PRIVATE_KEY or DEPLOYER_ADDRESS required");
            vm.startBroadcast(deployer);
        }

        M2Arena arena = M2Arena(arenaAddress);
        roundId = requestedRoundId != 0 ? requestedRoundId : arena.currentOpenRoundId();
        require(roundId != 0, "No open round and ROUND_ID not provided");

        M2Arena.Round memory round = arena.getRound(roundId);
        require(round.status != M2Arena.RoundStatus.SETTLED, "Round already settled");

        uint256[] memory participantIds = arena.getRoundParticipants(roundId);
        require(participantIds.length >= 4, "Demo settlement requires at least 4 participants");

        _sortParticipantsByStake(arena, roundId, participantIds);

        uint256[] memory ranks = new uint256[](participantIds.length);
        int256[] memory finalPnlBps = new int256[](participantIds.length);

        for (uint256 i; i < participantIds.length; i++) {
            ranks[i] = i + 1;
            finalPnlBps[i] = _demoPnlForRank(i + 1);
        }

        resultHash =
            keccak256(abi.encode("M2_DEMO_AUTO_SETTLE", block.chainid, roundId, participantIds, ranks, finalPnlBps));

        if (round.status == M2Arena.RoundStatus.OPEN) {
            arena.lockRound(roundId);
        } else {
            require(round.status == M2Arena.RoundStatus.LOCKED, "Round must be OPEN or LOCKED");
        }

        arena.submitRoundResult(roundId, participantIds, ranks, finalPnlBps, resultHash);

        vm.stopBroadcast();
    }

    /// @notice Sorts the participant id array in-place by total stake descending and agent id ascending.
    /// @param arena The deployed arena contract.
    /// @param roundId The round being settled.
    /// @param participantIds Participant ids that will be ordered for deterministic settlement.
    function _sortParticipantsByStake(M2Arena arena, uint256 roundId, uint256[] memory participantIds) internal view {
        for (uint256 i; i < participantIds.length; i++) {
            uint256 bestIndex = i;
            uint256 bestStake = arena.getRoundAgentState(roundId, participantIds[i]).totalStake;

            for (uint256 j = i + 1; j < participantIds.length; j++) {
                uint256 candidateStake = arena.getRoundAgentState(roundId, participantIds[j]).totalStake;
                if (
                    candidateStake > bestStake
                        || (candidateStake == bestStake && participantIds[j] < participantIds[bestIndex])
                ) {
                    bestIndex = j;
                    bestStake = candidateStake;
                }
            }

            if (bestIndex != i) {
                uint256 swapValue = participantIds[i];
                participantIds[i] = participantIds[bestIndex];
                participantIds[bestIndex] = swapValue;
            }
        }
    }

    /// @notice Returns the demo PnL basis points assigned to a rank during forced settlement.
    /// @param rank One-based rank after deterministic sorting.
    /// @return pnlBps Final PnL basis points submitted to the arena.
    function _demoPnlForRank(uint256 rank) internal pure returns (int256 pnlBps) {
        if (rank == 1) return 1_200;
        if (rank == 2) return 800;
        if (rank == 3) return 400;
        return -int256(300 * (rank - 3));
    }
}
