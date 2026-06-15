// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {M2AgentRegistry} from "../src/M2AgentRegistry.sol";
import {M2Arena} from "../src/M2Arena.sol";

/// @title SeedM2ArenaDemo
/// @notice Reuses existing house agents when present and opens a live round only when none is active.
contract SeedM2ArenaDemo is Script {
    uint256 private constant HOUSE_AGENT_COUNT = 4;
    uint256 private constant DEMO_ROUND_DURATION = 1 days;
    uint256 private constant DEFAULT_DEMO_BACKSTOP_CAP = 100 ether;

    /// @notice Reuses the first four registered house agents, creates any missing ones, and ensures one demo round exists.
    /// @return roundId Active round id after the script finishes.
    /// @return houseAgentIds The house agents used for the active or newly opened round.
    function run() external returns (uint256 roundId, uint256[] memory houseAgentIds) {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = vm.envOr("DEPLOYER_ADDRESS", address(0));
        address registryAddress = vm.envAddress("M2_AGENT_REGISTRY_ADDRESS");
        address arenaAddress = vm.envAddress("M2_ARENA_ADDRESS");
        uint256 backstopCap = vm.envOr("DEMO_BACKSTOP_CAP", DEFAULT_DEMO_BACKSTOP_CAP);

        if (deployerPrivateKey != 0) {
            deployer = vm.addr(deployerPrivateKey);
            vm.startBroadcast(deployerPrivateKey);
        } else {
            require(deployer != address(0), "PRIVATE_KEY or DEPLOYER_ADDRESS required");
            vm.startBroadcast(deployer);
        }

        M2AgentRegistry registry = M2AgentRegistry(registryAddress);
        M2Arena arena = M2Arena(arenaAddress);

        houseAgentIds = _ensureHouseAgents(registry, deployer);

        uint256 currentOpenRoundId = arena.currentOpenRoundId();
        if (currentOpenRoundId != 0) {
            roundId = currentOpenRoundId;
        } else {
            roundId = arena.openRound(
                uint64(block.timestamp), uint64(block.timestamp + DEMO_ROUND_DURATION), backstopCap, houseAgentIds
            );
        }

        vm.stopBroadcast();
    }

    /// @notice Reuses existing house agents from the registry and creates additional ones until the demo set is complete.
    /// @param registry The deployed agent registry.
    /// @param deployer The operator that should own any newly created house agents.
    /// @return houseAgentIds Four house agent ids ready to seed a round.
    function _ensureHouseAgents(M2AgentRegistry registry, address deployer)
        internal
        returns (uint256[] memory houseAgentIds)
    {
        houseAgentIds = new uint256[](HOUSE_AGENT_COUNT);
        uint256 foundCount;
        uint256 lastAgentId = registry.lastAgentId();

        for (uint256 agentId = 1; agentId <= lastAgentId && foundCount < HOUSE_AGENT_COUNT; agentId++) {
            (, bool isHouseAgent,,, bytes32 configHash,,) = registry.getAgent(agentId);
            if (!_isKnownHouseConfig(configHash) || !isHouseAgent) {
                continue;
            }

            houseAgentIds[foundCount] = agentId;
            foundCount++;
        }

        for (uint256 i = foundCount; i < HOUSE_AGENT_COUNT; i++) {
            houseAgentIds[i] = registry.registerHouseAgent(deployer, _houseAgentUri(i), _houseAgentConfigHash(i), 0);
        }
    }

    /// @notice Returns the metadata URI for a seeded demo house agent.
    /// @param index The zero-based house agent slot.
    /// @return agentUri The encoded metadata URI.
    function _houseAgentUri(uint256 index) internal pure returns (string memory agentUri) {
        if (index == 0) {
            return 'data:application/json;utf8,{"name":"BLITZ","image":"/blitz.png","description":"Official aggressive house agent"}';
        }
        if (index == 1) {
            return 'data:application/json;utf8,{"name":"NOVA","image":"/nova.png","description":"Official momentum house agent"}';
        }
        if (index == 2) {
            return 'data:application/json;utf8,{"name":"BYTE","image":"/byte.png","description":"Official analyst house agent"}';
        }
        return 'data:application/json;utf8,{"name":"ZENITH","image":"/zenith.png","description":"Official conservative house agent"}';
    }

    /// @notice Returns the canonical config hash for a seeded demo house agent.
    /// @param index The zero-based house agent slot.
    /// @return configHash The deterministic config hash used for registry lookups.
    function _houseAgentConfigHash(uint256 index) internal pure returns (bytes32 configHash) {
        if (index == 0) return keccak256("BLITZ");
        if (index == 1) return keccak256("NOVA");
        if (index == 2) return keccak256("BYTE");
        return keccak256("ZENITH");
    }

    /// @notice Checks whether a config hash belongs to the standard demo house agent set.
    /// @param configHash The hash read from the registry.
    /// @return known True when the hash matches one of the seeded demo agents.
    function _isKnownHouseConfig(bytes32 configHash) internal pure returns (bool known) {
        known = configHash == keccak256("BLITZ") || configHash == keccak256("NOVA") || configHash == keccak256("BYTE")
            || configHash == keccak256("ZENITH");
    }
}
