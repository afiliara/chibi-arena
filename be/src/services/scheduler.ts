import { config } from "../config.js";
import { RuntimeStore } from "../lib/runtime-store.js";
import type { PersistedRuntimeState, PreparedRoundResult, RuntimeStatus, TrackedRoundState } from "../types.js";
import { BattleEngine } from "./battle-engine.js";
import { ChainService } from "./chain-service.js";
import { MarketService } from "./market-service.js";

export class SchedulerService {
  private intervalHandle: NodeJS.Timeout | null = null;
  private activeRound: TrackedRoundState | null = null;
  private status: RuntimeStatus = "idle";
  private lastTickAt: string | null = null;
  private lastSettledRoundId: bigint | null = null;
  private lastError: string | null = null;
  private lastLockTxHash: `0x${string}` | null = null;
  private lastSubmitTxHash: `0x${string}` | null = null;
  private isTickRunning = false;
  private lastPreviewRefreshAt = 0;

  constructor(
    private readonly chainService: ChainService,
    private readonly marketService: MarketService,
    private readonly battleEngine: BattleEngine,
    private readonly runtimeStore: RuntimeStore,
  ) {}

  async boot() {
    await this.runtimeStore.init();
    const persisted = await this.runtimeStore.readState();
    if (persisted) {
      this.activeRound = persisted.activeRound
        ? this.runtimeStore.deserializeTrackedRound(persisted.activeRound)
        : null;
      this.status = persisted.status;
      this.lastTickAt = persisted.lastTickAt;
      this.lastSettledRoundId = persisted.lastSettledRoundId ? BigInt(persisted.lastSettledRoundId) : null;
      this.lastError = persisted.lastError;
      this.lastLockTxHash = persisted.lastLockTxHash;
      this.lastSubmitTxHash = persisted.lastSubmitTxHash;
    }

    if (!this.lastSettledRoundId) {
      const latestResult = await this.runtimeStore.readLatestRoundResult();
      if (latestResult) {
        this.lastSettledRoundId = latestResult.roundId;
      }
    }
  }

  start() {
    if (!config.SCHEDULER_ENABLED || this.intervalHandle) {
      return;
    }

    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, config.SCHEDULER_POLL_INTERVAL_MS);
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async tick() {
    if (this.isTickRunning) {
      return this.getStatusSnapshot();
    }

    this.isTickRunning = true;
    this.lastTickAt = new Date().toISOString();

    try {
      if (this.activeRound) {
        const round = await this.chainService.getRound(this.activeRound.roundId);

        if (round.status === 3) {
          this.status = "settled";
          this.lastSettledRoundId = round.roundId;
          this.activeRound = null;
          this.lastError = null;
          await this.persistState();
          return this.getStatusSnapshot();
        }

        if (round.status === 2 || Date.now() >= this.activeRound.stakeCloseAt * 1000) {
          await this.settleCurrentRound();
          return this.getStatusSnapshot();
        }

        await this.refreshActiveRoundLiveState();
        this.status = "tracking";
        this.lastError = null;
        await this.persistState();
        return this.getStatusSnapshot();
      }

      const currentOpenRoundId = await this.chainService.getCurrentOpenRoundId();
      if (currentOpenRoundId === 0n) {
        this.status = "idle";
        this.lastError = null;
        await this.persistState();
        return this.getStatusSnapshot();
      }

      await this.trackRound(currentOpenRoundId);
      return this.getStatusSnapshot();
    } catch (error) {
      this.status = "error";
      this.lastError = error instanceof Error ? error.message : "Unknown scheduler error";
      await this.persistState();
      return this.getStatusSnapshot();
    } finally {
      this.isTickRunning = false;
    }
  }

  async runCurrentRound() {
    if (!this.activeRound) {
      const currentOpenRoundId = await this.chainService.getCurrentOpenRoundId();
      if (currentOpenRoundId === 0n) {
        throw new Error("No active round to run.");
      }
      await this.trackRound(currentOpenRoundId);
    }

    this.status = "settling";
    const preparedResult = await this.prepareCurrentRoundResult({ useCache: false, persist: true });
    this.lastError = null;
    await this.persistState();
    return preparedResult;
  }

  async settleCurrentRound() {
    if (!this.activeRound) {
      throw new Error("No tracked round to settle.");
    }

    this.status = "settling";
    const roundId = this.activeRound.roundId;
    const round = await this.chainService.getRound(roundId);
    const preparedResult = await this.prepareCurrentRoundResult({
      useCache: round.status === 2,
      persist: true,
    });

    if (round.status === 1) {
      this.lastLockTxHash = await this.chainService.lockRound(roundId);
    } else if (round.status !== 2) {
      throw new Error(`Round ${roundId.toString()} is not open or locked.`);
    }

    const agentIds = preparedResult.agentDecisions.map((decision) => decision.agentId);
    const ranks = preparedResult.agentDecisions.map((decision) => BigInt(decision.rank));
    const finalPnlBps = preparedResult.agentDecisions.map((decision) => BigInt(decision.finalPnlBps));
    this.lastSubmitTxHash = await this.chainService.submitRoundResult({
      roundId,
      agentIds,
      ranks,
      finalPnlBps,
      resultHash: preparedResult.resultHash,
    });
    preparedResult.submitTxHash = this.lastSubmitTxHash;
    await this.runtimeStore.writeRoundResult(preparedResult);

    this.status = "settled";
    this.lastSettledRoundId = roundId;
    this.activeRound = null;
    this.lastError = null;
    await this.persistState();

    return {
      roundId,
      lockTxHash: this.lastLockTxHash,
      submitTxHash: this.lastSubmitTxHash,
      resultHash: preparedResult.resultHash,
    };
  }

