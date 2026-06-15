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
        const decision = await generateArenaDecision(
          participant,
          input.roundId,
          input.startSnapshot,
          input.snapshotForReasoning,
          this.openRouterService,
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

async function generateArenaDecision(
  participant: AgentProfile,
  roundId: bigint,
  startSnapshot: MarketSnapshot,
  currentSnapshot: MarketSnapshot,
  openRouterService: OpenRouterService,
): Promise<AgentDecision> {
  const houseProfile = resolveHouseStrategyProfile(participant);
  if (!houseProfile) {
    return openRouterService.generateDecision(participant, roundId, currentSnapshot);
  }

  return buildHouseDecision(houseProfile, startSnapshot, currentSnapshot);
}

function resolveHouseStrategyProfile(participant: AgentProfile) {
  const key = participant.configHash.toLowerCase();
  if (key === keccak256(stringToHex("BLITZ")).toLowerCase() || participant.name.toUpperCase() === "BLITZ") {
    return "BLITZ" as const;
  }
  if (key === keccak256(stringToHex("NOVA")).toLowerCase() || participant.name.toUpperCase() === "NOVA") {
    return "NOVA" as const;
  }
  if (key === keccak256(stringToHex("BYTE")).toLowerCase() || participant.name.toUpperCase() === "BYTE") {
    return "BYTE" as const;
  }
  if (key === keccak256(stringToHex("ZENITH")).toLowerCase() || participant.name.toUpperCase() === "ZENITH") {
    return "ZENITH" as const;
  }
  return null;
}

function buildHouseDecision(
  houseProfile: "BLITZ" | "NOVA" | "BYTE" | "ZENITH",
  startSnapshot: MarketSnapshot,
  currentSnapshot: MarketSnapshot,
): AgentDecision {
  const changes = getAssetChanges(startSnapshot, currentSnapshot);
  const strongest = changes[0];
  const weakest = changes[changes.length - 1];
  const positives = changes.filter((change) => change.changePct > 0);
  const negatives = changes.filter((change) => change.changePct < 0);
  const secondStrongest = changes[1] ?? strongest;

  switch (houseProfile) {
    case "BLITZ": {
      const target = [...changes].sort((left, right) => Math.abs(right.changePct) - Math.abs(left.changePct))[0];
      const action = target.changePct >= 0 ? "LONG" : "SHORT";
      return {
        action,
        asset: target.symbol,
        confidence: toConfidence(Math.abs(target.changePct), 68, 28),
        rationale: `Aggressive momentum locks onto ${target.symbol} after the sharpest ${target.changePct >= 0 ? "upside" : "downside"} burst of the round.`,
      };
    }
    case "NOVA": {
      const target = positives[1]
        ?? positives.find((change) => change.symbol === "ETH")
        ?? positives.find((change) => change.symbol === "BTC")
        ?? positives[0]
        ?? (negatives[0] ?? strongest);
      const action = positives.length > 0 ? "LONG" : "SHORT";
      return {
        action,
        asset: target.symbol,
        confidence: toConfidence(Math.abs(target.changePct), 60, 24),
        rationale: `Breakout rotation shifts into ${target.symbol} as NOVA hunts the next expansion lane behind the first mover.`,
      };
    }
    case "BYTE": {
      const target = strongest.changePct > 0 ? strongest : weakest.changePct < 0 ? weakest : secondStrongest;
      const action = strongest.changePct > 0 ? "SHORT" : weakest.changePct < 0 ? "LONG" : "HOLD";
      return {
        action,
        asset: target.symbol,
        confidence: action === "HOLD" ? 48 : toConfidence(Math.abs(target.changePct), 58, 20),
        rationale: action === "HOLD"
          ? `Mean-reversion signals are weak, so BYTE stays patient while dispersion remains compressed.`
          : `Analyst mode fades the most stretched ${target.symbol} move, expecting reversion after an overextended impulse.`,
      };
    }
    case "ZENITH": {
      const majors = changes.filter((change) => change.symbol !== "SOL");
      const safestPositive = [...majors].sort((left, right) => left.changePct - right.changePct).find((change) => change.changePct > 0);
      const safestNegative = [...majors].sort((left, right) => right.changePct - left.changePct).find((change) => change.changePct < 0);
      if (!safestPositive && !safestNegative) {
        return {
          action: "HOLD",
          asset: "BTC",
          confidence: 42,
          rationale: "Defensive posture stays flat while major assets fail to offer a clean low-risk edge.",
        };
      }

      if (safestPositive && Math.abs(safestPositive.changePct) >= 0.08) {
        return {
          action: "LONG",
          asset: safestPositive.symbol,
          confidence: toConfidence(Math.abs(safestPositive.changePct), 52, 16),
          rationale: `Conservative capital rotates into ${safestPositive.symbol}, taking the steadiest major-asset uptrend on the board.`,
        };
      }

      return {
        action: "SHORT",
        asset: (safestNegative ?? weakest).symbol,
        confidence: toConfidence(Math.abs((safestNegative ?? weakest).changePct), 50, 16),
        rationale: `Risk-off mode leans short ${(safestNegative ?? weakest).symbol} as ZENITH protects capital against the softest major trend.`,
      };
    }
  }
}

function getAssetChanges(startSnapshot: MarketSnapshot, currentSnapshot: MarketSnapshot) {
  return (["BTC", "ETH", "SOL"] as const)
    .map((symbol) => {
      const start = startSnapshot.prices[symbol].price;
      const current = currentSnapshot.prices[symbol].price;
      const changePct = start > 0 ? ((current - start) / start) * 100 : 0;
      return { symbol, changePct };
    })
    .sort((left, right) => right.changePct - left.changePct);
}

function toConfidence(changePctAbs: number, base: number, scaler: number) {
  return Math.max(35, Math.min(95, Math.round(base + changePctAbs * scaler)));
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
