import type { Abi, Address } from "viem";
import { mantleSepoliaTestnet } from "viem/chains";

import { config } from "../config.js";

export const m2Chain = {
  ...mantleSepoliaTestnet,
  rpcUrls: {
    ...mantleSepoliaTestnet.rpcUrls,
    default: {
      ...mantleSepoliaTestnet.rpcUrls.default,
      http: [config.MANTLE_RPC_URL],
    },
  },
  blockExplorers: {
    ...mantleSepoliaTestnet.blockExplorers,
    default: {
      ...mantleSepoliaTestnet.blockExplorers.default,
      url: config.MANTLE_EXPLORER_URL,
    },
  },
} as const;

export const deployment = {
  arena: config.M2_ARENA_ADDRESS as Address,
  registry: config.M2_AGENT_REGISTRY_ADDRESS as Address,
  mockUsdc: config.M2_MOCK_USDC_ADDRESS as Address,
} as const;

export const arenaAbi = [
  {
    type: "event",
    anonymous: false,
    name: "RoundSettled",
    inputs: [
      { name: "operator", type: "address", indexed: true },
      { name: "roundId", type: "uint256", indexed: false },
      { name: "resultHash", type: "bytes32", indexed: false },
      { name: "losingPool", type: "uint256", indexed: false },
      { name: "treasuryTopUpUsed", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "currentOpenRoundId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "lastRoundId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getRound",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [
      { name: "status", type: "uint8" },
      { name: "stakeOpenAt", type: "uint64" },
      { name: "stakeCloseAt", type: "uint64" },
      { name: "participantCount", type: "uint32" },
      { name: "totalStaked", type: "uint256" },
      { name: "losingPool", type: "uint256" },
      { name: "treasuryTopUpUsed", type: "uint256" },
      { name: "backstopCap", type: "uint256" },
      { name: "resultHash", type: "bytes32" },
      { name: "winnerAgentIds", type: "uint256[3]" },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getRoundParticipants",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ name: "participants", type: "uint256[]" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getRoundAgentState",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "agentId", type: "uint256" },
    ],
    outputs: [
      { name: "joined", type: "bool" },
      { name: "isHouseAgent", type: "bool" },
      { name: "isWinner", type: "bool" },
      { name: "creatorClaimed", type: "bool" },
      { name: "creator", type: "address" },
      { name: "rank", type: "uint8" },
      { name: "finalPnlBps", type: "int32" },
      { name: "bondSlashBps", type: "uint16" },
      { name: "bondSlashed", type: "uint256" },
      { name: "totalStake", type: "uint256" },
      { name: "winnerBucket", type: "uint256" },
      { name: "stakerRewardPool", type: "uint256" },
      { name: "creatorReward", type: "uint256" },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "lockRound",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "submitRoundResult",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "agentIds", type: "uint256[]" },
      { name: "ranks", type: "uint256[]" },
      { name: "finalPnlBps", type: "int256[]" },
      { name: "resultHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

export const agentRegistryAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "getAgent",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "isHouseAgent", type: "bool" },
      { name: "isActive", type: "bool" },
      { name: "remainingBond", type: "uint256" },
      { name: "configHash", type: "bytes32" },
      { name: "lastJoinedRoundId", type: "uint256" },
      { name: "lastSettledRoundId", type: "uint256" },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "tokenURI",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const satisfies Abi;
