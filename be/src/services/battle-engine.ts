import { keccak256, stringToHex } from "viem";

import type {
  AgentDecision,
  AgentProfile,
  AgentRoundPreview,
  AgentRoundResult,
  MarketSnapshot,
  PreparedRoundResult,
} from "../types.js";
import { OpenRouterService } from "./openrouter-service.js";

export class BattleEngine {
  constructor(private readonly openRouterService: OpenRouterService) {}

  async prepareLivePreview(input: {
    roundId: bigint;
    participants: AgentProfile[];
    startSnapshot: MarketSnapshot;
    currentSnapshot: MarketSnapshot;
  }): Promise<AgentRoundPreview[]> {
    const ranked = await this.rankAgentDecisions({
      roundId: input.roundId,
      participants: input.participants,
      snapshotForReasoning: input.currentSnapshot,
      startSnapshot: input.startSnapshot,
      pnlSnapshot: input.currentSnapshot,
    });

    return ranked.map((entry) => ({
      agentId: entry.agentId,
      owner: entry.owner,
      name: entry.name,
      image: entry.image,
      personality: entry.personality,
      tradingStyle: entry.tradingStyle,
      isHouseAgent: entry.isHouseAgent,
      decision: entry.decision,
      previewPnlBps: entry.finalPnlBps,
      previewRank: entry.rank,
    }));
  }

  async prepareRoundResult(input: {
    roundId: bigint;
    participants: AgentProfile[];
    startSnapshot: MarketSnapshot;
    endSnapshot: MarketSnapshot;
  }): Promise<PreparedRoundResult> {
    const ranked = await this.rankAgentDecisions({
      roundId: input.roundId,
      participants: input.participants,
      snapshotForReasoning: input.endSnapshot,
      startSnapshot: input.startSnapshot,
      pnlSnapshot: input.endSnapshot,
    });

    const generatedAt = new Date().toISOString();
    const resultHash = buildResultHash({
      roundId: input.roundId.toString(),
      generatedAt,
      startSnapshot: input.startSnapshot,
      endSnapshot: input.endSnapshot,
      agentDecisions: ranked.map((result) => ({
        agentId: result.agentId.toString(),
        owner: result.owner,
        name: result.name,
        image: result.image,
        personality: result.personality,
        tradingStyle: result.tradingStyle,
        isHouseAgent: result.isHouseAgent,
        action: result.decision.action,
        asset: result.decision.asset,
        confidence: result.decision.confidence,
        rationale: result.decision.rationale,
        finalPnlBps: result.finalPnlBps,
        rank: result.rank,
      })),
    });

    return {
      roundId: input.roundId,
      generatedAt,
      startSnapshot: input.startSnapshot,
      endSnapshot: input.endSnapshot,
      agentDecisions: ranked,
      resultHash,
    };
  }

  private async rankAgentDecisions(input: {
    roundId: bigint;
    participants: AgentProfile[];
    snapshotForReasoning: MarketSnapshot;
    startSnapshot: MarketSnapshot;
    pnlSnapshot: MarketSnapshot;
  }): Promise<AgentRoundResult[]> {
    const agentDecisions = await Promise.all(
      input.participants.map(async (participant) => {
        const decision = await this.openRouterService.generateDecision(
          participant,
          input.roundId,
          input.snapshotForReasoning,
        );
        return {
          participant,
          decision,
          finalPnlBps: computePnlBps(decision, input.startSnapshot, input.pnlSnapshot),
        };
      }),
    );

    return [...agentDecisions]
      .sort((left, right) => {
        if (left.finalPnlBps !== right.finalPnlBps) {
          return right.finalPnlBps - left.finalPnlBps;
        }
        return left.participant.agentId < right.participant.agentId ? -1 : 1;
      })
      .map<AgentRoundResult>((entry, index) => ({
        agentId: entry.participant.agentId,
        owner: entry.participant.owner,
        name: entry.participant.name,
        image: entry.participant.image,
        personality: entry.participant.personality,
        tradingStyle: entry.participant.tradingStyle,
        isHouseAgent: entry.participant.isHouseAgent,
        decision: entry.decision,
        finalPnlBps: entry.finalPnlBps,
        rank: index + 1,
      }));
  }
}

function computePnlBps(
  decision: AgentDecision,
  startSnapshot: MarketSnapshot,
  endSnapshot: MarketSnapshot,
) {
  if (decision.action === "HOLD") {
    return 0;
  }

  const startPrice = startSnapshot.prices[decision.asset].price;
  const endPrice = endSnapshot.prices[decision.asset].price;
  if (startPrice <= 0) {
    return 0;
  }

  const pnlRatio = decision.action === "LONG"
    ? (endPrice - startPrice) / startPrice
    : (startPrice - endPrice) / startPrice;

  return Math.max(-10_000, Math.round(pnlRatio * 10_000));
}

function buildResultHash(payload: Record<string, unknown>) {
  return keccak256(stringToHex(stableStringify(payload)));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

  return `{${entries.join(",")}}`;
}
