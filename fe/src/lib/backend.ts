function requirePublicEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required public env: ${name}`);
  }
  return value;
}

export const m2BackendUrl = requirePublicEnv(
  process.env.NEXT_PUBLIC_M2_BE_URL,
  "NEXT_PUBLIC_M2_BE_URL",
);

export type BackendStatusSnapshot = {
  enabled: boolean;
  pollIntervalMs: number;
  status: "idle" | "tracking" | "settling" | "settled" | "error";
  activeRoundId: string | null;
  lastTickAt: string | null;
  lastSettledRoundId: string | null;
  lastError: string | null;
  lastLockTxHash: `0x${string}` | null;
  lastSubmitTxHash: `0x${string}` | null;
};

export type BackendMarketSnapshot = {
  source: "pyth";
  capturedAt: number;
  prices: Record<"BTC" | "ETH" | "SOL", {
    symbol: "BTC" | "ETH" | "SOL";
    price: number;
    publishTime: number;
  }>;
};

export type BackendParticipant = {
  agentId: string;
  name: string;
  image?: string;
  personality: string;
  tradingStyle: string;
  isHouseAgent: boolean;
  owner: `0x${string}`;
  remainingBond: string;
};

export type BackendPreviewDecision = {
  agentId: string;
  owner: `0x${string}`;
  name: string;
  image?: string;
  personality: string;
  tradingStyle: string;
  isHouseAgent: boolean;
  decision: {
    action: "LONG" | "SHORT" | "HOLD";
    asset: "BTC" | "ETH" | "SOL";
    confidence: number;
    rationale: string;
  };
  previewPnlBps: number;
  previewRank: number;
};

export type BackendCurrentRound = {
  roundId: string;
  stakeOpenAt: number;
  stakeCloseAt: number;
  trackedAt: string;
  participantIds: string[];
  participants: BackendParticipant[];
  startSnapshot: BackendMarketSnapshot;
  latestSnapshot: BackendMarketSnapshot;
  previewUpdatedAt: string | null;
  previewDecisions: BackendPreviewDecision[];
  runtimeStatus: BackendStatusSnapshot["status"];
};

export type BackendAgentDecision = {
  agentId: string;
  owner: `0x${string}`;
  name: string;
  image?: string;
  personality: string;
  tradingStyle: string;
  isHouseAgent: boolean;
  decision: {
    action: "LONG" | "SHORT" | "HOLD";
    asset: "BTC" | "ETH" | "SOL";
    confidence: number;
    rationale: string;
  };
  finalPnlBps: number;
  rank: number;
};

export type BackendRoundResult = {
  roundId: string;
  generatedAt: string;
  startSnapshot: BackendMarketSnapshot;
  endSnapshot: BackendMarketSnapshot;
  agentDecisions: BackendAgentDecision[];
  resultHash: `0x${string}`;
  submitTxHash?: `0x${string}`;
};

export type BackendOverview = {
  ok: true;
  service: string;
  status: BackendStatusSnapshot;
  currentRound: BackendCurrentRound | null;
  liveMarketSnapshot: BackendMarketSnapshot | null;
  latestSettledRoundId: string | null;
  latestResult: BackendRoundResult | null;
};

export async function fetchArenaOverview() {
  const response = await fetch(`${m2BackendUrl}/overview`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch backend overview: ${response.status}`);
  }

  return response.json() as Promise<BackendOverview>;
}

export async function fetchArenaRoundResult(roundId: string) {
  const response = await fetch(`${m2BackendUrl}/round/${roundId}/result`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch round ${roundId} result: ${response.status}`);
  }

  const payload = await response.json() as { ok: true; result: BackendRoundResult };
  return payload.result;
}

export function resolveAgentSprite(input: {
  image?: string | null;
  personality?: string | null;
  fallbackName?: string | null;
}) {
  if (input.image) {
    return input.image;
  }

  const key = (input.personality ?? input.fallbackName ?? "").toUpperCase();
  if (key.includes("AGGRESSIVE") || key.includes("BLITZ")) {
    return "/blitz.png";
  }
  if (key.includes("MOMENTUM") || key.includes("NOVA")) {
    return "/nova.png";
  }
  if (key.includes("ANALYST") || key.includes("BYTE")) {
    return "/byte.png";
  }
  if (key.includes("CONSERVATIVE") || key.includes("ZENITH")) {
    return "/zenith.png";
  }
  return "/blitz.png";
}

export function resolveAgentAccent(input: {
  personality?: string | null;
  fallbackName?: string | null;
  index?: number;
}) {
  const key = (input.personality ?? input.fallbackName ?? "").toUpperCase();
  if (key.includes("AGGRESSIVE") || key.includes("BLITZ")) {
    return "#e8920f";
  }
  if (key.includes("MOMENTUM") || key.includes("NOVA")) {
    return "#e2479a";
  }
  if (key.includes("ANALYST") || key.includes("BYTE")) {
    return "#2a8fe0";
  }
  if (key.includes("CONSERVATIVE") || key.includes("ZENITH")) {
    return "#8a5fe0";
  }

  const palette = ["#e8920f", "#e2479a", "#2a8fe0", "#8a5fe0", "#2faa55"];
  return palette[input.index ?? 0] ?? palette[0];
}
