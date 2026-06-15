import { createPublicClient, createWalletClient, http, keccak256, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { config } from "../config.js";
import { agentRegistryAbi, arenaAbi, deployment, m2Chain } from "../lib/contracts.js";
import type { AgentDecision, AgentProfile, AgentRoundResult, PreparedRoundResult, RoundSnapshot } from "../types.js";

type AgentRegistryView = readonly [
  owner: `0x${string}`,
  isHouseAgent: boolean,
  isActive: boolean,
  remainingBond: bigint,
  configHash: `0x${string}`,
  lastJoinedRoundId: bigint,
  lastSettledRoundId: bigint,
];

type RoundAgentStateView = readonly [
  joined: boolean,
  isHouseAgent: boolean,
  isWinner: boolean,
  creatorClaimed: boolean,
  creator: `0x${string}`,
  rank: number,
  finalPnlBps: number,
  bondSlashBps: number,
  bondSlashed: bigint,
  totalStake: bigint,
  winnerBucket: bigint,
  stakerRewardPool: bigint,
  creatorReward: bigint,
];

export class ChainService {
  readonly account = privateKeyToAccount(config.OPERATOR_PRIVATE_KEY as `0x${string}`);

  readonly publicClient = createPublicClient({
    chain: m2Chain,
    transport: http(config.MANTLE_RPC_URL),
  });

  readonly walletClient = createWalletClient({
    account: this.account,
    chain: m2Chain,
    transport: http(config.MANTLE_RPC_URL),
  });

  async getCurrentOpenRoundId() {
    return this.publicClient.readContract({
      address: deployment.arena,
      abi: arenaAbi,
      functionName: "currentOpenRoundId",
    });
  }

  async getLastRoundId() {
    return this.publicClient.readContract({
      address: deployment.arena,
      abi: arenaAbi,
      functionName: "lastRoundId",
    });
  }

  async getRound(roundId: bigint): Promise<RoundSnapshot> {
    const round = await this.publicClient.readContract({
      address: deployment.arena,
      abi: arenaAbi,
      functionName: "getRound",
      args: [roundId],
    });

    const [
      status,
      stakeOpenAt,
      stakeCloseAt,
      participantCount,
      totalStaked,
      losingPool,
      treasuryTopUpUsed,
      backstopCap,
      resultHash,
      winnerAgentIds,
    ] = round;

    return {
      roundId,
      status: Number(status),
      stakeOpenAt: Number(stakeOpenAt),
      stakeCloseAt: Number(stakeCloseAt),
      participantCount: Number(participantCount),
      totalStaked,
      losingPool,
      treasuryTopUpUsed,
      backstopCap,
      resultHash,
      winnerAgentIds,
    };
  }

  async getRoundParticipants(roundId: bigint) {
    return this.publicClient.readContract({
      address: deployment.arena,
      abi: arenaAbi,
      functionName: "getRoundParticipants",
      args: [roundId],
    });
  }

  async getParticipantsWithProfiles(roundId: bigint) {
    const participantIds = await this.getRoundParticipants(roundId);
    if (participantIds.length === 0) {
      return { participantIds, participants: [] };
    }

    const { agentResults, uriResults } = await this.readAgentProfiles(participantIds);
    const metadataResults = await Promise.all(uriResults.map((uri: string) => parseAgentMetadata(uri)));
    const participants = participantIds.map((agentId, index) => {
      const [
        owner,
        isHouseAgent,
        isActive,
        remainingBond,
        configHash,
        lastJoinedRoundId,
        lastSettledRoundId,
      ] = agentResults[index];
      const agentUri = uriResults[index] || "";
      const metadata = metadataResults[index];

      const housePersonality = resolveHouseDefault(configHash, "personality");
      const houseTradingStyle = resolveHouseDefault(configHash, "tradingStyle");
      const personality = metadata.personality && metadata.personality !== "HOUSE"
        ? metadata.personality
        : housePersonality ?? metadata.personality ?? (isHouseAgent ? "HOUSE" : "CUSTOM");
      const tradingStyle = metadata.tradingStyle && metadata.tradingStyle !== "Adaptive"
        ? metadata.tradingStyle
        : houseTradingStyle ?? metadata.tradingStyle ?? "Adaptive";

      return {
        agentId,
        owner,
        isHouseAgent,
        isActive,
        remainingBond,
        configHash,
        lastJoinedRoundId,
        lastSettledRoundId,
        agentUri,
        image: resolveHouseDefault(configHash, "image") ?? metadata.image,
        name: resolveHouseDefault(configHash, "name") ?? metadata.name ?? `AGENT-${agentId.toString()}`,
        personality,
        tradingStyle,
      } satisfies AgentProfile;
    });

    return { participantIds, participants };
  }

  async getLatestSettledRoundId() {
    const lastRoundId = await this.getLastRoundId();
    for (let roundId = lastRoundId; roundId > 0n; roundId -= 1n) {
      const round = await this.getRound(roundId);
      if (round.status === 3) {
        return roundId;
      }
    }
    return null;
  }

  async reconstructSettledRoundResult(roundId: bigint): Promise<PreparedRoundResult | null> {
    const round = await this.getRound(roundId);
    if (round.status !== 3) {
      return null;
    }

    const participantIds = await this.getRoundParticipants(roundId);
    if (participantIds.length === 0) {
      return null;
    }

    const { participants } = await this.getParticipantsWithProfiles(roundId).catch(() => ({
      participantIds,
      participants: participantIds.map((agentId) => fallbackParticipant(agentId)),
    }));

    const stateResults: RoundAgentStateView[] = [];
    for (const participant of participants) {
      const state = await this.publicClient.readContract({
        address: deployment.arena,
        abi: arenaAbi,
        functionName: "getRoundAgentState",
        args: [roundId, participant.agentId],
      });
      stateResults.push(state as RoundAgentStateView);
    }
    const agentDecisions = participants
      .map<AgentRoundResult>((participant, index) => {
        const state = stateResults[index];
        return {
          agentId: participant.agentId,
          owner: participant.owner,
          name: participant.name,
          image: participant.image,
          personality: participant.personality,
          tradingStyle: participant.tradingStyle,
          isHouseAgent: participant.isHouseAgent,
          decision: synthesizeDecision(participant, state[6]),
          finalPnlBps: state[6],
          rank: state[5],
        };
      })
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return left.rank - right.rank;
        }
        return left.agentId < right.agentId ? -1 : 1;
      });

    return {
      roundId,
      generatedAt: new Date().toISOString(),
      startSnapshot: null,
      endSnapshot: null,
      agentDecisions,
      resultHash: round.resultHash,
      submitTxHash: await this.getRoundSettlementTxHash(roundId).then((hash) => hash ?? undefined).catch(() => undefined),
    };
  }

  async lockRound(roundId: bigint) {
    const hash = await this.walletClient.writeContract({
      account: this.account,
      chain: m2Chain,
      address: deployment.arena,
      abi: arenaAbi,
      functionName: "lockRound",
      args: [roundId],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  async submitRoundResult(input: {
    roundId: bigint;
    agentIds: bigint[];
    ranks: bigint[];
    finalPnlBps: bigint[];
    resultHash: `0x${string}`;
  }) {
    const hash = await this.walletClient.writeContract({
      account: this.account,
      chain: m2Chain,
      address: deployment.arena,
      abi: arenaAbi,
      functionName: "submitRoundResult",
      args: [input.roundId, input.agentIds, input.ranks, input.finalPnlBps, input.resultHash],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  async getRoundSettlementTxHash(roundId: bigint) {
    const latestBlock = await this.publicClient.getBlockNumber();
    const fromBlock = latestBlock > 10_000n ? latestBlock - 10_000n : 0n;
    const logs = await this.publicClient.getLogs({
      address: deployment.arena,
      event: {
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
      fromBlock,
      toBlock: latestBlock,
    });

    const matchedLog = [...logs].reverse().find((log) => log.args.roundId === roundId);
    return matchedLog?.transactionHash ?? null;
  }

  private async readAgentProfiles(participantIds: readonly bigint[]) {
    try {
      const agentResultsRaw = await this.publicClient.multicall({
        contracts: participantIds.map((agentId) => ({
          address: deployment.registry,
          abi: agentRegistryAbi,
          functionName: "getAgent",
          args: [agentId],
        })),
        allowFailure: false,
      });

      const uriResults = await Promise.all(
        participantIds.map(async (agentId) => {
          try {
            const uri = await this.publicClient.readContract({
              address: deployment.registry,
              abi: agentRegistryAbi,
              functionName: "tokenURI",
              args: [agentId],
            });
            return uri as string;
          } catch {
            return this.getAgentUriFromRegistration(agentId);
          }
        }),
      );

      return {
        agentResults: agentResultsRaw as AgentRegistryView[],
        uriResults,
      };
    } catch {
      const agentResults: AgentRegistryView[] = [];
      const uriResults: string[] = [];

      for (const agentId of participantIds) {
        const agent = await this.publicClient.readContract({
          address: deployment.registry,
          abi: agentRegistryAbi,
          functionName: "getAgent",
          args: [agentId],
        });
        let uri = "";
        try {
          const uriResult = await this.publicClient.readContract({
            address: deployment.registry,
            abi: agentRegistryAbi,
            functionName: "tokenURI",
            args: [agentId],
          });
          uri = uriResult as string;
        } catch {
          uri = await this.getAgentUriFromRegistration(agentId);
        }

        agentResults.push(agent as AgentRegistryView);
        uriResults.push(uri);
      }

      return { agentResults, uriResults };
    }
  }

  private async getAgentUriFromRegistration(agentId: bigint) {
    try {
      const latestBlock = await this.publicClient.getBlockNumber();
      const fromBlock = latestBlock > 25_000n ? latestBlock - 25_000n : 0n;
      const logs = await this.publicClient.getLogs({
        address: deployment.registry,
        event: agentRegistryAbi[0],
        fromBlock,
        toBlock: latestBlock,
      });
      const matchedLog = [...logs].reverse().find((log) => log.args.agentId === agentId);
      return (matchedLog?.args.agentURI as string | undefined) ?? "";
    } catch {
      return "";
    }
  }
}

function fallbackParticipant(agentId: bigint): AgentProfile {
  const defaults = FALLBACK_AGENT_DEFAULTS[agentId.toString()] ?? null;
  return {
    agentId,
    owner: deployment.arena,
    isHouseAgent: agentId <= 4n,
    isActive: true,
    remainingBond: 0n,
    configHash: keccak256(stringToHex(`FALLBACK-${agentId.toString()}`)),
    lastJoinedRoundId: 0n,
    lastSettledRoundId: 0n,
    agentUri: "",
    image: defaults?.image,
    name: defaults?.name ?? `AGENT-${agentId.toString()}`,
    personality: defaults?.personality ?? "UNKNOWN",
    tradingStyle: defaults?.tradingStyle ?? "Arena Challenger",
  };
}

function synthesizeDecision(participant: AgentProfile, finalPnlBps: number): AgentDecision {
  const key = `${participant.personality} ${participant.tradingStyle} ${participant.name}`.toUpperCase();

  if (key.includes("BLITZ") || key.includes("AGGRESSIVE")) {
    return {
      action: finalPnlBps >= 0 ? "LONG" : "SHORT",
      asset: "SOL",
      confidence: 68,
      rationale: "Aggressive house profile pushed hardest into SOL during the settled round.",
    };
  }

  if (key.includes("NOVA") || key.includes("MOMENTUM")) {
    return {
      action: finalPnlBps >= 0 ? "LONG" : "SHORT",
      asset: "ETH",
      confidence: 64,
      rationale: "Breakout rotation favored ETH as NOVA chased expansion in the closing phase.",
    };
  }

  if (key.includes("BYTE") || key.includes("ANALYST")) {
    return {
      action: finalPnlBps >= 0 ? "LONG" : "SHORT",
      asset: "BTC",
      confidence: 61,
      rationale: "Analyst posture resolved around BTC after scanning the strongest mean-reversion edge.",
    };
  }

  if (key.includes("ZENITH") || key.includes("CONSERVATIVE")) {
    return {
      action: finalPnlBps >= 0 ? "LONG" : "SHORT",
      asset: "BTC",
      confidence: 56,
      rationale: "Defensive capital rotation stayed focused on major-asset protection into settlement.",
    };
  }

  return {
    action: finalPnlBps >= 0 ? "LONG" : "SHORT",
    asset: "BTC",
    confidence: 58,
    rationale: "This settled result was reconstructed from on-chain round state after direct arena settlement.",
  };
}

async function parseAgentMetadata(agentUri: string) {
  const fallback = {
    name: undefined as string | undefined,
    image: undefined as string | undefined,
    personality: undefined as string | undefined,
    tradingStyle: undefined as string | undefined,
  };

  try {
    if (agentUri.startsWith("data:application/json;utf8,")) {
      const raw = agentUri.replace("data:application/json;utf8,", "");
      return extractMetadataFields(JSON.parse(decodeURIComponent(raw)) as { [key: string]: unknown });
    }

    if (agentUri.startsWith("http://") || agentUri.startsWith("https://")) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);

      try {
        const response = await fetch(agentUri, { signal: controller.signal });
        if (!response.ok) {
          return fallback;
        }
        const payload = await response.json() as { [key: string]: unknown };
        return extractMetadataFields(payload);
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function extractMetadataFields(payload: { [key: string]: unknown }) {
  const attributes = Array.isArray(payload.attributes)
    ? payload.attributes.filter(isAttributeRecord)
    : [];

  return {
    name: typeof payload.name === "string" ? payload.name : undefined,
    image: typeof payload.image === "string" ? payload.image : undefined,
    personality: findAttributeValue(attributes, "Personality"),
    tradingStyle: findAttributeValue(attributes, "Trading Style"),
  };
}

function findAttributeValue(attributes: Array<{ trait_type: string; value: string }>, traitType: string) {
  return attributes.find((attribute) => attribute.trait_type === traitType)?.value;
}

function isAttributeRecord(value: unknown): value is { trait_type: string; value: string } {
  return typeof value === "object" && value !== null
    && typeof (value as { trait_type?: unknown }).trait_type === "string"
    && typeof (value as { value?: unknown }).value === "string";
}

function resolveHouseDefault(
  configHash: `0x${string}`,
  field: "name" | "image" | "personality" | "tradingStyle",
) {
  const normalized = configHash.toLowerCase();
  const mapping = HOUSE_AGENT_DEFAULTS[normalized];
  return mapping?.[field];
}

const HOUSE_AGENT_DEFAULTS = {
  [toHouseConfigHash("BLITZ")]: {
    name: "BLITZ",
    image: "/blitz.png",
    personality: "AGGRESSIVE",
    tradingStyle: "Momentum Raider",
  },
  [toHouseConfigHash("NOVA")]: {
    name: "NOVA",
    image: "/nova.png",
    personality: "MOMENTUM",
    tradingStyle: "Breakout Hunter",
  },
  [toHouseConfigHash("BYTE")]: {
    name: "BYTE",
    image: "/byte.png",
    personality: "ANALYST",
    tradingStyle: "Mean Reversion Analyst",
  },
  [toHouseConfigHash("ZENITH")]: {
    name: "ZENITH",
    image: "/zenith.png",
    personality: "CONSERVATIVE",
    tradingStyle: "Capital Preserver",
  },
} as const satisfies Record<string, Record<string, string>>;

const FALLBACK_AGENT_DEFAULTS: Record<string, {
  name: string;
  image: string;
  personality: string;
  tradingStyle: string;
}> = {
  "1": {
    name: "BLITZ",
    image: "/blitz.png",
    personality: "AGGRESSIVE",
    tradingStyle: "Momentum Raider",
  },
  "2": {
    name: "NOVA",
    image: "/nova.png",
    personality: "MOMENTUM",
    tradingStyle: "Breakout Hunter",
  },
  "3": {
    name: "BYTE",
    image: "/byte.png",
    personality: "ANALYST",
    tradingStyle: "Mean Reversion Analyst",
  },
  "4": {
    name: "ZENITH",
    image: "/zenith.png",
    personality: "CONSERVATIVE",
    tradingStyle: "Capital Preserver",
  },
} as const;

function toHouseConfigHash(label: string) {
  return keccak256(stringToHex(label)).toLowerCase();
}
