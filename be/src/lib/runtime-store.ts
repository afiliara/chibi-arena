import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  PersistedRuntimeState,
  PreparedRoundResult,
  SerializedAgentRoundPreview,
  SerializedPreparedRoundResult,
  SerializedTrackedRoundState,
  TrackedRoundState,
} from "../types.js";

export class RuntimeStore {
  private readonly statePath: string;
  private readonly resultsDir: string;

  constructor(private readonly runtimeDir: string) {
    this.statePath = path.join(runtimeDir, "round-state.json");
    this.resultsDir = path.join(runtimeDir, "results");
  }

  async init() {
    await mkdir(this.runtimeDir, { recursive: true });
    await mkdir(this.resultsDir, { recursive: true });
  }

  async readState(): Promise<PersistedRuntimeState | null> {
    try {
      const raw = await readFile(this.statePath, "utf8");
      return JSON.parse(raw) as PersistedRuntimeState;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }
      throw error;
    }
  }

  async writeState(state: PersistedRuntimeState) {
    await writeFile(this.statePath, JSON.stringify(state, null, 2), "utf8");
  }

  async clearState() {
    await rm(this.statePath, { force: true });
  }

  async writeRoundResult(result: PreparedRoundResult) {
    const filePath = this.getRoundResultPath(result.roundId);
    const serialized: SerializedPreparedRoundResult = {
      roundId: result.roundId.toString(),
      generatedAt: result.generatedAt,
      startSnapshot: result.startSnapshot,
      endSnapshot: result.endSnapshot,
      agentDecisions: result.agentDecisions.map((decision) => ({
        agentId: decision.agentId.toString(),
        owner: decision.owner,
        name: decision.name,
        image: decision.image,
        personality: decision.personality,
        tradingStyle: decision.tradingStyle,
        isHouseAgent: decision.isHouseAgent,
        decision: decision.decision,
        finalPnlBps: decision.finalPnlBps,
        rank: decision.rank,
      })),
      resultHash: result.resultHash,
    };

    await writeFile(filePath, JSON.stringify(serialized, null, 2), "utf8");
  }

  async readRoundResult(roundId: bigint): Promise<PreparedRoundResult | null> {
    try {
      const raw = await readFile(this.getRoundResultPath(roundId), "utf8");
      const parsed = JSON.parse(raw) as SerializedPreparedRoundResult;
      return {
        roundId: BigInt(parsed.roundId),
        generatedAt: parsed.generatedAt,
        startSnapshot: parsed.startSnapshot,
        endSnapshot: parsed.endSnapshot,
        agentDecisions: parsed.agentDecisions.map((decision) => ({
          agentId: BigInt(decision.agentId),
          owner: decision.owner,
          name: decision.name,
          image: decision.image,
          personality: decision.personality,
          tradingStyle: decision.tradingStyle,
          isHouseAgent: decision.isHouseAgent,
          decision: decision.decision,
          finalPnlBps: decision.finalPnlBps,
          rank: decision.rank,
        })),
        resultHash: parsed.resultHash,
      };
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }
      throw error;
    }
  }

  async readLatestRoundResult(): Promise<PreparedRoundResult | null> {
    const roundIds = await this.listStoredRoundIds();
    const latestRoundId = roundIds.sort((left, right) => Number(right - left))[0];
    if (latestRoundId === undefined) {
      return null;
    }

    return this.readRoundResult(latestRoundId);
  }

  serializeTrackedRound(state: TrackedRoundState): SerializedTrackedRoundState {
    return {
      roundId: state.roundId.toString(),
      stakeOpenAt: state.stakeOpenAt,
      stakeCloseAt: state.stakeCloseAt,
      trackedAt: state.trackedAt,
      participantIds: state.participantIds.map((agentId) => agentId.toString()),
      participants: state.participants.map((participant) => ({
        agentId: participant.agentId.toString(),
        owner: participant.owner,
        isHouseAgent: participant.isHouseAgent,
        isActive: participant.isActive,
        remainingBond: participant.remainingBond.toString(),
        configHash: participant.configHash,
        lastJoinedRoundId: participant.lastJoinedRoundId.toString(),
        lastSettledRoundId: participant.lastSettledRoundId.toString(),
        agentUri: participant.agentUri,
        image: participant.image,
        name: participant.name,
        personality: participant.personality,
        tradingStyle: participant.tradingStyle,
      })),
      startSnapshot: state.startSnapshot,
      latestSnapshot: state.latestSnapshot,
      previewDecisions: state.previewDecisions.map((decision) => serializePreviewDecision(decision)),
      previewUpdatedAt: state.previewUpdatedAt,
    };
  }

  deserializeTrackedRound(state: SerializedTrackedRoundState): TrackedRoundState {
    return {
      roundId: BigInt(state.roundId),
      stakeOpenAt: state.stakeOpenAt,
      stakeCloseAt: state.stakeCloseAt,
      trackedAt: state.trackedAt,
      participantIds: state.participantIds.map((agentId) => BigInt(agentId)),
      participants: state.participants.map((participant) => ({
        agentId: BigInt(participant.agentId),
        owner: participant.owner,
        isHouseAgent: participant.isHouseAgent,
        isActive: participant.isActive,
        remainingBond: BigInt(participant.remainingBond),
        configHash: participant.configHash,
        lastJoinedRoundId: BigInt(participant.lastJoinedRoundId),
        lastSettledRoundId: BigInt(participant.lastSettledRoundId),
        agentUri: participant.agentUri,
        image: participant.image,
        name: participant.name,
        personality: participant.personality,
        tradingStyle: participant.tradingStyle,
      })),
      startSnapshot: state.startSnapshot,
      latestSnapshot: state.latestSnapshot ?? state.startSnapshot,
      previewDecisions: (state.previewDecisions ?? []).map((decision) => deserializePreviewDecision(decision)),
      previewUpdatedAt: state.previewUpdatedAt ?? null,
    };
  }

  private getRoundResultPath(roundId: bigint) {
    return path.join(this.resultsDir, `round-${roundId.toString()}.json`);
  }

  private async listStoredRoundIds() {
    try {
      const entries = await readdir(this.resultsDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name.match(/^round-(\d+)\.json$/)?.[1] ?? null)
        .filter((value): value is string => value !== null)
        .map((value) => BigInt(value));
    } catch (error) {
      if (isMissingFileError(error)) {
        return [];
      }
      throw error;
    }
  }
}

function serializePreviewDecision(decision: TrackedRoundState["previewDecisions"][number]): SerializedAgentRoundPreview {
  return {
    agentId: decision.agentId.toString(),
    owner: decision.owner,
    name: decision.name,
    image: decision.image,
    personality: decision.personality,
    tradingStyle: decision.tradingStyle,
    isHouseAgent: decision.isHouseAgent,
    decision: decision.decision,
    previewPnlBps: decision.previewPnlBps,
    previewRank: decision.previewRank,
  };
}

function deserializePreviewDecision(decision: SerializedAgentRoundPreview): TrackedRoundState["previewDecisions"][number] {
  return {
    agentId: BigInt(decision.agentId),
    owner: decision.owner,
    name: decision.name,
    image: decision.image,
    personality: decision.personality,
    tradingStyle: decision.tradingStyle,
    isHouseAgent: decision.isHouseAgent,
    decision: decision.decision,
    previewPnlBps: decision.previewPnlBps,
    previewRank: decision.previewRank,
  };
}

function isMissingFileError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