  async getCurrentRoundSummary() {
    if (!this.activeRound) {
      return null;
    }

    return {
      roundId: this.activeRound.roundId.toString(),
      stakeOpenAt: this.activeRound.stakeOpenAt,
      stakeCloseAt: this.activeRound.stakeCloseAt,
      trackedAt: this.activeRound.trackedAt,
      participantIds: this.activeRound.participantIds.map((agentId) => agentId.toString()),
      participants: this.activeRound.participants.map((participant) => ({
        agentId: participant.agentId.toString(),
        name: participant.name,
        image: participant.image,
        personality: participant.personality,
        tradingStyle: participant.tradingStyle,
        isHouseAgent: participant.isHouseAgent,
        owner: participant.owner,
        remainingBond: participant.remainingBond.toString(),
      })),
      startSnapshot: this.activeRound.startSnapshot,
      latestSnapshot: this.activeRound.latestSnapshot,
      previewUpdatedAt: this.activeRound.previewUpdatedAt,
      previewDecisions: this.activeRound.previewDecisions.map((decision) => ({
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
      })),
      runtimeStatus: this.status,
    };
  }

  async getStoredRoundResult(roundId: bigint) {
    return this.runtimeStore.readRoundResult(roundId);
  }

  async getLatestStoredRoundResult() {
    return this.runtimeStore.readLatestRoundResult();
  }

  getStatusSnapshot() {
    return {
      enabled: config.SCHEDULER_ENABLED,
      pollIntervalMs: config.SCHEDULER_POLL_INTERVAL_MS,
      status: this.status,
      activeRoundId: this.activeRound?.roundId.toString() ?? null,
      lastTickAt: this.lastTickAt,
      lastSettledRoundId: this.lastSettledRoundId?.toString() ?? null,
      lastError: this.lastError,
      lastLockTxHash: this.lastLockTxHash,
      lastSubmitTxHash: this.lastSubmitTxHash,
    };
  }

  private async trackRound(roundId: bigint) {
    const [round, participants] = await Promise.all([
      this.chainService.getRound(roundId),
      this.chainService.getParticipantsWithProfiles(roundId),
    ]);

    const startSnapshot = await this.marketService.getLatestSnapshot();
    this.activeRound = {
      roundId,
      stakeOpenAt: round.stakeOpenAt,
      stakeCloseAt: round.stakeCloseAt,
      trackedAt: new Date().toISOString(),
      participantIds: [...participants.participantIds],
      participants: participants.participants,
      startSnapshot,
      latestSnapshot: startSnapshot,
      previewDecisions: [],
      previewUpdatedAt: null,
    };
    await this.refreshActiveRoundLiveState({ forcePreview: true });
    this.status = "tracking";
    this.lastError = null;
    await this.persistState();
  }

  private async prepareCurrentRoundResult(options: { useCache: boolean; persist: boolean }): Promise<PreparedRoundResult> {
    if (!this.activeRound) {
      throw new Error("No tracked round to prepare.");
    }

    if (options.useCache) {
      const persisted = await this.runtimeStore.readRoundResult(this.activeRound.roundId);
      if (persisted) {
        return persisted;
      }
    }

    const endSnapshot = await this.marketService.getLatestSnapshot();
    const preparedResult = await this.battleEngine.prepareRoundResult({
      roundId: this.activeRound.roundId,
      participants: this.activeRound.participants,
      startSnapshot: this.activeRound.startSnapshot,
      endSnapshot,
    });
    if (options.persist) {
      await this.runtimeStore.writeRoundResult(preparedResult);
    }
    return preparedResult;
  }

  private async persistState() {
    const state: PersistedRuntimeState = {
      status: this.status,
      activeRound: this.activeRound ? this.runtimeStore.serializeTrackedRound(this.activeRound) : null,
      lastTickAt: this.lastTickAt,
      lastSettledRoundId: this.lastSettledRoundId?.toString() ?? null,
      lastError: this.lastError,
      lastLockTxHash: this.lastLockTxHash,
      lastSubmitTxHash: this.lastSubmitTxHash,
    };
    await this.runtimeStore.writeState(state);
  }

  private async refreshActiveRoundLiveState(options: { forcePreview?: boolean } = {}) {
    if (!this.activeRound) {
      return;
    }

    const latestSnapshot = await this.marketService.getLatestSnapshot();
    this.activeRound.latestSnapshot = latestSnapshot;

    const now = Date.now();
    const shouldRefreshPreview = options.forcePreview
      || this.activeRound.previewDecisions.length === 0
      || now - this.lastPreviewRefreshAt >= config.DECISION_PREVIEW_INTERVAL_MS;

    if (!shouldRefreshPreview) {
      return;
    }

    const previewDecisions = await this.battleEngine.prepareLivePreview({
      roundId: this.activeRound.roundId,
      participants: this.activeRound.participants,
      startSnapshot: this.activeRound.startSnapshot,
      currentSnapshot: latestSnapshot,
    });

    this.activeRound.previewDecisions = previewDecisions;
    this.activeRound.previewUpdatedAt = new Date().toISOString();
    this.lastPreviewRefreshAt = now;
  }
}
