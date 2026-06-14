// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {M2AgentRegistry} from "../src/M2AgentRegistry.sol";
import {M2ReputationRegistry} from "../src/M2ReputationRegistry.sol";
import {M2ValidationRegistry} from "../src/M2ValidationRegistry.sol";
import {M2TreasuryVault} from "../src/M2TreasuryVault.sol";
import {M2Arena} from "../src/M2Arena.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @title DeployM2ArenaSuite
/// @notice Foundry deployment script for the full M2 Gamified Agent smart-contract suite.
contract DeployM2ArenaSuite is Script {
    uint256 internal constant MOCK_USDC_MINT = 10_000 ether;

    /// @notice Deploys the full smart-contract suite for M2 AI Arena.
    /// @dev The broadcasting deployer becomes the default admin and round operator so the same
    /// account can drive backend result submission during hackathon testing.
    /// @return mockUsdc Deployed mock settlement asset used for arena testing.
    /// @return registry Deployed ERC-8004-aligned identity registry.
    /// @return reputationRegistry Deployed reputation registry.
    /// @return validationRegistry Deployed validation registry.
    /// @return treasury Deployed treasury vault.
    /// @return arena Deployed arena settlement contract.
    function run()
        external
        returns (
            MockERC20 mockUsdc,
            M2AgentRegistry registry,
            M2ReputationRegistry reputationRegistry,
            M2ValidationRegistry validationRegistry,
            M2TreasuryVault treasury,
            M2Arena arena
        )
    {
        uint256 minimumActiveBond = vm.envUint("MINIMUM_ACTIVE_BOND");
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = vm.envOr("DEPLOYER_ADDRESS", address(0));

        if (deployerPrivateKey != 0) {
            deployer = vm.addr(deployerPrivateKey);
            vm.startBroadcast(deployerPrivateKey);
        } else {
            if (deployer == address(0)) {
                revert("PRIVATE_KEY or DEPLOYER_ADDRESS required");
            }
            vm.startBroadcast(deployer);
        }

        mockUsdc = new MockERC20("Mock USD Coin", "mUSDC");
        mockUsdc.mint(deployer, MOCK_USDC_MINT);

        registry = new M2AgentRegistry(deployer, address(mockUsdc), minimumActiveBond);
        reputationRegistry = new M2ReputationRegistry(deployer, address(registry));
        validationRegistry = new M2ValidationRegistry(deployer, address(registry));
        treasury = new M2TreasuryVault(deployer, address(mockUsdc));
        arena = new M2Arena(
            deployer,
            deployer,
            address(mockUsdc),
            address(registry),
            address(reputationRegistry),
            address(validationRegistry),
            address(treasury)
        );

        registry.grantRole(registry.REGISTRAR_ROLE(), deployer);
        registry.grantRole(registry.SLASHER_ROLE(), deployer);
        registry.grantRole(registry.REGISTRAR_ROLE(), address(arena));
        registry.grantRole(registry.SLASHER_ROLE(), address(arena));
        validationRegistry.grantRole(validationRegistry.VALIDATOR_ROLE(), deployer);
        treasury.grantRole(treasury.BACKSTOP_ROLE(), deployer);
        treasury.grantRole(treasury.BACKSTOP_ROLE(), address(arena));

        vm.stopBroadcast();
    }
}
