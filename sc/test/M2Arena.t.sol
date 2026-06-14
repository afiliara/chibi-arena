// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {M2AgentRegistry} from "../src/M2AgentRegistry.sol";
import {M2ReputationRegistry} from "../src/M2ReputationRegistry.sol";
import {M2ValidationRegistry} from "../src/M2ValidationRegistry.sol";
import {M2TreasuryVault} from "../src/M2TreasuryVault.sol";
import {M2Arena} from "../src/M2Arena.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @title M2ArenaTest
/// @notice Foundry tests covering round lifecycle, settlement, treasury, and claim flows.
contract M2ArenaTest is Test {
    MockERC20 internal asset;
    M2AgentRegistry internal registry;
    M2ReputationRegistry internal reputationRegistry;
    M2ValidationRegistry internal validationRegistry;
    M2TreasuryVault internal treasury;
    M2Arena internal arena;

    address internal admin = makeAddr("admin");
    address internal operator = makeAddr("operator");
    address internal creator = makeAddr("creator");
    address internal stakerOne = makeAddr("stakerOne");
    address internal stakerTwo = makeAddr("stakerTwo");
    address internal stakerThree = makeAddr("stakerThree");
    address internal stakerFour = makeAddr("stakerFour");
    address internal stakerFive = makeAddr("stakerFive");

    uint256[] internal houseAgentIds;

    /// @notice Deploys a fresh arena stack and seeds four house agents for each test case.
    function setUp() public {
        asset = new MockERC20("Mock USD", "mUSD");
        registry = new M2AgentRegistry(admin, address(asset), 100 ether);
        reputationRegistry = new M2ReputationRegistry(admin, address(registry));
        validationRegistry = new M2ValidationRegistry(admin, address(registry));
        treasury = new M2TreasuryVault(admin, address(asset));
        arena = new M2Arena(
            admin,
            operator,
            address(asset),
            address(registry),
            address(reputationRegistry),
            address(validationRegistry),
            address(treasury)
        );

        vm.startPrank(admin);
        registry.grantRole(registry.REGISTRAR_ROLE(), address(arena));
        registry.grantRole(registry.SLASHER_ROLE(), address(arena));
        treasury.grantRole(treasury.BACKSTOP_ROLE(), address(arena));
        vm.stopPrank();

        _mintAndApprove(creator, 5_000 ether, address(registry), address(arena));
        _mintAndApprove(stakerOne, 5_000 ether, address(registry), address(arena));
        _mintAndApprove(stakerTwo, 5_000 ether, address(registry), address(arena));
        _mintAndApprove(stakerThree, 5_000 ether, address(registry), address(arena));
        _mintAndApprove(stakerFour, 5_000 ether, address(registry), address(arena));
        _mintAndApprove(stakerFive, 5_000 ether, address(registry), address(arena));

        vm.startPrank(admin);
        houseAgentIds.push(registry.registerHouseAgent(admin, "ipfs://house-1", keccak256("h1"), 0));
        houseAgentIds.push(registry.registerHouseAgent(admin, "ipfs://house-2", keccak256("h2"), 0));
        houseAgentIds.push(registry.registerHouseAgent(admin, "ipfs://house-3", keccak256("h3"), 0));
        houseAgentIds.push(registry.registerHouseAgent(admin, "ipfs://house-4", keccak256("h4"), 0));
        vm.stopPrank();
    }

    /// @notice Verifies top-3 settlement, house creator redirect, and winner claims.
    function test_settlement_distributesRewards_redirectsHouseCreatorShare_andAllowsClaims() public {
        uint64 openAt = uint64(block.timestamp);
        uint64 closeAt = uint64(block.timestamp + 1 hours);

        vm.prank(operator);
        arena.openRound(openAt, closeAt, 0, houseAgentIds);

        vm.prank(creator);
        (uint256 creatorAgentId, uint256 roundId) =
            arena.createAgentAndJoinCurrentRound("ipfs://creator-agent", keccak256("creator-cfg"), 500 ether);

        vm.prank(stakerOne);
        arena.stake(creatorAgentId, 100 ether);
        vm.prank(creator);
        arena.stake(creatorAgentId, 50 ether);
        vm.prank(stakerTwo);
        arena.stake(houseAgentIds[0], 80 ether);
        vm.prank(stakerThree);
        arena.stake(houseAgentIds[1], 70 ether);
        vm.prank(stakerFour);
        arena.stake(houseAgentIds[2], 60 ether);
        vm.prank(stakerFive);
        arena.stake(houseAgentIds[3], 40 ether);

        vm.prank(operator);
        arena.lockRound(roundId);

        uint256[] memory agentIds = new uint256[](5);
        agentIds[0] = creatorAgentId;
        agentIds[1] = houseAgentIds[0];
        agentIds[2] = houseAgentIds[1];
        agentIds[3] = houseAgentIds[2];
        agentIds[4] = houseAgentIds[3];

        uint256[] memory ranks = new uint256[](5);
        ranks[0] = 1;
        ranks[1] = 2;
        ranks[2] = 3;
        ranks[3] = 4;
        ranks[4] = 5;

        int256[] memory pnlBps = new int256[](5);
        pnlBps[0] = 1_200;
        pnlBps[1] = 400;
        pnlBps[2] = -100;
        pnlBps[3] = -900;
        pnlBps[4] = -1_200;

        vm.prank(operator);
        arena.submitRoundResult(roundId, agentIds, ranks, pnlBps, bytes32("round-1"));

        M2Arena.Round memory round = arena.getRound(roundId);
        assertEq(uint256(round.status), uint256(M2Arena.RoundStatus.SETTLED));
        assertEq(round.losingPool, 100 ether);
        assertEq(asset.balanceOf(address(treasury)), 7.5 ether);

        assertEq(arena.previewStakerClaim(roundId, creatorAgentId, stakerOne), 128_333333333333333333);
        assertEq(arena.previewStakerClaim(roundId, creatorAgentId, creator), 64_166666666666666666);

        uint256 creatorBalanceBefore = asset.balanceOf(creator);
        vm.prank(creator);
        uint256 creatorStakePayout = arena.claimStakerReward(roundId, creatorAgentId);
        vm.prank(creator);
        uint256 creatorRewardPayout = arena.claimCreatorReward(roundId, creatorAgentId);
        assertEq(creatorStakePayout, 64_166666666666666666);
        assertEq(creatorRewardPayout, 7.5 ether);
        assertEq(asset.balanceOf(creator) - creatorBalanceBefore, creatorStakePayout + creatorRewardPayout);

        vm.prank(stakerOne);
        uint256 stakerOnePayout = arena.claimStakerReward(roundId, creatorAgentId);
        vm.prank(stakerTwo);
        uint256 stakerTwoPayout = arena.claimStakerReward(roundId, houseAgentIds[0]);
        vm.prank(stakerThree);
        uint256 stakerThreePayout = arena.claimStakerReward(roundId, houseAgentIds[1]);

        assertEq(stakerOnePayout, 128_333333333333333333);
        assertEq(stakerTwoPayout, 105_500000000000000000);
        assertEq(stakerThreePayout, 87 ether);
    }

    /// @notice Verifies negative user PnL slashes remaining bond proportionally with the round cap.
    function test_submitRoundResult_slashesNegativeUserBondProportionallyWithCap() public {
        uint64 openAt = uint64(block.timestamp);
        uint64 closeAt = uint64(block.timestamp + 1 hours);

        vm.prank(operator);
        arena.openRound(openAt, closeAt, 0, houseAgentIds);

        vm.prank(creator);
        (uint256 creatorAgentId, uint256 roundId) =
            arena.createAgentAndJoinCurrentRound("ipfs://creator-agent", keccak256("creator-cfg"), 500 ether);

        vm.prank(operator);
        arena.lockRound(roundId);

        uint256[] memory agentIds = new uint256[](5);
        agentIds[0] = creatorAgentId;
        agentIds[1] = houseAgentIds[0];
        agentIds[2] = houseAgentIds[1];
        agentIds[3] = houseAgentIds[2];
        agentIds[4] = houseAgentIds[3];

        uint256[] memory ranks = new uint256[](5);
        ranks[0] = 4;
        ranks[1] = 1;
        ranks[2] = 2;
        ranks[3] = 3;
        ranks[4] = 5;

        int256[] memory pnlBps = new int256[](5);
        pnlBps[0] = -2_500;
        pnlBps[1] = 900;
        pnlBps[2] = 300;
        pnlBps[3] = 100;
        pnlBps[4] = -500;

        vm.prank(operator);
        arena.submitRoundResult(roundId, agentIds, ranks, pnlBps, bytes32("round-negative"));

        (,, bool isActive, uint256 remainingBond,,,) = registry.getAgent(creatorAgentId);
        assertEq(remainingBond, 400 ether);
        assertTrue(isActive);
        assertEq(asset.balanceOf(address(treasury)), 100 ether);
    }

    function _mintAndApprove(address user, uint256 amount, address registryAddress, address arenaAddress) internal {
        asset.mint(user, amount);
        vm.startPrank(user);
        asset.approve(registryAddress, type(uint256).max);
        asset.approve(arenaAddress, type(uint256).max);
        vm.stopPrank();
    }
}
