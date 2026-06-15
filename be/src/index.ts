import cors from "cors";
import express from "express";

import { config } from "./config.js";
import { RuntimeStore } from "./lib/runtime-store.js";
import { BattleEngine } from "./services/battle-engine.js";
import { ChainService } from "./services/chain-service.js";
import { MarketService } from "./services/market-service.js";
import { OpenRouterService } from "./services/openrouter-service.js";
import { SchedulerService } from "./services/scheduler.js";

const app = express();

const runtimeStore = new RuntimeStore(config.runtimeDir);
const chainService = new ChainService();
const marketService = new MarketService();
const openRouterService = new OpenRouterService();
const battleEngine = new BattleEngine(openRouterService);
const schedulerService = new SchedulerService(
  chainService,
  marketService,
  battleEngine,
  runtimeStore,
);

app.use(cors({
  origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN,
}));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: config.SERVICE_NAME,
    chainId: config.MANTLE_CHAIN_ID,
    schedulerEnabled: config.SCHEDULER_ENABLED,
  });
});

app.get("/status", (_req, res) => {
  res.json({
    ok: true,
    ...schedulerService.getStatusSnapshot(),
  });
});

app.get("/round/current", async (_req, res) => {
  const currentRound = await schedulerService.getCurrentRoundSummary();
  res.json({
    ok: true,
    round: currentRound,
  });
});

app.get("/round/:roundId/result", async (req, res) => {
  const roundId = parseRoundId(req.params.roundId);
  const result = await schedulerService.getStoredRoundResult(roundId)
    ?? await chainService.reconstructSettledRoundResult(roundId);
  if (!result) {
    res.status(404).json({
      ok: false,
      error: `No stored result found for round ${roundId.toString()}.`,
    });
    return;
  }

  const enrichedResult = await enrichRoundResult(roundId, result);
  res.json({
    ok: true,
    result: {
      ...enrichedResult,
      roundId: enrichedResult.roundId.toString(),
      agentDecisions: enrichedResult.agentDecisions.map((decision) => ({
        ...decision,
        agentId: decision.agentId.toString(),
      })),
    },
  });
});

app.get("/overview", async (_req, res) => {
  const status = schedulerService.getStatusSnapshot();
  const currentRound = await schedulerService.getCurrentRoundSummary();
  const statusSettledRoundId = safeBigInt(status.lastSettledRoundId);
  const historyRounds = await buildHistoryRounds(currentRound, statusSettledRoundId).catch(() => []);
  const storedLatestResult = await schedulerService.getLatestStoredRoundResult().catch(() => null);
  const latestSettledRoundId = statusSettledRoundId
    ?? storedLatestResult?.roundId
    ?? inferLatestSettledRoundId(historyRounds)
    ?? await chainService.getLatestSettledRoundId().catch(() => null);
  const latestResult = latestSettledRoundId
    ? await schedulerService.getStoredRoundResult(latestSettledRoundId).catch(() => null)
      ?? await chainService.reconstructSettledRoundResult(latestSettledRoundId).catch(() => null)
    : storedLatestResult;
  const enrichedLatestResult = latestResult
    ? await enrichRoundResult(latestResult.roundId, latestResult).catch(() => latestResult)
    : null;
  const liveMarketSnapshot = await marketService.getLatestSnapshot().catch(() => null);

  res.json({
    ok: true,
    service: config.SERVICE_NAME,
    status,
    currentRound,
    liveMarketSnapshot,
    historyRounds,
    latestSettledRoundId: latestSettledRoundId?.toString() ?? null,
    latestResult: enrichedLatestResult
      ? {
          ...enrichedLatestResult,
          roundId: enrichedLatestResult.roundId.toString(),
          agentDecisions: enrichedLatestResult.agentDecisions.map((decision) => ({
            ...decision,
            agentId: decision.agentId.toString(),
          })),
        }
      : null,
  });
});

app.post("/operator/tick", async (_req, res) => {
  const snapshot = await schedulerService.tick();
  res.json({
    ok: true,
    snapshot,
  });
});

app.post("/operator/run-current-round", async (_req, res) => {
  const result = await schedulerService.runCurrentRound();
  res.json({
    ok: true,
    result: {
      ...result,
      roundId: result.roundId.toString(),
      agentDecisions: result.agentDecisions.map((decision) => ({
        ...decision,
        agentId: decision.agentId.toString(),
      })),
    },
  });
});

