export type AssetSymbol = "BTC" | "ETH" | "SOL";

export type TradeAction = "LONG" | "SHORT" | "HOLD";

export type RuntimeStatus = "idle" | "tracking" | "settling" | "settled" | "error";

export type PricePoint = {
  symbol: AssetSymbol;
  price: number;
  publishTime: number;
};

export type MarketSnapshot = {
  source: "pyth";
  capturedAt: number;
  prices: Record<AssetSymbol, PricePoint>;
};

export type AgentMetadata = {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
};

export type AgentProfile = {
  agentId: bigint;
  owner: `0x${string}`;
  isHouseAgent: boolean;
  isActive: boolean;
  remainingBond: bigint;
  configHash: `0x${string}`;
  lastJoinedRoundId: bigint;
  lastSettledRoundId: bigint;
  agentUri: string;
  image?: string;
  name: string;
  personality: string;
  tradingStyle: string;
};

export type AgentDecision = {
  action: TradeAction;
  asset: AssetSymbol;
  confidence: number;
  rationale: string;
};

export type AgentRoundResult = {
  agentId: bigint;
  owner: `0x${string}`;
  name: string;
  image?: string;
  personality: string;
  tradingStyle: string;
  isHouseAgent: boolean;
  decision: AgentDecision;
  finalPnlBps: number;
  rank: number;
};

export type AgentRoundPreview = {
  agentId: bigint;
  owner: `0x${string}`;
  name: string;
  image?: string;
  personality: string;
  tradingStyle: string;
  isHouseAgent: boolean;
  decision: AgentDecision;
  previewPnlBps: number;
  previewRank: number;
};

export type RoundSnapshot = {
  roundId: bigint;
  status: number;
  stakeOpenAt: number;
  stakeCloseAt: number;
  participantCount: number;
  totalStaked: bigint;
  losingPool: bigint;
  treasuryTopUpUsed: bigint;
  backstopCap: bigint;
  resultHash: `0x${string}`;
  winnerAgentIds: readonly [bigint, bigint, bigint];
};

export type TrackedRoundState = {
  roundId: bigint;
  stakeOpenAt: number;
  stakeCloseAt: number;
  trackedAt: string;
  participantIds: bigint[];
  participants: AgentProfile[];
  startSnapshot: MarketSnapshot;
  latestSnapshot: MarketSnapshot;
  previewDecisions: AgentRoundPreview[];
  previewUpdatedAt: string | null;
};

export type PreparedRoundResult = {
  roundId: bigint;
  generatedAt: string;
  startSnapshot: MarketSnapshot | null;
  endSnapshot: MarketSnapshot | null;
  agentDecisions: AgentRoundResult[];
  resultHash: `0x${string}`;
  submitTxHash?: `0x${string}`;
};

export type PersistedRuntimeState = {
  status: RuntimeStatus;
  activeRound: SerializedTrackedRoundState | null;
  lastTickAt: string | null;
  lastSettledRoundId: string | null;
  lastError: string | null;
  lastLockTxHash: `0x${string}` | null;
  lastSubmitTxHash: `0x${string}` | null;
};

export type SerializedTrackedRoundState = {
  roundId: string;
  stakeOpenAt: number;
  stakeCloseAt: number;
  trackedAt: string;
  participantIds: string[];
  participants: SerializedAgentProfile[];
  startSnapshot: MarketSnapshot;
  latestSnapshot?: MarketSnapshot;
  previewDecisions?: SerializedAgentRoundPreview[];
  previewUpdatedAt?: string | null;
};

export type SerializedAgentRoundPreview = {
  agentId: string;
  owner: `0x${string}`;
  name: string;
  image?: string;
  personality: string;
  tradingStyle: string;
  isHouseAgent: boolean;
  decision: AgentDecision;
  previewPnlBps: number;
  previewRank: number;
};

export type SerializedAgentProfile = {
  agentId: string;
  owner: `0x${string}`;
  isHouseAgent: boolean;
  isActive: boolean;
  remainingBond: string;
  configHash: `0x${string}`;
  lastJoinedRoundId: string;
  lastSettledRoundId: string;
  agentUri: string;
  image?: string;
  name: string;
  personality: string;
  tradingStyle: string;
};

export type SerializedPreparedRoundResult = {
  roundId: string;
  generatedAt: string;
  startSnapshot: MarketSnapshot | null;
  endSnapshot: MarketSnapshot | null;
  agentDecisions: Array<{
    agentId: string;
    owner: `0x${string}`;
    name: string;
    image?: string;
    personality: string;
    tradingStyle: string;
    isHouseAgent: boolean;
    decision: AgentDecision;
    finalPnlBps: number;
    rank: number;
  }>;
  resultHash: `0x${string}`;
  submitTxHash?: `0x${string}`;
};
