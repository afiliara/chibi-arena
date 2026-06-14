// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {M2AgentRegistry} from "../src/M2AgentRegistry.sol";
import {M2ReputationRegistry} from "../src/M2ReputationRegistry.sol";
import {M2ValidationRegistry} from "../src/M2ValidationRegistry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {BondBelowMinimum, SelfFeedbackNotAllowed} from "../src/common/M2Errors.sol";

/// @title M2AgentRegistryTest
/// @notice Foundry tests covering identity, bond, reputation, and validation flows.
contract M2AgentRegistryTest is Test {
    MockERC20 internal asset;
    M2AgentRegistry internal registry;
    M2ReputationRegistry internal reputationRegistry;
    M2ValidationRegistry internal validationRegistry;

    address internal admin = makeAddr("admin");
    address internal arena = makeAddr("arena");
    address internal creator = makeAddr("creator");
    address internal reviewer = makeAddr("reviewer");
    address internal validator = makeAddr("validator");

    /// @notice Deploys fresh registry and helper contracts for each test case.
    function setUp() public {
        asset = new MockERC20("Mock USD", "mUSD");
        registry = new M2AgentRegistry(admin, address(asset), 450 ether);
        reputationRegistry = new M2ReputationRegistry(admin, address(registry));
        validationRegistry = new M2ValidationRegistry(admin, address(registry));

        vm.startPrank(admin);
        registry.grantRole(registry.REGISTRAR_ROLE(), arena);
        registry.grantRole(registry.SLASHER_ROLE(), arena);
        validationRegistry.grantRole(validationRegistry.VALIDATOR_ROLE(), validator);
        vm.stopPrank();

        asset.mint(creator, 2_000 ether);
        vm.prank(creator);
        asset.approve(address(registry), type(uint256).max);
    }

    /// @notice Verifies creator registration reverts when bond is below the active threshold.
    function test_registerCreatorAgent_revertsWhenBondTooLow() public {
        vm.prank(arena);
        vm.expectRevert(BondBelowMinimum.selector);
        registry.registerCreatorAgent(creator, "ipfs://creator", keccak256("cfg"), 449 ether);
    }

    /// @notice Verifies slash and top-up update bond and active status correctly.
    function test_registerCreatorAgent_slashAndTopUpFlow() public {
        uint256 agentId = _registerCreatorAgent(500 ether);

        (address owner, bool isHouseAgent, bool isActive, uint256 remainingBond,,,) = registry.getAgent(agentId);

        assertEq(owner, creator);
        assertFalse(isHouseAgent);
        assertTrue(isActive);
        assertEq(remainingBond, 500 ether);

        vm.prank(arena);
        (uint256 slashedAmount, uint256 updatedBond, bool updatedActive) = registry.slashBond(agentId, 2_000, reviewer);

        assertEq(slashedAmount, 100 ether);
        assertEq(updatedBond, 400 ether);
        assertFalse(updatedActive);
        assertEq(asset.balanceOf(reviewer), 100 ether);

        vm.prank(creator);
        registry.topUpBond(agentId, 100 ether);

        (,, bool reactivated, uint256 toppedUpBond,,,) = registry.getAgent(agentId);
        assertTrue(reactivated);
        assertEq(toppedUpBond, 500 ether);
    }

    /// @notice Verifies self-feedback is blocked while third-party feedback is persisted.
    function test_reputationRegistry_blocksSelfFeedbackAndStoresExternalFeedback() public {
        uint256 agentId = _registerCreatorAgent(500 ether);

        vm.prank(creator);
        vm.expectRevert(SelfFeedbackNotAllowed.selector);
        reputationRegistry.giveFeedback(agentId, 100, 2, "arena", "round", "m2", "", bytes32("x"));

        vm.prank(reviewer);
        reputationRegistry.giveFeedback(agentId, 1250, 2, "arena", "round", "m2", "ipfs://feedback", bytes32("proof"));

        M2ReputationRegistry.Feedback memory feedback = reputationRegistry.readFeedback(agentId, reviewer, 1);
        assertEq(feedback.value, 1250);
        assertEq(feedback.valueDecimals, 2);
        assertEq(feedback.tag1, "arena");
        assertEq(feedback.feedbackURI, "ipfs://feedback");
    }

    /// @notice Verifies validation requests and responses are stored under the expected hash.
    function test_validationRegistry_requestAndResponseFlow() public {
        uint256 agentId = _registerCreatorAgent(500 ether);

        vm.prank(creator);
        validationRegistry.validationRequest(validator, agentId, "ipfs://request", bytes32("request"));

        vm.prank(validator);
        validationRegistry.validationResponse(bytes32("request"), 88, "ipfs://response", bytes32("response"), "battle");

        M2ValidationRegistry.ValidationStatus memory status = validationRegistry.getValidationStatus(bytes32("request"));
        assertEq(status.agentId, agentId);
        assertEq(status.validator, validator);
        assertEq(status.response, 88);
        assertTrue(status.hasResponse);
        assertEq(status.tag, "battle");
    }

    function _registerCreatorAgent(uint256 initialBond) internal returns (uint256 agentId) {
        vm.prank(arena);
        agentId = registry.registerCreatorAgent(creator, "ipfs://creator", keccak256("cfg"), initialBond);
    }
}
