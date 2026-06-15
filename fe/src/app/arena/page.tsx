"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { parseUnits } from "viem";
import {
  arenaAbi,
  m2Deployment,
  mantleSepoliaExplorerUrl,
  mockUsdcAbi,
} from "@/lib/contracts";
import {
  fetchArenaRoundResult,
  fetchArenaOverview,
  resolveAgentAccent,
  resolveAgentSprite,
  type BackendAgentDecision,
  type BackendCurrentRound,
  type BackendPreviewDecision,
} from "@/lib/backend";
import { formatCompactNumber, formatCountdown, formatToken } from "@/lib/format";

type RoundTuple = readonly [
  number,
  bigint,
  bigint,
  number,
  bigint,
  bigint,
  bigint,
  bigint,
  `0x${string}`,
  readonly [bigint, bigint, bigint],
];

type RoundAgentStateTuple = readonly [
  boolean,
  boolean,
  boolean,
  boolean,
  `0x${string}`,
  number,
  number,
  number,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
];

type ArenaRow = {
  agentId: bigint;
  name: string;
  image?: string;
  personality: string;
  tradingStyle: string;
  accent: string;
  sprite: string;
  rank: number;
  pnlBps: number;
  totalStake: bigint;
  isWinner: boolean;
  creator: `0x${string}`;
  creatorClaimed: boolean;
  creatorReward: bigint;
};

const RANK_COLORS = ["#f2b50e", "#b9c0cc", "#e07e2a", "#7e6bd0", "#d05a5a"] as const;

// 8 fixed platform slots arranged in an oval ring matching the arena background
const ARENA_SLOTS = [
  { left: "20%", bottom: "18%", z: 6 },  // front-left
  { left: "40%", bottom: "9%",  z: 8 },  // front-center-left
  { left: "60%", bottom: "9%",  z: 8 },  // front-center-right
  { left: "80%", bottom: "18%", z: 6 },  // front-right
  { left: "70%", bottom: "31%", z: 4 },  // mid-right
  { left: "80%", bottom: "46%", z: 2 },  // back-right
  { left: "60%", bottom: "52%", z: 1 },  // back-center
  { left: "20%", bottom: "46%", z: 2 },  // back-left
  { left: "30%", bottom: "31%", z: 4 },  // mid-left
  { left: "40%", bottom: "52%", z: 7 },  // front-center
] as const;

const SIDE_PANEL_HEIGHT = 486;

export default function ArenaPage() {
  const router = useRouter();
  const { data: overview, isLoading, error } = useQuery({
    queryKey: ["m2", "overview"],
    queryFn: fetchArenaOverview,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    const targetRoundId =
      overview?.currentRound?.roundId
      ?? overview?.latestSettledRoundId
      ?? overview?.latestResult?.roundId
      ?? null;

    if (targetRoundId) {
      router.replace(`/arena/${targetRoundId}`);
    }
  }, [overview, router]);

  return (
    <ArenaRouteShell
      title={error ? "ARENA UNAVAILABLE" : "LOADING ARENA"}
      subtitle={
        error
          ? (error instanceof Error ? error.message : "Failed to resolve arena route.")
          : isLoading
            ? "Resolving the active or latest round..."
            : "Redirecting to the requested round..."
      }
    />
  );
}