app.post("/operator/settle-current-round", async (_req, res) => {
  const settlement = await schedulerService.settleCurrentRound();
  res.json({
    ok: true,
    settlement: {
      ...settlement,
      roundId: settlement.roundId.toString(),
    },
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  res.status(500).json({
    ok: false,
    error: message,
  });
});

async function main() {
  await schedulerService.boot();
  schedulerService.start();

  app.listen(config.PORT, () => {
    console.log(`${config.SERVICE_NAME} running on http://localhost:${config.PORT}`);
  });
}

void main();

function parseRoundId(value: string) {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid round id: ${value}`);
  }
}

async function enrichRoundResult(
  roundId: bigint,
  result: Awaited<ReturnType<SchedulerService["getStoredRoundResult"]>> extends infer T
    ? Exclude<T, null>
    : never,
) {
  const settlementTxHash = result.submitTxHash ?? await chainService.getRoundSettlementTxHash(roundId).catch(() => null);
  const shouldHydrateProfiles = result.agentDecisions.some((decision) =>
    !decision.image || !decision.personality || !decision.tradingStyle
  );

  if (!shouldHydrateProfiles) {
    return {
      ...result,
      submitTxHash: settlementTxHash ?? undefined,
    };
  }

  const profiles = await chainService.getParticipantsWithProfiles(roundId).catch(() => ({
    participantIds: [] as bigint[],
    participants: [],
  }));
  const profileByAgentId = new Map(
    profiles.participants.map((participant) => [participant.agentId.toString(), participant]),
  );

  return {
    ...result,
    submitTxHash: settlementTxHash ?? undefined,
    agentDecisions: result.agentDecisions.map((decision) => {
      const profile = profileByAgentId.get(decision.agentId.toString());
      if (!profile) {
        return decision;
      }

      return {
        ...decision,
        name: decision.name || profile.name,
        image: decision.image ?? profile.image,
        personality: decision.personality || profile.personality,
        tradingStyle: decision.tradingStyle || profile.tradingStyle,
        isHouseAgent: decision.isHouseAgent ?? profile.isHouseAgent,
      };
    }),
  };
}

async function buildHistoryRounds(
  currentRound: Awaited<ReturnType<SchedulerService["getCurrentRoundSummary"]>>,
  latestSettledRoundId: bigint | null,
) {
  const storedRoundIds = await runtimeStore.listRoundResultIds().catch(() => []);
  const roundIds = new Set<bigint>(storedRoundIds);
  const lastRoundId = await chainService.getLastRoundId().catch(() => 0n);
  if (lastRoundId > 0n) {
    roundIds.add(lastRoundId);
    if (lastRoundId > 1n) {
      roundIds.add(lastRoundId - 1n);
    }
  }
  if (currentRound) {
    roundIds.add(BigInt(currentRound.roundId));
  }
  if (latestSettledRoundId) {
    roundIds.add(latestSettledRoundId);
  }

  const orderedRoundIds = [...roundIds].sort((left, right) => Number(right - left));
  const rounds: Array<{
    roundId: string;
    status: "live" | "settled" | "locked";
    participantCount: number;
    prizePool: string;
    resultHash?: `0x${string}`;
    submitTxHash?: `0x${string}`;
    winnerName?: string | null;
    agents: Array<{
      name: string;
      image?: string;
      personality?: string;
      }>;
  }> = [];

  for (const roundId of orderedRoundIds) {
    if (currentRound && currentRound.roundId === roundId.toString()) {
      rounds.push({
        roundId: roundId.toString(),
        status: "live",
        participantCount: currentRound.participantIds.length,
        prizePool: "0",
        agents: currentRound.participants.map((participant) => ({
          name: participant.name,
          image: participant.image,
          personality: participant.personality,
        })),
      });
      continue;
    }

    const round = await chainService.getRound(roundId).catch(() => null);
    const storedResult = await schedulerService.getStoredRoundResult(roundId).catch(() => null);
    const settledResult = storedResult
      ?? (round?.status === 3 ? await chainService.reconstructSettledRoundResult(roundId).catch(() => null) : null);

    if (settledResult) {
      const enriched = await enrichRoundResult(roundId, settledResult).catch(() => settledResult);
      rounds.push({
        roundId: roundId.toString(),
        status: "settled",
        participantCount: enriched.agentDecisions.length,
        prizePool: round?.totalStaked.toString() ?? "0",
        resultHash: enriched.resultHash,
        submitTxHash: enriched.submitTxHash,
        winnerName: enriched.agentDecisions[0]?.name ?? null,
        agents: enriched.agentDecisions.map((decision) => ({
          name: decision.name,
          image: decision.image,
          personality: decision.personality,
        })),
      });
      continue;
    }

    if (!round) {
      rounds.push({
        roundId: roundId.toString(),
        status: latestSettledRoundId === roundId ? "settled" : "locked",
        participantCount: 0,
        prizePool: "0",
        agents: [],
      });
      continue;
    }

    rounds.push({
      roundId: roundId.toString(),
      status: round.status === 2 ? "locked" : "live",
      participantCount: round.participantCount,
      prizePool: round.totalStaked.toString(),
      resultHash: round.resultHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? round.resultHash : undefined,
      agents: [],
    });
  }

  return rounds;
}

function inferLatestSettledRoundId(
  rounds: Awaited<ReturnType<typeof buildHistoryRounds>>,
) {
  const settledRound = rounds.find((round) => round.status === "settled");
  return settledRound ? BigInt(settledRound.roundId) : null;
}

function safeBigInt(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}
