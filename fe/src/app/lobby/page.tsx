"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import CreateAgentModal from "./CreateAgentModal";
import {
  agentRegistryAbi,
  arenaAbi,
  m2Deployment,
  mantleSepoliaExplorerUrl,
  mockUsdcAbi,
} from "@/lib/contracts";
import { fetchArenaOverview, resolveAgentAccent, resolveAgentSprite } from "@/lib/backend";
import { formatToken } from "@/lib/format";

type ArenaCard = {
  key: string;
  status: "live" | "settled" | "idle";
  roundId: string | null;
  title: string;
  subtitle: string;
  resultHash?: `0x${string}`;
  submitTxHash?: `0x${string}`;
  fighterLeft: string;
  fighterRight: string;
  accent: string;
  participantCount: number;
  prizePoolLabel: string;
  cta: string;
};

export default function LobbyPage() {
  const scalerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const { data: overview } = useQuery({
    queryKey: ["m2", "overview"],
    queryFn: fetchArenaOverview,
    refetchInterval: 15_000,
  });

  const { data: currentOpenRoundId = 0n } = useReadContract({
    address: m2Deployment.arena,
    abi: arenaAbi,
    functionName: "currentOpenRoundId",
  });

  const { data: lastRoundId = 0n } = useReadContract({
    address: m2Deployment.arena,
    abi: arenaAbi,
    functionName: "lastRoundId",
  });

  const featuredRoundId = overview?.currentRound?.roundId ?? overview?.latestResult?.roundId ?? null;
  const { data: featuredRoundRaw } = useReadContract({
    address: m2Deployment.arena,
    abi: arenaAbi,
    functionName: "getRound",
    args: featuredRoundId ? [BigInt(featuredRoundId)] : undefined,
    query: {
      enabled: Boolean(featuredRoundId),
    },
  });

  const { data: minimumBond = 0n } = useReadContract({
    address: m2Deployment.registry,
    abi: agentRegistryAbi,
    functionName: "minimumActiveBond",
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

  useEffect(() => {
    function fit() {
      const el = scalerRef.current;
      if (!el) return;
      const scale = Math.min(1, (window.innerWidth - 28) / 1280);
      el.style.transform = `scale(${scale})`;
      el.style.marginBottom = scale < 1 ? `${-(1 - scale) * el.offsetHeight}px` : "0px";
    }
    window.addEventListener("resize", fit);
    fit();
    return () => window.removeEventListener("resize", fit);
  }, []);

  function handleCreate(name: string, txHash: `0x${string}`) {
    setModal(false);
    setToast(`${name} CREATED: ${txHash.slice(0, 10)}...`);
    setTimeout(() => setToast(null), 3200);
  }

  async function handleClaimFaucet() {
    if (!address || !publicClient) {
      setToast("CONNECT WALLET FIRST.");
      setTimeout(() => setToast(null), 3200);
      return;
    }

    try {
      setToast("CLAIMING 1,000 mUSDC...");
      const hash = await writeContractAsync({
        address: m2Deployment.mockUsdc,
        abi: mockUsdcAbi,
        functionName: "mint",
        args: [address, 1_000n * 10n ** 18n],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchBalance();
      await queryClient.invalidateQueries({ queryKey: ["m2", "overview"] });
      setToast("FAUCET CLAIMED: +1,000 mUSDC");
      setTimeout(() => setToast(null), 3200);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "FAUCET CLAIM FAILED.");
      setTimeout(() => setToast(null), 3200);
    }
  }

  const featuredRound = featuredRoundRaw as
    | readonly [number, bigint, bigint, number, bigint, bigint, bigint, bigint, `0x${string}`, readonly [bigint, bigint, bigint]]
    | undefined;
  const currentParticipants = overview?.currentRound?.participants ?? [];
  const latestDecisions = overview?.latestResult?.agentDecisions ?? [];

  const arenaCards = useMemo(() => {
    const cards: ArenaCard[] = [];

    if (overview?.currentRound) {
      cards.push({
        key: `current-${overview.currentRound.roundId}`,
        status: "live",
        roundId: overview.currentRound.roundId,
        title: `CRYSTAL COLISEUM · ROUND ${overview.currentRound.roundId}`,
        subtitle: "Live round open for staking and new agent admission.",
        fighterLeft: resolveAgentSprite({
          image: currentParticipants[0]?.image,
          personality: currentParticipants[0]?.personality,
          fallbackName: currentParticipants[0]?.name,
        }),
        fighterRight: resolveAgentSprite({
          image: currentParticipants[1]?.image,
          personality: currentParticipants[1]?.personality,
          fallbackName: currentParticipants[1]?.name,
        }),
        accent: resolveAgentAccent({
          personality: currentParticipants[0]?.personality,
          fallbackName: currentParticipants[0]?.name,
        }),
        participantCount: overview.currentRound.participantIds.length,
        prizePoolLabel: `${formatToken(featuredRound?.[4] ?? 0n)} mUSDC`,
        cta: "ENTER LIVE ARENA",
      });
    }

    if (overview?.latestResult) {
      cards.push({
        key: `settled-${overview.latestResult.roundId}`,
        status: "settled",
        roundId: overview.latestResult.roundId,
        title: `ROUND ${overview.latestResult.roundId} SETTLED`,
        subtitle: `Latest winner: ${overview.latestResult.agentDecisions[0]?.name ?? "Unknown"} · settlement locked on-chain.`,
        resultHash: overview.latestResult.resultHash,
        submitTxHash: overview.latestResult.submitTxHash,
        fighterLeft: resolveAgentSprite({
          image: latestDecisions[0]?.image,
          personality: latestDecisions[0]?.personality,
          fallbackName: latestDecisions[0]?.name,
        }),
        fighterRight: resolveAgentSprite({
          image: latestDecisions[1]?.image,
          personality: latestDecisions[1]?.personality,
          fallbackName: latestDecisions[1]?.name,
        }),
        accent: resolveAgentAccent({
          personality: latestDecisions[0]?.personality,
          fallbackName: latestDecisions[0]?.name,
        }),
        participantCount: overview.latestResult.agentDecisions.length,
        prizePoolLabel: `${formatToken(featuredRound?.[4] ?? 0n)} mUSDC`,
        cta: "REVIEW SETTLEMENT",
      });
    }

    if (cards.length === 0) {
      cards.push({
        key: "idle",
        status: "idle",
        roundId: null,
        title: "WAITING FOR OPERATOR",
        subtitle: "Seed a demo round from the backend to activate live SC + BE flows.",
        fighterLeft: "/blitz.png",
        fighterRight: "/nova.png",
        accent: "#8a5fe0",
        participantCount: 0,
        prizePoolLabel: "0 mUSDC",
        cta: "AWAIT LIVE ROUND",
      });
    }

    return cards;
  }, [currentParticipants, featuredRound, latestDecisions, overview]);

  return (
    <div
      className="font-silk flex justify-center items-start overflow-x-hidden min-h-screen"
      style={{
        color: "#2a2150",
        WebkitFontSmoothing: "none",
        padding: "18px 14px 44px",
        background: "radial-gradient(130% 90% at 50% 0%, #a9e0fb 0%, #8fd0f4 38%, #9bd6c6 78%, #8fc99f 100%)",
      }}
    >
      <div ref={scalerRef} style={{ transformOrigin: "top center" }}>
        <div className="flex flex-col" style={{ width: 1280, gap: 18 }}>
          <div className="flex items-center justify-between" style={{ gap: 14 }}>
            <div className="flex items-center" style={{ gap: 12 }}>
              <button onClick={() => (window.location.href = "/")} style={iconBtnSt}>
                <span className="font-press" style={{ color: "#fff", fontSize: 16 }}>&larr;</span>
              </button>
              <div className="flex items-center" style={{ gap: 11, ...arenaTagSt }}>
                <span className="font-press" style={{ fontSize: 16, color: "#fff", letterSpacing: 1, textShadow: "0 2px 0 #2c3f86" }}>LOBBY</span>
                <img src="/nav-leaderboard.png" alt="" style={{ width: 26, height: 26, imageRendering: "pixelated" }} />
              </div>
            </div>

            <div className="flex items-center" style={{ gap: 11 }}>
              <div className="flex items-center" style={{ gap: 9, ...curSt }}>
                <img src="/usdc-logo.png" alt="" style={{ width: 24, height: 24, imageRendering: "pixelated" }} />
                <span className="font-press" style={{ fontSize: 12, color: "#fff", letterSpacing: ".5px" }}>{`${formatToken(usdcBalance)} mUSDC`}</span>
              </div>
              <button
                onClick={handleClaimFaucet}
                disabled={isPending}
                className="flex items-center justify-center"
                style={{
                  ...curSt,
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.7 : 1,
                }}
              >
                <span className="font-press" style={{ fontSize: 12, color: "#fff", letterSpacing: ".5px" }}>
                  {isPending ? "CLAIMING..." : "CLAIM FAUCET"}
                </span>
              </button>
            </div>

            <TopBarConnectWallet />
          </div>

          <div className="flex items-end justify-between" style={{ gap: 20, background: "rgba(255,255,255,.16)", border: "3px solid rgba(255,255,255,.5)", borderRadius: 18, padding: "18px 22px", backdropFilter: "blur(2px)" }}>
            <div>
              <div className="font-press" style={{ fontSize: 30, color: "#fff", letterSpacing: 1, textShadow: "-3px 0 0 #4a2ea0,3px 0 0 #4a2ea0,0 -3px 0 #4a2ea0,0 3px 0 #4a2ea0,0 6px 0 #2a1660,0 9px 10px rgba(30,15,70,.4)" }}>
                LIVE ARENA LOBBY
              </div>
              <div className="font-silk" style={{ marginTop: 11, fontSize: 14, fontWeight: 700, color: "#2a2150", letterSpacing: ".5px" }}>
                Scout the contenders, top up your bankroll, and send your best build into the arena.
              </div>
              <div className="font-silk" style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "#5b4f8c", letterSpacing: ".4px" }}>
                {currentOpenRoundId > 0n
                  ? `Round #${currentOpenRoundId.toString()} is open. Minimum creator bond: ${formatToken(minimumBond)} mUSDC.`
                  : overview?.latestResult
                    ? `Latest settled round #${overview.latestResult.roundId} is ready for review and reward claims.`
                    : "No open round yet. Seed a new round from the backend operator to unlock create and stake flows."}
              </div>
            </div>
            <button
              onClick={() => setModal(true)}
              className="flex items-center font-press"
              style={{ gap: 13, background: "linear-gradient(180deg,#ffd95a 0%,#ffb22e 55%,#f08c12 100%)", border: "4px solid #7a4405", borderRadius: 15, padding: "13px 24px", cursor: "pointer", fontSize: 15, color: "#fff", letterSpacing: 1, textShadow: "0 2px 0 #c96a08", boxShadow: "0 6px 0 #b86a05, inset 0 3px 0 rgba(255,255,255,.5)", whiteSpace: "nowrap", opacity: currentOpenRoundId > 0n ? 1 : 0.75 }}
            >
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.2)", border: "2px solid #fff", overflow: "hidden", display: "grid", placeItems: "center" }}>
                <img src="/blitz.png" alt="" style={{ width: 30, height: 30, objectFit: "cover", objectPosition: "center 16%", imageRendering: "pixelated" }} />
              </span>
              CREATE AGENT
              <span style={{ fontSize: 18 }}>+</span>
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: arenaCards.length > 1 ? "repeat(2,1fr)" : "1fr", gap: 18 }}>
            {arenaCards.map((arena) => (
              <div
                key={arena.key}
                className="flex flex-col"
                style={{ background: "#f4efe0", border: "4px solid #4a2ea0", borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 0 rgba(74,46,160,.25), 0 14px 26px rgba(50,30,110,.22)" }}
              >
                <div style={{ position: "relative", height: 220, overflow: "hidden", borderBottom: "4px solid #4a2ea0", flexShrink: 0 }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/arena-battle-bg.png')", backgroundSize: "cover", backgroundPosition: "center" }} />
                  <div style={{ position: "absolute", inset: 0, background: arena.accent, opacity: .28, mixBlendMode: "multiply" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(20,12,50,.05) 0%,rgba(20,12,50,0) 40%,rgba(20,12,50,.72) 100%)" }} />

                  <div className="flex items-center font-press" style={{ position: "absolute", top: 11, left: 11, gap: 7, fontSize: 9, color: "#fff", letterSpacing: ".5px", background: arena.status === "live" ? "#e0463c" : arena.status === "settled" ? "#2faa55" : "#7d7596", padding: "6px 10px", borderRadius: 9, border: "2px solid rgba(255,255,255,.7)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", display: "inline-block", animation: arena.status === "live" ? "blink 1.1s steps(2) infinite" : "none" }} />
                    {arena.status.toUpperCase()}
                  </div>

                  <div className="flex items-center font-press" style={{ position: "absolute", top: 11, right: 11, gap: 7, background: "rgba(36,24,70,.82)", border: "2px solid rgba(255,255,255,.6)", borderRadius: 9, padding: "6px 10px", fontSize: 9, color: "#fff", letterSpacing: ".5px" }}>
                    <img src="/badge-swords.png" alt="" style={{ width: 15, height: 15, imageRendering: "pixelated" }} />
                    {arena.participantCount}
                  </div>

                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                    <img src={arena.fighterLeft} alt="" style={{ position: "absolute", bottom: 30, left: "11%", height: 112, width: "auto", imageRendering: "pixelated", filter: "drop-shadow(0 5px 3px rgba(15,8,40,.5))" }} />
                    <img src={arena.fighterRight} alt="" style={{ position: "absolute", bottom: 30, right: "11%", height: 112, width: "auto", imageRendering: "pixelated", filter: "drop-shadow(0 5px 3px rgba(15,8,40,.5))" }} />
                  </div>

                  <div className="font-press" style={{ position: "absolute", left: 14, bottom: 14, right: 14, fontSize: 15, color: "#fff", letterSpacing: ".5px", lineHeight: 1.3, textShadow: "-2px 0 0 #2a1660,2px 0 0 #2a1660,0 -2px 0 #2a1660,0 2px 0 #2a1660,0 4px 6px rgba(0,0,0,.5)" }}>
                    {arena.title}
                  </div>
                </div>

                <div className="flex flex-col" style={{ padding: "14px 16px 16px", gap: 13, flex: 1 }}>
                  <div className="font-silk" style={{ fontSize: 12, fontWeight: 700, color: "#5f547f", lineHeight: 1.5 }}>
                    {arena.subtitle}
                  </div>
                  {arena.submitTxHash ? (
                    <a
                      href={`${mantleSepoliaExplorerUrl}/tx/${arena.submitTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-press"
                      style={{
                        fontSize: 9,
                        color: "#6a44c9",
                        letterSpacing: ".4px",
                        textDecoration: "underline",
                        textUnderlineOffset: 3,
                        width: "fit-content",
                      }}
                    >
                      TX {arena.submitTxHash.slice(0, 10)}...{arena.submitTxHash.slice(-6)}
                    </a>
                  ) : null}
                  {arena.resultHash ? (
                    <a
                      href={`${mantleSepoliaExplorerUrl}/address/${m2Deployment.arena}#readContract`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-press"
                      style={{
                        fontSize: 8,
                        color: "#8e83ad",
                        letterSpacing: ".35px",
                        textDecoration: "underline",
                        textUnderlineOffset: 3,
                        width: "fit-content",
                      }}
                      title={`Check round ${arena.roundId ?? "?"} result hash on-chain in the M2Arena contract`}
                    >
                      RESULT {arena.resultHash.slice(0, 10)}...{arena.resultHash.slice(-6)}
                    </a>
                  ) : null}

                  <div className="flex justify-between" style={{ gap: 8 }}>
                    {[
                      { lab: "AGENTS", val: String(arena.participantCount), icon: "/badge-swords.png", gold: false },
                      { lab: "POOL", val: arena.prizePoolLabel, icon: "/mantle-logo.png", gold: true },
                      { lab: "STATE", val: arena.status.toUpperCase(), icon: "/nav-watch.png", gold: false },
                    ].map((stat, index) => (
                      <div key={stat.lab} className="flex flex-col items-center" style={{ gap: 5, flex: 1, borderLeft: index > 0 ? "2px solid #e2d9c2" : "none" }}>
                        <span className="font-press" style={{ fontSize: 7.5, color: "#9a8f6e", letterSpacing: ".5px" }}>{stat.lab}</span>
                        <span className="flex items-center font-press" style={{ gap: 5, fontSize: 11, color: stat.gold ? "#e08a12" : "#3a2e63" }}>
                          <img src={stat.icon} alt="" style={{ width: 16, height: 16, imageRendering: "pixelated" }} />
                          {stat.val}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => (window.location.href = arena.roundId ? `/arena/${arena.roundId}` : "/arena")}
                    className="font-press flex items-center justify-center"
                    style={{
                      width: "100%",
                      gap: 10,
                      fontSize: 13,
                      color: "#fff",
                      letterSpacing: 1,
                      background: arena.status === "idle" ? "linear-gradient(180deg,#9aa0b4 0%,#7d7596 100%)" : "linear-gradient(180deg,#9b78ee 0%,#7a52da 60%,#6a44c9 100%)",
                      border: arena.status === "idle" ? "3px solid #5a5470" : "3px solid #4a2ea0",
                      borderRadius: 12,
                      padding: 13,
                      cursor: "pointer",
                      textShadow: arena.status === "idle" ? "0 2px 0 #5a5470" : "0 2px 0 #4a2ea0",
                      boxShadow: arena.status === "idle" ? "0 5px 0 #5a5470, inset 0 2px 0 rgba(255,255,255,.3)" : "0 5px 0 #4a2ea0, inset 0 2px 0 rgba(255,255,255,.35)",
                    }}
                  >
                    {arena.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal && (
        <CreateAgentModal
          currentRoundId={currentOpenRoundId}
          minimumBond={minimumBond}
          onClose={() => setModal(false)}
          onCreate={handleCreate}
        />
      )}

      <div
        className="font-press"
        style={{
          position: "fixed", left: "50%", bottom: 34,
          transform: `translateX(-50%) translateY(${toast ? 0 : 20}px)`,
          background: "linear-gradient(180deg,#2faa55,#1c7a3a)", color: "#fff",
          border: "3px solid #145c2a", borderRadius: 13, padding: "14px 22px",
          fontSize: 12, letterSpacing: ".5px",
          boxShadow: "0 6px 0 #0f4720, 0 14px 24px rgba(0,0,0,.3)",
          opacity: toast ? 1 : 0, pointerEvents: "none",
          transition: "all .25s ease", zIndex: 60,
        }}
      >
        {toast}
      </div>
    </div>
  );
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

const iconBtnSt: CSSProperties = {
  width: 48, height: 46, display: "grid", placeItems: "center",
  background: "linear-gradient(180deg,#7e9fe8 0%,#4f76d8 100%)",
  border: "3px solid #2c3f86", borderRadius: 12,
  boxShadow: "0 4px 0 #2c3f86, inset 0 2px 0 rgba(255,255,255,.35)",
  cursor: "pointer", flexShrink: 0,
};

const arenaTagSt: CSSProperties = {
  background: "linear-gradient(180deg,#5a86e6 0%,#3e63c8 100%)",
  border: "3px solid #2c3f86", borderRadius: 12, padding: "10px 18px",
  boxShadow: "0 4px 0 #2c3f86, inset 0 2px 0 rgba(255,255,255,.3)",
};

const curSt: CSSProperties = {
  background: "linear-gradient(180deg,#3a5db0 0%,#2c4790 100%)",
  border: "3px solid #1f3170", borderRadius: 13, padding: "8px 14px 8px 9px",
  boxShadow: "0 4px 0 #1f3170, inset 0 2px 0 rgba(255,255,255,.18)",
  minWidth: 120,
};