export function ArenaView({ forcedRoundId }: { forcedRoundId?: string }) {
  const scalerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [selectedAgentId, setSelectedAgentId] = useState<bigint | null>(null);
  const [stakeAmount, setStakeAmount] = useState("10");
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: overview } = useQuery({
    queryKey: ["m2", "overview"],
    queryFn: fetchArenaOverview,
    refetchInterval: 5_000,
  });

  const requestedRoundId = forcedRoundId ?? null;
  const liveRound = overview?.currentRound ?? null;
  const liveMarketSnapshot = overview?.liveMarketSnapshot ?? null;
  const latestResult = overview?.latestResult ?? null;
  const isViewingCurrentRound = Boolean(liveRound && requestedRoundId === liveRound.roundId);
  const { data: requestedRoundResult } = useQuery({
    queryKey: ["m2", "round-result", requestedRoundId],
    queryFn: () => fetchArenaRoundResult(requestedRoundId!),
    enabled: Boolean(requestedRoundId) && !isViewingCurrentRound,
    refetchInterval: 15_000,
  });

  const currentRound = isViewingCurrentRound ? liveRound : null;
  const settledResult = currentRound
    ? null
    : requestedRoundId
      ? (requestedRoundResult ?? (latestResult?.roundId === requestedRoundId ? latestResult : null))
      : latestResult;
  const featuredRoundId = requestedRoundId ?? currentRound?.roundId ?? settledResult?.roundId ?? null;
  const featuredRoundIdBigInt = featuredRoundId ? BigInt(featuredRoundId) : undefined;
  const isRoundOpen = Boolean(currentRound);
  const isRoundSettled = !currentRound && Boolean(settledResult);

  const { data: featuredRoundRaw } = useReadContract({
    address: m2Deployment.arena,
    abi: arenaAbi,
    functionName: "getRound",
    args: featuredRoundIdBigInt ? [featuredRoundIdBigInt] : undefined,
    query: {
      enabled: Boolean(featuredRoundIdBigInt),
    },
  });

  const { data: onChainParticipantIds } = useReadContract({
    address: m2Deployment.arena,
    abi: arenaAbi,
    functionName: "getRoundParticipants",
    args: featuredRoundIdBigInt ? [featuredRoundIdBigInt] : undefined,
    query: {
      enabled: Boolean(featuredRoundIdBigInt),
      refetchInterval: 5_000,
    },
  });

  const participantIds = useMemo(() => {
    // Always prefer on-chain list — it's always complete even if backend lags
    if (onChainParticipantIds && onChainParticipantIds.length > 0) {
      return [...onChainParticipantIds] as bigint[];
    }
    if (currentRound) {
      return currentRound.participantIds.map((agentId) => BigInt(agentId));
    }
    if (settledResult) {
      return settledResult.agentDecisions.map((agent) => BigInt(agent.agentId));
    }
    return [] as bigint[];
  }, [onChainParticipantIds, currentRound, settledResult]);

  const { data: participantStates = [] } = useReadContracts({
    contracts: featuredRoundIdBigInt
      ? participantIds.map((agentId) => ({
          address: m2Deployment.arena,
          abi: arenaAbi,
          functionName: "getRoundAgentState",
          args: [featuredRoundIdBigInt, agentId],
        }))
      : [],
    query: {
      enabled: Boolean(featuredRoundIdBigInt) && participantIds.length > 0,
    },
  });

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: m2Deployment.mockUsdc,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: m2Deployment.mockUsdc,
    abi: mockUsdcAbi,
    functionName: "allowance",
    args: address ? [address, m2Deployment.arena] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });

  useEffect(() => {
    function fit() {
      const el = scalerRef.current;
      if (!el) return;
      el.style.transform = "";
      const naturalHeight = el.offsetHeight;
      const scaleWidth = (window.innerWidth - 28) / 1280;
      const scaleHeight = (window.innerHeight - 36) / naturalHeight;
      const scale = Math.min(scaleWidth, scaleHeight);
      el.style.transform = `scale(${scale})`;
      el.style.marginBottom = `${-(1 - scale) * naturalHeight}px`;
    }
    window.addEventListener("resize", fit);
    fit();
    return () => window.removeEventListener("resize", fit);
  }, [participantIds.length]);

  const featuredRound = featuredRoundRaw as RoundTuple | undefined;
  const previewDecisionByAgentId = new Map(
    (currentRound?.previewDecisions ?? []).map((decision) => [decision.agentId, decision] as const),
  );
  const metadataSource = new Map<
    string,
    BackendCurrentRound["participants"][number] | BackendAgentDecision | BackendPreviewDecision
  >();
  currentRound?.participants.forEach((participant) => metadataSource.set(participant.agentId, participant));
  currentRound?.previewDecisions.forEach((decision) => metadataSource.set(decision.agentId, decision));
  settledResult?.agentDecisions.forEach((decision) => metadataSource.set(decision.agentId, decision));

  const rows = participantIds.map((agentId, index) => {
    const state = participantStates[index]?.result as RoundAgentStateTuple | undefined;
    const meta = metadataSource.get(agentId.toString());
    const latestDecision = settledResult?.agentDecisions.find((decision) => decision.agentId === agentId.toString());
    const previewDecision = previewDecisionByAgentId.get(agentId.toString());
    const rank = latestDecision?.rank
      ?? previewDecision?.previewRank
      ?? (state?.[5] && state[5] > 0 ? state[5] : index + 1);
    const pnlBps = latestDecision?.finalPnlBps ?? previewDecision?.previewPnlBps ?? (state?.[6] ?? 0);
    const personality = "personality" in (meta ?? {}) ? meta?.personality ?? "UNKNOWN" : "UNKNOWN";
    const tradingStyle = "tradingStyle" in (meta ?? {}) ? meta?.tradingStyle ?? "Adaptive" : "Adaptive";
    const name = meta?.name ?? `AGENT #${agentId.toString()}`;
    return {
      agentId,
      name,
      image: meta?.image,
      personality,
      tradingStyle,
      accent: resolveAgentAccent({ personality, fallbackName: name, index }),
      sprite: resolveAgentSprite({ image: meta?.image, personality, fallbackName: name }),
      rank,
      pnlBps,
      totalStake: state?.[9] ?? 0n,
      isWinner: state?.[2] ?? false,
      creator: state?.[4] ?? m2Deployment.deployer,
      creatorClaimed: state?.[3] ?? false,
      creatorReward: state?.[12] ?? 0n,
    } satisfies ArenaRow;
  }).sort((left, right) => {
    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }
    return Number(right.totalStake - left.totalStake);
  });

  useEffect(() => {
    if (!selectedAgentId && rows.length > 0) {
      setSelectedAgentId(rows[0].agentId);
    }
  }, [rows, selectedAgentId]);

  const selectedRow = rows.find((row) => row.agentId === selectedAgentId) ?? rows[0] ?? null;
  const countdown = currentRound ? formatCountdown(currentRound.stakeCloseAt) : "SETTLED";
  const participantCount = featuredRound?.[3] ?? rows.length;
  const prizePool = featuredRound?.[4] ?? 0n;
  const stakeAmountUnits = stakeAmount.trim().length > 0 ? parseUnits(stakeAmount, 18) : 0n;
  const canStake = Boolean(
    isConnected &&
    currentRound &&
    selectedRow &&
    stakeAmountUnits > 0n &&
    (usdcBalance ?? 0n) >= stakeAmountUnits,
  );

  const { data: previewClaim = 0n, refetch: refetchPreviewClaim } = useReadContract({
    address: m2Deployment.arena,
    abi: arenaAbi,
    functionName: "previewStakerClaim",
    args: address && selectedRow && featuredRoundIdBigInt && isRoundSettled
      ? [featuredRoundIdBigInt, selectedRow.agentId, address]
      : undefined,
    query: {
      enabled: Boolean(address && selectedRow && featuredRoundIdBigInt && isRoundSettled),
    },
  });

  const canClaimStaker = isRoundSettled && selectedRow && previewClaim > 0n;
  const canClaimCreator = Boolean(
    isRoundSettled &&
    selectedRow &&
    address &&
    selectedRow.creator.toLowerCase() === address.toLowerCase() &&
    !selectedRow.creatorClaimed &&
    selectedRow.creatorReward > 0n,
  );

  async function handleStake() {
    if (!selectedRow || !address || !publicClient || !featuredRoundIdBigInt) {
      setActionError("Connect wallet and select an agent first.");
      return;
    }

    try {
      setActionError(null);

      if ((allowance ?? 0n) < stakeAmountUnits) {
        setActionStatus("Approving mUSDC for staking...");
        const approveHash = await writeContractAsync({
          address: m2Deployment.mockUsdc,
          abi: mockUsdcAbi,
          functionName: "approve",
          args: [m2Deployment.arena, stakeAmountUnits],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await refetchAllowance();
      }

      setActionStatus(`Staking ${stakeAmount} mUSDC on ${selectedRow.name}...`);
      const stakeHash = await writeContractAsync({
        address: m2Deployment.arena,
        abi: arenaAbi,
        functionName: "stake",
        args: [selectedRow.agentId, stakeAmountUnits],
      });
      await publicClient.waitForTransactionReceipt({ hash: stakeHash });
      await refetchBalance();
      await queryClient.invalidateQueries({ queryKey: ["m2", "overview"] });
      setActionStatus(`Stake confirmed on ${selectedRow.name}.`);
    } catch (error) {
      setActionStatus(null);
      setActionError(error instanceof Error ? error.message : "Stake failed.");
    }
  }

  async function handleClaimStaker() {
    if (!selectedRow || !publicClient || !featuredRoundIdBigInt) {
      return;
    }

    try {
      setActionError(null);
      setActionStatus(`Claiming staker reward from ${selectedRow.name}...`);
      const hash = await writeContractAsync({
        address: m2Deployment.arena,
        abi: arenaAbi,
        functionName: "claimStakerReward",
        args: [featuredRoundIdBigInt, selectedRow.agentId],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchBalance();
      await refetchPreviewClaim();
      setActionStatus(`Staker reward claimed from ${selectedRow.name}.`);
    } catch (error) {
      setActionStatus(null);
      setActionError(error instanceof Error ? error.message : "Claim failed.");
    }
  }

  async function handleClaimCreator() {
    if (!selectedRow || !publicClient || !featuredRoundIdBigInt) {
      return;
    }

    try {
      setActionError(null);
      setActionStatus(`Claiming creator reward for ${selectedRow.name}...`);
      const hash = await writeContractAsync({
        address: m2Deployment.arena,
        abi: arenaAbi,
        functionName: "claimCreatorReward",
        args: [featuredRoundIdBigInt, selectedRow.agentId],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchBalance();
      await queryClient.invalidateQueries({ queryKey: ["m2", "overview"] });
      setActionStatus(`Creator reward claimed for ${selectedRow.name}.`);
    } catch (error) {
      setActionStatus(null);
      setActionError(error instanceof Error ? error.message : "Creator claim failed.");
    }
  }

  const marketStart = currentRound?.startSnapshot ?? settledResult?.startSnapshot ?? null;
  const marketEnd = liveMarketSnapshot ?? currentRound?.latestSnapshot ?? settledResult?.endSnapshot ?? marketStart;
  const marketRows = (["BTC", "ETH", "SOL"] as const).map((symbol) => {
    const start = marketStart?.prices[symbol].price ?? 0;
    const end = marketEnd?.prices[symbol].price ?? start;
    const changePct = start > 0 ? ((end - start) / start) * 100 : 0;
    return {
      symbol,
      price: end,
      changePct,
      badge: symbol === "BTC" ? "B" : symbol === "ETH" ? "E" : "S",
      bg: symbol === "BTC" ? "#f7931a" : symbol === "ETH" ? "#6b7fd0" : "#13c8a0",
    };
  });

  const liveFeed = settledResult
    ? settledResult.agentDecisions.map((decision, index) => ({
        key: `${decision.agentId}-${decision.rank}`,
        agent: decision.name,
        agentColor: resolveAgentAccent({
          personality: decision.personality,
          fallbackName: decision.name,
          index,
        }),
        sprite: resolveAgentSprite({
          image: decision.image,
          personality: decision.personality,
          fallbackName: decision.name,
        }),
        msg: `${decision.decision.action} ${decision.decision.asset} • ${decision.decision.rationale}`,
        time: `RANK ${decision.rank}`,
      }))
    : currentRound?.participants.map((participant, index) => ({
        key: `${participant.agentId}-${index}`,
        agent: participant.name,
        agentColor: resolveAgentAccent({
          personality: participant.personality,
          fallbackName: participant.name,
          index,
        }),
        sprite: resolveAgentSprite({
          image: participant.image,
          personality: participant.personality,
          fallbackName: participant.name,
        }),
        msg: `${participant.tradingStyle} strategy queued • ${participant.personality} persona`,
        time: "TRACKING",
      })) ?? [];

  const activeLiveFeed = settledResult
    ? liveFeed
    : currentRound?.previewDecisions.map((decision, index) => ({
        key: `${decision.agentId}-${decision.previewRank}`,
        agent: decision.name,
        agentColor: resolveAgentAccent({
          personality: decision.personality,
          fallbackName: decision.name,
          index,
        }),
        sprite: resolveAgentSprite({
          image: decision.image,
          personality: decision.personality,
          fallbackName: decision.name,
        }),
        msg: `${decision.decision.action} ${decision.decision.asset} • ${decision.decision.rationale}`,
        time: decision.previewPnlBps >= 0
          ? `LIVE +${(decision.previewPnlBps / 100).toFixed(2)}%`
          : `LIVE ${(decision.previewPnlBps / 100).toFixed(2)}%`,
      }))
      ?? liveFeed;

  return (
    <div
      className="font-silk flex justify-center items-start overflow-hidden h-screen"
      style={{
        color: "#2a2150",
        WebkitFontSmoothing: "none",
        padding: "18px 14px 40px",
        background: "radial-gradient(130% 90% at 50% 0%, #a9e0fb 0%, #8fd0f4 38%, #9bd6c6 78%, #8fc99f 100%)",
      }}
    >
      <div ref={scalerRef} style={{ transformOrigin: "top center" }}>
        <div className="flex flex-col" style={{ width: 1280, gap: 14 }}>
          <div className="flex items-center justify-between" style={{ gap: 14 }}>
            <div className="flex items-center" style={{ gap: 12 }}>
              <button
                onClick={() => (window.location.href = "/lobby")}
                style={{
                  width: 48, height: 46, display: "grid", placeItems: "center",
                  background: "linear-gradient(180deg,#7e9fe8 0%,#4f76d8 100%)",
                  border: "3px solid #2c3f86", borderRadius: 12,
                  boxShadow: "0 4px 0 #2c3f86, inset 0 2px 0 rgba(255,255,255,.35)",
                  cursor: "pointer",
                }}
              >
                <span className="font-press" style={{ color: "#fff", fontSize: 16 }}>&larr;</span>
              </button>
              <div
                className="flex items-center"
                style={{
                  gap: 11,
                  background: "linear-gradient(180deg,#5a86e6 0%,#3e63c8 100%)",
                  border: "3px solid #2c3f86", borderRadius: 12,
                  padding: "10px 18px",
                  boxShadow: "0 4px 0 #2c3f86, inset 0 2px 0 rgba(255,255,255,.3)",
                }}
              >
                <span className="font-press" style={{ fontSize: 16, color: "#fff", letterSpacing: 1, textShadow: "0 2px 0 #2c3f86" }}>ARENA</span>
                <img src="/nav-leaderboard.png" alt="" style={{ width: 26, height: 26, imageRendering: "pixelated" }} />
              </div>
            </div>

            <div className="flex items-center" style={{ gap: 11 }}>
              {[
                { icon: null, val: featuredRoundId ? `ROUND ${featuredRoundId}` : "WAITING" },
                { icon: "/usdc-logo.png", val: `${formatToken(usdcBalance)} mUSDC` },
              ].map(({ icon, val }) => (
                <div
                  key={val}
                  className="flex items-center"
                  style={{
                    gap: 9,
                    background: "linear-gradient(180deg,#3a5db0 0%,#2c4790 100%)",
                    border: "3px solid #1f3170", borderRadius: 13,
                    padding: "8px 14px 8px 9px",
                    boxShadow: "0 4px 0 #1f3170, inset 0 2px 0 rgba(255,255,255,.18)",
                    minWidth: 150,
                  }}
                >
                  {icon ? (
                    <img src={icon} alt="" style={{ width: 24, height: 24, imageRendering: "pixelated" }} />
                  ) : null}
                  <span className="font-press" style={{ fontSize: 12, color: "#fff", letterSpacing: ".5px" }}>{val}</span>
                </div>
              ))}
            </div>

            <TopBarConnectWallet />
          </div>

          <div className="flex justify-center">
            <div
              className="flex items-center"
              style={{
                gap: 18,
                background: "linear-gradient(180deg,#8a5fe0 0%,#6a44c9 100%)",
                border: "3px solid #4a2ea0", borderRadius: 14,
                padding: "9px 26px",
                boxShadow: "0 5px 0 #4a2ea0, inset 0 2px 0 rgba(255,255,255,.3)",
              }}
            >
              <span className="font-press" style={{ fontSize: 14, color: "#fff", letterSpacing: 1, textShadow: "0 2px 0 #4a2ea0" }}>
                {currentRound ? `ROUND ${currentRound.roundId} OPEN` : latestResult ? `ROUND ${latestResult.roundId} SETTLED` : "NO LIVE ROUND"}
              </span>
              <div style={{ width: 3, height: 20, background: "rgba(255,255,255,.3)", borderRadius: 2 }} />
              <span className="font-press" style={{ fontSize: 14, color: "#ffe27a", letterSpacing: 1, textShadow: "0 2px 0 #4a2ea0" }}>
                {currentRound ? `TIME ${countdown}` : "CLAIMS READY"}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 300px", gap: 16, alignItems: "stretch" }}>
            <Panel title="LIVE FEED" style={{ height: SIDE_PANEL_HEIGHT }}>
              <div
                style={{
                  overflowY: "auto",
                  flex: 1,
                  minHeight: 0,
                  maxHeight: 620,
                  scrollbarGutter: "stable",
                }}
              >
                {activeLiveFeed.map((feed, index) => (
                    <div key={feed.key} className="flex" style={{ gap: 12, padding: "13px 15px", borderBottom: index < activeLiveFeed.length - 1 ? "2px solid #e2d9c2" : "none" }}>
                    <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: "50%", background: "#fff", border: "3px solid #d9cfb6", overflow: "hidden", display: "grid", placeItems: "center" }}>
                      <img src={feed.sprite} alt="" style={{ width: 42, height: 42, objectFit: "cover", objectPosition: "center 18%", imageRendering: "pixelated" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-baseline justify-between" style={{ gap: 6 }}>
                        <span className="font-press" style={{ fontSize: 10, letterSpacing: ".5px", color: feed.agentColor }}>{feed.agent}</span>
                        <span className="font-silk" style={{ fontSize: 11, color: "#b3a98c", fontWeight: 700 }}>{feed.time}</span>
                      </div>
                      <div className="font-silk" style={{ fontSize: 12, color: "#6a6048", fontWeight: 700, lineHeight: 1.45, marginTop: 5 }}>{feed.msg}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div style={{
              position: "relative",
              border: "4px solid #4a2ea0", borderRadius: 18,
              overflow: "hidden",
              aspectRatio: "1448/1086",
              alignSelf: "start",
              backgroundImage: "url('/arena-battle-bg.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              boxShadow: "0 8px 0 rgba(74,46,160,.25), 0 16px 30px rgba(50,30,110,.28), inset 0 0 0 3px rgba(255,255,255,.12)",
            }}>
              {ARENA_SLOTS.map((slot, slotIndex) => {
                const row = rows[slotIndex] ?? null;
                const isSelected = Boolean(row && row.agentId === selectedAgentId);
                return (
                  <div
                    key={slotIndex}
                    onClick={() => row && setSelectedAgentId(row.agentId)}
                    style={{
                      position: "absolute",
                      left: slot.left,
                      bottom: slot.bottom,
                      transform: "translateX(-50%)",
                      width: "10%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      cursor: row ? "pointer" : "default",
                      zIndex: slot.z,
                    }}
                  >
                    {row && (
                      <div style={{
                        background: "rgba(36,24,70,.9)",
                        border: `2px solid ${isSelected ? row.accent : "rgba(255,255,255,.65)"}`,
                        borderRadius: 5,
                        padding: "2px 4px",
                        marginBottom: 2,
                        width: "100%",
                        boxShadow: isSelected ? `0 0 8px ${row.accent}aa` : "0 2px 3px rgba(20,10,50,.5)",
                      }}>
                        <div className="font-press" style={{ fontSize: 6, color: row.accent, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          #{row.rank} {row.name}
                        </div>
                        <div className="font-press" style={{ fontSize: 6, color: row.pnlBps >= 0 ? "#3ee07f" : "#ff7a7a", textAlign: "center" }}>
                          {formatPnl(row.pnlBps)}
                        </div>
                      </div>
                    )}
                    {row && (
                      <img
                        src={row.sprite}
                        alt={row.name}
                        style={{
                          width: "60%",
                          imageRendering: "pixelated",
                          filter: `drop-shadow(0 3px 2px rgba(20,10,50,.4))${isSelected ? " brightness(1.2)" : ""}`,
                          animation: `bob ${2.3 + (slotIndex % 5) * 0.22}s ease-in-out infinite`,
                          animationDelay: `${(slotIndex * 0.15) % 1}s`,
                          position: "relative",
                          zIndex: 2,
                        }}
                      />
                    )}
                    <img
                      src="/platform.png"
                      alt=""
                      style={{
                        width: "100%",
                        imageRendering: "pixelated",
                        filter: "drop-shadow(0 4px 5px rgba(30,15,60,.4))",
                        marginTop: row ? -20 : 0,
                        opacity: row ? 1 : 0.55,
                        position: "relative",
                        zIndex: 1,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <Panel title="LEADERBOARD" style={{ height: SIDE_PANEL_HEIGHT }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "6px 0",
                  overflowY: "auto",
                  flex: 1,
                  minHeight: 0,
                  maxHeight: 252,
                  scrollbarGutter: "stable",
                }}
              >
                {rows.map((row, index) => {
                  const isSelected = selectedRow?.agentId === row.agentId;
                  return (
                    <button
                      key={`${row.agentId.toString()}-${index}`}
                      onClick={() => setSelectedAgentId(row.agentId)}
                      className="flex items-center"
                      style={{
                        gap: 11,
                        padding: "11px 14px",
                        borderBottom: index < rows.length - 1 ? "2px solid #e2d9c2" : "none",
                        background: isSelected ? "rgba(122,82,218,.12)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div className="font-press grid place-items-center" style={{
                        width: 28, height: 28, flexShrink: 0,
                        background: RANK_COLORS[Math.min(Math.max(row.rank - 1, 0), RANK_COLORS.length - 1)],
                        borderRadius: 7,
                        border: "2px solid rgba(0,0,0,.25)",
                        boxShadow: "inset 0 2px 0 rgba(255,255,255,.3)",
                        fontSize: 12, color: "#fff",
                      }}>{row.rank}</div>
                      <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: "50%", background: "#fff", border: "2px solid #d9cfb6", overflow: "hidden", display: "grid", placeItems: "center" }}>
                        <img src={row.sprite} alt="" style={{ width: 34, height: 34, objectFit: "cover", objectPosition: "center 18%", imageRendering: "pixelated" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <div className="font-press" style={{ fontSize: 11, letterSpacing: ".5px", color: row.accent }}>{row.name}</div>
                        <div className="font-silk" style={{ fontSize: 10, color: "#8b7f66", fontWeight: 700 }}>
                          Stake: {formatToken(row.totalStake)} mUSDC
                        </div>
                      </div>
                      <span className="font-press" style={{ fontSize: 11, color: row.pnlBps >= 0 ? "#2faa55" : "#e0463c" }}>{formatPnl(row.pnlBps)}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ padding: "13px 15px 16px", flexShrink: 0, borderTop: "2px solid #e2d9c2", display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="font-press" style={{ fontSize: 9, color: "#9a8f6e", letterSpacing: ".5px" }}>
                  {selectedRow ? (currentRound ? `SUPPORT ${selectedRow.name}` : `CLAIMS / REVIEW ${selectedRow.name}`) : "NO LIVE AGENT SELECTED"}
                </div>
                <input
                  value={stakeAmount}
                  onChange={(event) => setStakeAmount(event.target.value)}
                  className="font-press"
                  style={{
                    width: "100%",
                    background: "#fff",
                    border: "3px solid #d9cfb6",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 11,
                    color: "#3a2e63",
                  }}
                />
                <button
                  onClick={handleStake}
                  disabled={isPending || !canStake}
                  className="font-press"
                  style={primaryActionButton(canStake)}
                >
                  {isPending ? "PENDING..." : currentRound ? "STAKE mUSDC" : "ROUND CLOSED"}
                </button>
                <button
                  onClick={handleClaimStaker}
                  disabled={isPending || !canClaimStaker}
                  className="font-press"
                  style={secondaryActionButton(canClaimStaker)}
                >
                  CLAIM STAKER REWARD
                </button>
                <button
                  onClick={handleClaimCreator}
                  disabled={isPending || !canClaimCreator}
                  className="font-press"
                  style={secondaryActionButton(canClaimCreator)}
                >
                  CLAIM CREATOR REWARD
                </button>
                {canClaimStaker ? (
                  <div className="font-silk" style={{ fontSize: 10, color: "#2faa55", fontWeight: 700 }}>
                    Claimable staker payout: {formatToken(previewClaim)} mUSDC
                  </div>
                ) : null}
                {actionStatus ? (
                  <div className="font-silk" style={{ fontSize: 10, color: "#2faa55", fontWeight: 700 }}>{actionStatus}</div>
                ) : null}
                {actionError ? (
                  <div className="font-silk" style={{ fontSize: 10, color: "#e0463c", fontWeight: 700 }}>{actionError}</div>
                ) : null}
              </div>
            </Panel>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1.1fr 1.25fr auto", gap: 16, alignItems: "stretch" }}>
            <InfoPanel title="MARKET OVERVIEW">
              {marketRows.map((row) => (
                <div key={row.symbol} className="flex items-center" style={{ gap: 10, padding: "4px 0" }}>
                  <div className="font-press grid place-items-center" style={{ width: 26, height: 26, borderRadius: "50%", background: row.bg, border: "2px solid rgba(0,0,0,.18)", fontSize: 11, color: "#fff", flexShrink: 0 }}>{row.badge}</div>
                  <span className="font-press" style={{ fontSize: 10, width: 34 }}>{row.symbol}</span>
                  <span className="font-silk" style={{ fontWeight: 700, fontSize: 13, color: "#3a2e63", width: 96 }}>{row.price.toFixed(2)}</span>
                  <span className="font-press" style={{ fontSize: 9, color: row.changePct >= 0 ? "#2faa55" : "#e0463c", width: 62 }}>
                    {row.changePct >= 0 ? "+" : ""}{row.changePct.toFixed(2)}%
                  </span>
                </div>
              ))}
            </InfoPanel>

            <InfoPanel title="MARKET SENTIMENT">
              <div className="flex flex-col items-center justify-center" style={{ gap: 9, height: "calc(100% - 28px)" }}>
                <div className="flex items-center" style={{ gap: 11 }}>
                  <div className="grid place-items-center" style={{ width: 34, height: 34, borderRadius: 9, background: currentRound ? "#2faa55" : "#8a5fe0", border: "2px solid #1c7a3a", boxShadow: "inset 0 2px 0 rgba(255,255,255,.3)" }}>
                    <span style={{ color: "#fff", fontSize: 20, lineHeight: 1 }}>{currentRound ? "\u2191" : "\u2713"}</span>
                  </div>
                  <span className="font-press" style={{ fontSize: 15, color: currentRound ? "#2faa55" : "#8a5fe0", letterSpacing: ".5px" }}>
                    {currentRound ? "TRACKING" : latestResult ? "SETTLED" : "IDLE"}
                  </span>
                </div>
                <div style={{ width: "100%", height: 12, borderRadius: 7, background: "#e2d9c2", overflow: "hidden", border: "2px solid #cfc4a6" }}>
                  <div style={{ height: "100%", width: currentRound ? "72%" : latestResult ? "100%" : "12%", background: currentRound ? "linear-gradient(90deg,#3ad07a,#2faa55)" : "linear-gradient(90deg,#9b78ee,#6a44c9)" }} />
                </div>
                <div className="font-silk" style={{ fontSize: 11, color: "#9a8f6e", fontWeight: 700, textAlign: "center" }}>
                  {currentRound
                    ? "The arena is live and locking in moves before settlement."
                    : latestResult
                      ? "Latest round has settled. Claims are now available for winners."
                      : "No tracked round found yet."}
                </div>
              </div>
            </InfoPanel>

            <InfoPanel title="ROUND INFO">
              <div className="flex items-center" style={{ gap: 18, height: "calc(100% - 28px)" }}>
                <div className="flex flex-col" style={{ gap: 6 }}>
                  <span className="font-press" style={{ fontSize: 8, color: "#9a8f6e", letterSpacing: ".5px" }}>POOL</span>
                  <div className="font-press" style={{ fontSize: 13, color: "#e08a12" }}>
                    {formatCompactNumber(prizePool)}
                  </div>
                </div>
                <div className="flex flex-col" style={{ gap: 6 }}>
                  <span className="font-press" style={{ fontSize: 8, color: "#9a8f6e", letterSpacing: ".5px" }}>PARTICIPANTS</span>
                  <span className="font-press" style={{ fontSize: 13, color: "#3a2e63" }}>{participantCount}</span>
                </div>
                <div className="flex flex-col" style={{ gap: 6 }}>
                  <span className="font-press" style={{ fontSize: 8, color: "#9a8f6e", letterSpacing: ".5px" }}>{currentRound ? "ROUND ENDS IN" : "RESULT HASH"}</span>
                  <span className="font-press" style={{ fontSize: 13, color: "#3a2e63" }}>
                    {currentRound ? countdown : `${latestResult?.resultHash.slice(0, 8) ?? "0x0"}...`}
                  </span>
                </div>
              </div>
            </InfoPanel>

            <button
              className="font-press flex flex-col items-center justify-center"
              style={{
                gap: 5,
                background: "linear-gradient(180deg,#ffd95a 0%,#ffb22e 55%,#f08c12 100%)",
                border: "4px solid #7a4405", borderRadius: 14,
                padding: "0 30px", minWidth: 160,
                fontSize: 16, color: "#fff", letterSpacing: 1,
                textShadow: "0 2px 0 #c96a08", cursor: "pointer",
                boxShadow: "0 6px 0 #b86a05, inset 0 3px 0 rgba(255,255,255,.5)",
              }}
              onClick={() =>
                window.open(
                  latestResult?.submitTxHash
                    ? `${mantleSepoliaExplorerUrl}/tx/${latestResult.submitTxHash}`
                    : `${mantleSepoliaExplorerUrl}/address/${m2Deployment.arena}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <span>
                <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: currentRound ? "#ff4d4d" : "#2faa55", boxShadow: `0 0 8px ${currentRound ? "#ff4d4d" : "#2faa55"}`, marginRight: 6, verticalAlign: "middle", animation: currentRound ? "blink 1.1s steps(2) infinite" : "none" }} />
              </span>
              <span>OPEN</span>
              <span>SCAN</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  style,
}: {
  title: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "#f4efe0",
        border: "4px solid #4a2ea0",
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        boxShadow: "0 8px 0 rgba(74,46,160,.25), 0 14px 26px rgba(50,30,110,.22)",
        ...style,
      }}
    >
      <div className="font-press" style={{
        background: "linear-gradient(180deg,#8a5fe0 0%,#6a44c9 100%)",
        padding: "12px 16px", fontSize: 13, color: "#fff",
        letterSpacing: 1, textShadow: "0 2px 0 #4a2ea0",
        borderBottom: "3px solid #4a2ea0", flexShrink: 0,
      }}>{title}</div>
      {children}
    </div>
  );
}

function ArenaRouteShell({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className="font-silk flex justify-center items-center min-h-screen"
      style={{
        color: "#2a2150",
        WebkitFontSmoothing: "none",
        padding: "18px 14px 40px",
        background: "radial-gradient(130% 90% at 50% 0%, #a9e0fb 0%, #8fd0f4 38%, #9bd6c6 78%, #8fc99f 100%)",
      }}
    >
      <div
        style={{
          width: 540,
          background: "#f4efe0",
          border: "4px solid #4a2ea0",
          borderRadius: 18,
          padding: "28px 30px",
          boxShadow: "0 8px 0 rgba(74,46,160,.25), 0 14px 26px rgba(50,30,110,.22)",
        }}
      >
        <div
          className="font-press"
          style={{
            fontSize: 20,
            color: "#6a44c9",
            letterSpacing: 1,
            textShadow: "0 2px 0 rgba(74,46,160,.18)",
          }}
        >
          {title}
        </div>
        <div
          className="font-silk"
          style={{
            marginTop: 12,
            fontSize: 14,
            color: "#5f547f",
            fontWeight: 700,
            lineHeight: 1.55,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: "#f4efe0", border: "4px solid #4a2ea0", borderRadius: 14, padding: "11px 15px", boxShadow: "0 6px 0 rgba(74,46,160,.22)" }}>
      <div className="font-press" style={{ fontSize: 9, color: "#9a8f6e", letterSpacing: ".5px", marginBottom: 9 }}>{title}</div>
      {children}
    </div>
  );
}

function primaryActionButton(enabled: boolean): React.CSSProperties {
  return {
    width: "100%", display: "block", textAlign: "center",
    background: "linear-gradient(180deg,#8a5fe0 0%,#6a44c9 100%)",
    border: "3px solid #4a2ea0", borderRadius: 11,
    padding: 11, fontSize: 10, color: "#fff",
    letterSpacing: ".5px", cursor: enabled ? "pointer" : "not-allowed",
    boxShadow: "0 4px 0 #4a2ea0, inset 0 2px 0 rgba(255,255,255,.3)",
    opacity: enabled ? 1 : 0.55,
  };
}

function secondaryActionButton(enabled: boolean): React.CSSProperties {
  return {
    width: "100%", display: "block", textAlign: "center",
    background: "linear-gradient(180deg,#3a5db0 0%,#2c4790 100%)",
    border: "3px solid #1f3170", borderRadius: 11,
    padding: 11, fontSize: 10, color: "#fff",
    letterSpacing: ".5px", cursor: enabled ? "pointer" : "not-allowed",
    boxShadow: "0 4px 0 #1f3170, inset 0 2px 0 rgba(255,255,255,.2)",
    opacity: enabled ? 1 : 0.55,
  };
}

function formatPnl(pnlBps: number) {
  return `${pnlBps >= 0 ? "+" : ""}${(pnlBps / 100).toFixed(2)}%`;
}

function TopBarConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <button
            onClick={connected ? (chain.unsupported ? openChainModal : openAccountModal) : openConnectModal}
            className="font-press flex items-center"
            style={{
              gap: 10, fontSize: 11, color: "#fff", letterSpacing: ".5px",
              background: "linear-gradient(180deg,#9b78ee 0%,#7a52da 60%,#6a44c9 100%)",
              border: "3px solid #3a2575", borderRadius: 13, padding: "11px 18px",
              cursor: "pointer", boxShadow: "0 4px 0 #3a2575,inset 0 2px 0 rgba(255,255,255,.35)",
            }}
          >
            <img src="/wallet.PNG" alt="" style={{ width: 26, height: 26 }} />
            {connected ? (chain.unsupported ? "WRONG NETWORK" : account.displayName) : "CONNECT WALLET"}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
