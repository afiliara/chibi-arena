import type { Abi, Address } from "viem";
import { mantleSepoliaTestnet } from "wagmi/chains";

function getPublicEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required public env: ${name}`);
  }
  return value;
}

export const mantleSepolia = mantleSepoliaTestnet;

export const mantleSepoliaRpcUrl = getPublicEnv(
  "NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_URL",
);

export const mantleSepoliaExplorerUrl = getPublicEnv(
  "NEXT_PUBLIC_MANTLE_SEPOLIA_EXPLORER_URL",
);

export const m2Deployment = {
  mockUsdc: getPublicEnv("NEXT_PUBLIC_M2_MOCK_USDC_ADDRESS") as Address,
  registry: getPublicEnv("NEXT_PUBLIC_M2_AGENT_REGISTRY_ADDRESS") as Address,
  reputationRegistry: getPublicEnv(
    "NEXT_PUBLIC_M2_REPUTATION_REGISTRY_ADDRESS",
  ) as Address,
  validationRegistry: getPublicEnv(
    "NEXT_PUBLIC_M2_VALIDATION_REGISTRY_ADDRESS",
  ) as Address,
  treasury: getPublicEnv("NEXT_PUBLIC_M2_TREASURY_VAULT_ADDRESS") as Address,
  arena: getPublicEnv("NEXT_PUBLIC_M2_ARENA_ADDRESS") as Address,
  deployer: getPublicEnv("NEXT_PUBLIC_M2_DEPLOYER_ADDRESS") as Address,
} as const satisfies Record<string, Address>;

export const m2Constants = {
  mockUsdcDecimals: 18,
  houseAgentMinimum: 4,
  creatorRewardBps: 1_500,
  maxBondSlashBps: 2_000,
} as const;

export const mockUsdcAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const satisfies Abi;

export const agentRegistryAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "minimumActiveBond",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "lastAgentId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "tokenURI",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
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
] as const satisfies Abi;

export const arenaAbi = [
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
    stateMutability: "view",
    name: "previewStakerClaim",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "agentId", type: "uint256" },
      { name: "staker", type: "address" },
    ],
    outputs: [{ name: "payout", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "createAgentAndJoinCurrentRound",
    inputs: [
      { name: "agentURI", type: "string" },
      { name: "configHash", type: "bytes32" },
      { name: "initialBond", type: "uint256" },
    ],
    outputs: [
      { name: "agentId", type: "uint256" },
      { name: "roundId", type: "uint256" },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "stake",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "claimStakerReward",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "agentId", type: "uint256" },
    ],
    outputs: [{ name: "payout", type: "uint256" }],
  },
] as const satisfies Abi;
