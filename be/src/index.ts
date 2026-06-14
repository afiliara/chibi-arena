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
  const result = await schedulerService.getStoredRoundResult(roundId);
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
  const latestSettledRoundId = status.lastSettledRoundId ? BigInt(status.lastSettledRoundId) : null;
  const latestResult = latestSettledRoundId
    ? await schedulerService.getStoredRoundResult(latestSettledRoundId)
    : await schedulerService.getLatestStoredRoundResult();
  const resolvedSettledRoundId = latestSettledRoundId ?? latestResult?.roundId ?? null;
  const enrichedLatestResult = latestResult
    ? await enrichRoundResult(latestResult.roundId, latestResult)
    : null;
  const liveMarketSnapshot = await marketService.getLatestSnapshot().catch(() => null);

  res.json({
    ok: true,
    service: config.SERVICE_NAME,
    status,
    currentRound,
    liveMarketSnapshot,
    latestSettledRoundId: resolvedSettledRoundId?.toString() ?? null,
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
  const shouldHydrateProfiles = result.agentDecisions.some((decision) =>
    !decision.image || !decision.personality || !decision.tradingStyle
  );

  if (!shouldHydrateProfiles) {
    return result;
  }

  const profiles = await chainService.getParticipantsWithProfiles(roundId);
  const profileByAgentId = new Map(
    profiles.participants.map((participant) => [participant.agentId.toString(), participant]),
  );

  return {
    ...result,
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
