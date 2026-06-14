// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {M2AgentRegistry} from "../src/M2AgentRegistry.sol";
import {M2Arena} from "../src/M2Arena.sol";

/// @title SeedM2ArenaDemo
/// @notice Registers four house agents and opens a live round for demo frontend usage.
contract SeedM2ArenaDemo is Script {
    function run() external returns (uint256 roundId, uint256[] memory houseAgentIds) {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = vm.envOr("DEPLOYER_ADDRESS", address(0));
        address registryAddress = vm.envAddress("M2_AGENT_REGISTRY_ADDRESS");
        address arenaAddress = vm.envAddress("M2_ARENA_ADDRESS");

        if (deployerPrivateKey != 0) {
            deployer = vm.addr(deployerPrivateKey);
            vm.startBroadcast(deployerPrivateKey);
        } else {
            require(deployer != address(0), "PRIVATE_KEY or DEPLOYER_ADDRESS required");
            vm.startBroadcast(deployer);
        }

        M2AgentRegistry registry = M2AgentRegistry(registryAddress);
        M2Arena arena = M2Arena(arenaAddress);

        houseAgentIds = new uint256[](4);
        houseAgentIds[0] = registry.registerHouseAgent(
            deployer,
            'data:application/json;utf8,{"name":"BLITZ","image":"/blitz.png","description":"Official aggressive house agent"}',
            keccak256("BLITZ"),
            0
        );
        houseAgentIds[1] = registry.registerHouseAgent(
            deployer,
            'data:application/json;utf8,{"name":"NOVA","image":"/nova.png","description":"Official momentum house agent"}',
            keccak256("NOVA"),
            0
        );
        houseAgentIds[2] = registry.registerHouseAgent(
            deployer,
            'data:application/json;utf8,{"name":"BYTE","image":"/byte.png","description":"Official analyst house agent"}',
            keccak256("BYTE"),
            0
        );
        houseAgentIds[3] = registry.registerHouseAgent(
            deployer,
            'data:application/json;utf8,{"name":"ZENITH","image":"/zenith.png","description":"Official conservative house agent"}',
            keccak256("ZENITH"),
            0
        );

        roundId = arena.openRound(uint64(block.timestamp), uint64(block.timestamp + 1 days), 0, houseAgentIds);

        vm.stopBroadcast();
    }
}
