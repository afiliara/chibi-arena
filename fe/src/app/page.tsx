"use client";

import { useEffect, useMemo, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { arenaAbi, m2Deployment } from "@/lib/contracts";
import {
  fetchArenaOverview,
  resolveAgentAccent,
  resolveAgentSprite,
  type BackendAgentDecision,
  type BackendParticipant,
} from "@/lib/backend";
import { formatCompactNumber, formatToken } from "@/lib/format";

type HeroAgent = {
  key: string;
  name: string;
  line: string;
  sprite: string;
  accent: string;
  left: string;
  top: string;
  delay: string;
  spriteH: string;
};

const HERO_POSITIONS = [
  { left: "9.5%", top: "48%", delay: "0s", spriteH: "110px" },
  { left: "28%", top: "40%", delay: ".3s", spriteH: "110px" },
  { left: "57.5%", top: "41%", delay: ".6s", spriteH: "96px" },
  { left: "74%", top: "48%", delay: ".9s", spriteH: "110px" },
] as const;

export default function Home() {
  const scalerRef = useRef<HTMLDivElement>(null);
  const { data: overview } = useQuery({
    queryKey: ["m2", "overview"],
    queryFn: fetchArenaOverview,
    refetchInterval: 15_000,
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

  useEffect(() => {
    function fit() {
      const scaler = scalerRef.current;
      if (!scaler) return;
      const width = 1200;
      const available = window.innerWidth - 32;
      const scale = Math.min(1, available / width);
      scaler.style.transform = `scale(${scale})`;
      scaler.style.marginBottom = `${-(1 - scale) * scaler.offsetHeight}px`;
    }
    window.addEventListener("resize", fit);
    fit();
    return () => window.removeEventListener("resize", fit);
  }, []);

  const heroAgents = useMemo(() => {
    const currentParticipants = overview?.currentRound?.participants ?? [];
    const latestDecisions = overview?.latestResult?.agentDecisions ?? [];
    const source: Array<BackendParticipant | BackendAgentDecision> =
      currentParticipants.length > 0 ? currentParticipants : latestDecisions;

    return source.slice(0, 4).map<HeroAgent>((agent, index) => {
      const position = HERO_POSITIONS[index] ?? HERO_POSITIONS[0];
      const line = "decision" in agent
        ? `${agent.decision.action} ${agent.decision.asset} • ${agent.decision.rationale}`
        : `${agent.tradingStyle} style • ${agent.personality} persona`;

      return {
        key: `${agent.agentId}-${index}`,
        name: agent.name,
        line,
        sprite: resolveAgentSprite({
          image: agent.image,
          personality: agent.personality,
          fallbackName: agent.name,
        }),
        accent: resolveAgentAccent({
          personality: agent.personality,
          fallbackName: agent.name,
          index,
        }),
        left: position.left,
        top: position.top,
        delay: position.delay,
        spriteH: position.spriteH,
      };
    });
  }, [overview]);

  const featuredRound = featuredRoundRaw as
    | readonly [number, bigint, bigint, number, bigint, bigint, bigint, bigint, `0x${string}`, readonly [bigint, bigint, bigint]]
    | undefined;
  const featuredPool = featuredRound?.[4] ?? 0n;
  const featuredParticipantCount = overview?.currentRound?.participantIds.length
    ?? overview?.latestResult?.agentDecisions.length
    ?? 0;
  const topAgent = overview?.latestResult?.agentDecisions[0] ?? null;
  const statusLabel = overview?.currentRound
    ? `ROUND ${overview.currentRound.roundId} LIVE`
    : overview?.latestResult
      ? `ROUND ${overview.latestResult.roundId} SETTLED`
      : "WAITING FOR OPERATOR";

  const heroDescription = overview?.currentRound
    ? "Track the live Mantle round, join with your agent, and support the best performer with on-chain stakes."
    : overview?.latestResult
      ? "The arena has already settled a live round. Review the latest winners, reasoning, and on-chain result hash."
      : "Seed a round from the backend operator to bring the arena online for live staking and settlement.";

  return (
    <div
      style={{
        fontFamily: "var(--font-silkscreen), monospace",
        background:
          "radial-gradient(120% 80% at 50% -10%, #f3f0ff 0%, #e4def6 55%, #d8d0f0 100%)",
        color: "#1c1640",
        WebkitFontSmoothing: "none",
        imageRendering: "pixelated",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "22px 16px 48px",
        overflowX: "hidden",
        minHeight: "100vh",
      }}
    >
      <div ref={scalerRef} style={{ transformOrigin: "top center" }}>
        <div style={{ width: "1200px" }}>
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 10px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
              <img
                src="/nav-shield.png"
                alt=""
                style={{ width: "46px", height: "auto", filter: "drop-shadow(0 3px 0 rgba(60,40,110,.25))" }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <div
                  style={{
                    fontFamily: "var(--font-press-start), monospace",
                    fontSize: "21px",
                    color: "#7a52da",
                    letterSpacing: "1px",
                    textShadow: "0 2px 0 #fff, 2px 2px 0 rgba(120,90,200,.25)",
                  }}
                >
                  CHIBI ARENA
                </div>
                <div style={{ fontSize: "12px", color: "#9a8fc0", letterSpacing: ".5px", fontWeight: 700 }}>
                  Mantle chibi battleground
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
              {[
                { icon: "/nav-watch.png", top: "STATUS", sub: statusLabel },
                {
                  icon: "/nav-lab.png",
                  top: "AGENTS",
                  sub: `${featuredParticipantCount} TRACKED`,
                },
                {
                  icon: "/nav-stake.png",
                  top: "POOL",
                  sub: `${formatToken(featuredPool)} mUSDC`,
                },
                {
                  icon: "/nav-leaderboard.png",
                  top: "TOP",
                  sub: topAgent?.name ?? "NO RESULT",
                },
              ].map(({ icon, top, sub }) => (
                <div
                  key={top}
                  style={{ display: "flex", alignItems: "center", gap: "9px", cursor: "pointer" }}
                >
                  <img src={icon} alt="" style={{ width: "30px", height: "30px" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#3a2e63", letterSpacing: ".5px" }}>
                      {top}
                    </span>
                    <span style={{ fontSize: "9.5px", color: "#9a8fc0", letterSpacing: ".5px" }}>
                      {sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <ConnectWalletButton />
          </nav>

          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1536/1024",
              borderRadius: "22px",
              overflow: "hidden",
              border: "5px solid #2e2356",
              boxShadow:
                "0 14px 0 rgba(60,40,110,.18), 0 22px 50px rgba(60,40,110,.30), inset 0 0 0 4px rgba(255,255,255,.10)",
              backgroundImage: "url('/main%20background.original.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "3.0%",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
                width: "100%",
              }}
            >
              <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <img
                  src="/crown.png"
                  alt=""
                  style={{
                    width: "62px",
                    height: "auto",
                    marginBottom: "-10px",
                    filter: "drop-shadow(0 2px 0 rgba(0,0,0,.25))",
                    position: "relative",
                    zIndex: 2,
                  }}
                />
                <div
                  style={{
                    fontFamily: "var(--font-press-start), monospace",
                    fontSize: "62px",
                    color: "#fff",
                    letterSpacing: "3px",
                    lineHeight: 1,
                    textShadow: `
                      -4px 0 0 #4d2ea3, 4px 0 0 #4d2ea3, 0 -4px 0 #4d2ea3, 0 4px 0 #4d2ea3,
                      -4px -4px 0 #4d2ea3, 4px -4px 0 #4d2ea3, -4px 4px 0 #4d2ea3, 4px 4px 0 #4d2ea3,
                      0 9px 0 #3a2080, 0 13px 0 #2a1660, 0 16px 14px rgba(30,15,70,.45)
                    `,
                  }}
                >
                  CHIBI ARENA
                </div>
              </div>

              <div
                style={{
                  position: "relative",
                  fontFamily: "var(--font-press-start), monospace",
                  fontSize: "14px",
                  color: "#5a3a00",
                  letterSpacing: ".5px",
                  background: "linear-gradient(180deg,#ffe27a 0%, #ffcf3f 55%, #f2a91b 100%)",
                  border: "3px solid #7a4a05",
                  borderRadius: "7px",
                  padding: "10px 26px",
                  boxShadow: "0 4px 0 #b8780c, inset 0 2px 0 rgba(255,255,255,.5)",
                }}
              >
                {statusLabel}
              </div>

              <div
                style={{
                  textAlign: "center",
                  fontWeight: 700,
                  color: "#fff",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  letterSpacing: ".5px",
                  textShadow: "0 2px 0 rgba(40,25,90,.85), 0 0 8px rgba(40,25,90,.6)",
                  maxWidth: "720px",
                }}
              >
                {heroDescription}
              </div>

              <div style={{ display: "flex", gap: "14px", marginTop: "2px" }}>
                {[
                  { icon: "/badge-chart.png", label: overview?.currentRound ? "PYTH SNAPSHOT" : "SETTLED RESULT" },
                  { icon: "/badge-swords.png", label: `${featuredParticipantCount} LIVE AGENTS` },
                  { icon: "/nav-stake.png", label: `${formatCompactNumber(featuredPool)} mUSDC POOL` },
                ].map(({ icon, label }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                      background: "linear-gradient(180deg,#7e57e0 0%, #6a44c9 100%)",
                      border: "3px solid #3a2575",
                      borderRadius: "10px",
                      padding: "8px 15px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#fff",
                      letterSpacing: ".5px",
                      boxShadow: "0 3px 0 #3a2575, inset 0 2px 0 rgba(255,255,255,.25)",
                    }}
                  >
                    <img src={icon} alt="" style={{ width: "22px", height: "22px" }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ position: "absolute", inset: 0 }}>
              {heroAgents.map((agent) => (
                <div
                  key={agent.key}
                  style={{
                    position: "absolute",
                    left: agent.left,
                    top: agent.top,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      background: "#fff",
                      border: "3px solid #2e2356",
                      borderRadius: "11px",
                      padding: "7px 11px 8px",
                      minWidth: "132px",
                      maxWidth: "180px",
                      textAlign: "center",
                      boxShadow: "0 4px 0 rgba(40,25,90,.25)",
                      marginBottom: "9px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-press-start), monospace",
                        fontSize: "10px",
                        letterSpacing: ".5px",
                        marginBottom: "5px",
                        color: agent.accent,
                      }}
                    >
                      {agent.name}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#4a4070",
                        lineHeight: 1.35,
                      }}
                    >
                      {agent.line}
                    </div>
                  </div>

                  <img
                    src={agent.sprite}
                    alt={agent.name}
                    style={{
                      height: agent.spriteH,
                      width: "auto",
                      filter: "drop-shadow(0 7px 5px rgba(20,10,50,.35))",
                      animation: `bob 2.6s ease-in-out ${agent.delay} infinite`,
                    }}
                  />
                </div>
              ))}
            </div>

            <div
              style={{
                position: "absolute",
                bottom: "13.5%",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                width: "100%",
              }}
            >
              <button
                onClick={() => (window.location.href = "/lobby")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  fontFamily: "var(--font-press-start), monospace",
                  fontSize: "26px",
                  color: "#fff",
                  letterSpacing: "1px",
                  background: "linear-gradient(180deg,#ffd95a 0%, #ffb22e 55%, #f08c12 100%)",
                  border: "4px solid #7a4405",
                  borderRadius: "15px",
                  padding: "16px 40px",
                  cursor: "pointer",
                  textShadow: "0 3px 0 #c96a08",
                  boxShadow:
                    "0 7px 0 #b86a05, 0 13px 20px rgba(60,30,0,.35), inset 0 3px 0 rgba(255,255,255,.5)",
                }}
              >
                <img
                  src="/enter-star.png"
                  alt=""
                  style={{ width: "34px", height: "34px", animation: "spin 4s linear infinite" }}
                />
                ENTER ARENA
                <img
                  src="/enter-star.png"
                  alt=""
                  style={{ width: "34px", height: "34px", animation: "spin 4s linear infinite" }}
                />
              </button>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: ".5px",
                  background: "rgba(46,35,86,.78)",
                  border: "2px solid rgba(255,255,255,.35)",
                  borderRadius: "20px",
                  padding: "8px 18px",
                  backdropFilter: "blur(2px)",
                }}
              >
                <span
                  style={{
                    width: "9px",
                    height: "9px",
                    borderRadius: "50%",
                    background: overview?.currentRound ? "#5fe08a" : overview?.latestResult ? "#ffd95a" : "#ff6b6b",
                    boxShadow: `0 0 8px ${overview?.currentRound ? "#5fe08a" : overview?.latestResult ? "#ffd95a" : "#ff6b6b"}`,
                    display: "inline-block",
                  }}
                />
                {statusLabel}
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                bottom: "3.2%",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: "11px",
              }}
            >
              {[
                {
                  icon: <span style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "18px", color: "#7a52da" }}>&#9787;</span>,
                  num: featuredParticipantCount.toString(),
                  lab: "TRACKED AGENTS",
                  numColor: "#2e2356",
                },
                {
                  icon: <img src="/badge-swords.png" alt="" style={{ width: "28px", height: "28px" }} />,
                  num: overview?.latestResult?.agentDecisions[0]?.name ?? "WAITING",
                  lab: "LATEST TOP AGENT",
                  numColor: "#2e2356",
                },
                {
                  icon: <img src="/nav-stake.png" alt="" style={{ width: "28px", height: "28px" }} />,
                  num: formatToken(featuredPool),
                  lab: "CURRENT / LAST POOL",
                  numColor: "#e08a12",
                },
              ].map(({ icon, num, lab, numColor }) => (
                <div
                  key={lab}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "11px",
                    background: "rgba(255,255,255,.90)",
                    border: "3px solid #2e2356",
                    borderRadius: "12px",
                    padding: "9px 16px",
                    boxShadow: "0 4px 0 rgba(40,25,90,.22)",
                  }}
                >
                  <div style={{ width: "30px", height: "30px", display: "grid", placeItems: "center" }}>
                    {icon}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-press-start), monospace",
                        fontSize: "15px",
                        color: numColor,
                      }}
                    >
                      {num}
                    </span>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#8a7fb0", letterSpacing: ".5px" }}>
                      {lab}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <button
            onClick={connected ? (chain.unsupported ? openChainModal : openAccountModal) : openConnectModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontFamily: "var(--font-press-start), monospace",
              fontSize: "11px",
              color: "#fff",
              letterSpacing: ".5px",
              background: "linear-gradient(180deg,#9b78ee 0%, #7a52da 60%, #6a44c9 100%)",
              border: "3px solid #3a2575",
              borderRadius: "13px",
              padding: "11px 18px",
              cursor: "pointer",
              boxShadow: "0 4px 0 #3a2575, inset 0 2px 0 rgba(255,255,255,.35)",
            }}
          >
            <img src="/wallet.PNG" alt="" style={{ width: "26px", height: "26px" }} />
            {connected
              ? chain.unsupported
                ? "WRONG NETWORK"
                : account.displayName
              : "CONNECT WALLET"}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
