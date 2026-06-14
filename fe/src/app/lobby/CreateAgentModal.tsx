"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import {
  buildAgentConfigHash,
  buildAgentMetadataUri,
} from "@/lib/agents";
import { formatToken } from "@/lib/format";
import {
  agentRegistryAbi,
  arenaAbi,
  m2Constants,
  m2Deployment,
  mockUsdcAbi,
} from "@/lib/contracts";

const PERSONALITIES = [
  { label: "AGGRESSIVE", sprite: "/blitz.png" },
  { label: "MOMENTUM", sprite: "/nova.png" },
  { label: "ANALYST", sprite: "/byte.png" },
  { label: "CONSERVATIVE", sprite: "/zenith.png" },
] as const;

const TRADING_STYLES = [
  {
    label: "Scalper",
    desc: "Scalper style focuses on short-term price moves with high speed and quick decisions.",
  },
  {
    label: "Swing Trader",
    desc: "Swing Trader rides medium-term trends, holding positions across multiple rounds for bigger swings.",
  },
  {
    label: "Trend Follower",
    desc: "Trend Follower locks onto strong directional momentum and stays in until the trend breaks.",
  },
  {
    label: "Contrarian",
    desc: "Contrarian bets against the crowd, buying fear and selling greed for high-variance plays.",
  },
] as const;

const PREVIEW_STATS = [
  { label: "Profitability", value: 85, icon: "/badge-chart.png", fill: "linear-gradient(90deg,#3ad07a,#2faa55)" },
  { label: "Risk Tolerance", value: 72, icon: "/nav-shield.png", fill: "linear-gradient(90deg,#ffcf3f,#f0941b)" },
  { label: "Speed", value: 90, icon: "/nav-watch.png", fill: "linear-gradient(90deg,#6fb0ff,#4f8ae8)" },
  { label: "Stability", value: 65, icon: "/badge-swords.png", fill: "linear-gradient(90deg,#6fb0ff,#4f8ae8)" },
] as const;

type CreateAgentModalProps = {
  currentRoundId: bigint;
  minimumBond: bigint;
  onClose: () => void;
  onCreate: (name: string, txHash: `0x${string}`) => void;
};

export default function CreateAgentModal({
  currentRoundId,
  minimumBond,
  onClose,
  onCreate,
}: CreateAgentModalProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const [avatar, setAvatar] = useState(0);
  const [style, setStyle] = useState(0);
  const [name, setName] = useState("BLITZ-X");
  const [status, setStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    args: address ? [address, m2Deployment.registry] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });

  const roundedBond = minimumBond > 0n
    ? minimumBond
    : 100n * 10n ** BigInt(m2Constants.mockUsdcDecimals);
  const noOpenRound = currentRoundId === 0n;
  const insufficientBalance = (usdcBalance ?? 0n) < roundedBond;
  const personality = PERSONALITIES[avatar].label;
  const tradingStyle = TRADING_STYLES[style].label;

  async function handleCreateClick() {
    if (!isConnected || !address || !publicClient) {
      setErrorMessage("Connect wallet first.");
      return;
    }

    if (noOpenRound) {
      setErrorMessage("No live round is open yet. Seed a round first.");
      return;
    }

    if (insufficientBalance) {
      setErrorMessage("Insufficient mUSDC for the required creator bond.");
      return;
    }

    try {
      setErrorMessage(null);
      const agentName = name.trim().toUpperCase() || "AGENT";
      const agentUri = buildAgentMetadataUri({
        name: agentName,
        personality,
        tradingStyle,
      });
      const configHash = buildAgentConfigHash({
        name: agentName,
        personality,
        tradingStyle,
      });

      if ((allowance ?? 0n) < roundedBond) {
        setStatus("Approving creator bond...");
        const approveHash = await writeContractAsync({
          address: m2Deployment.mockUsdc,
          abi: mockUsdcAbi,
          functionName: "approve",
          args: [m2Deployment.registry, roundedBond],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await refetchAllowance();
      }

      setStatus("Creating and joining current round...");
      const createHash = await writeContractAsync({
        address: m2Deployment.arena,
        abi: arenaAbi,
        functionName: "createAgentAndJoinCurrentRound",
        args: [agentUri, configHash, roundedBond],
      });
      await publicClient.waitForTransactionReceipt({ hash: createHash });
      await refetchBalance();

      setStatus(null);
      onCreate(agentName, createHash);
    } catch (error) {
      setStatus(null);
      const message =
        error instanceof Error ? error.message : "Transaction failed.";
      setErrorMessage(message);
    }
  }

  return (
    <div
      className="flex items-center justify-center"
      onClick={(event) => event.target === event.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(26,16,60,.66)", backdropFilter: "blur(3px)", zIndex: 50, padding: 14, overflow: "auto" }}
    >
      <div style={{ width: 700, maxWidth: "100%", margin: "auto", background: "linear-gradient(180deg,#efeafc 0%,#e6def6 100%)", border: "5px solid #4a2ea0", borderRadius: 22, overflow: "hidden", boxShadow: "0 14px 0 rgba(74,46,160,.3),0 26px 50px rgba(20,10,60,.45)" }}>
        <div style={{ position: "relative", textAlign: "center", background: "linear-gradient(180deg,#9b78ee 0%,#7a52da 55%,#6a44c9 100%)", borderBottom: "4px solid #4a2ea0", padding: "14px 18px 18px" }}>
          <button onClick={onClose} className="font-press" style={{ position: "absolute", top: 12, right: 14, width: 38, height: 38, borderRadius: 10, background: "linear-gradient(180deg,#ff6a5f,#e0463c)", border: "3px solid #fff", color: "#fff", fontSize: 14, cursor: "pointer", boxShadow: "0 3px 0 #9a2820" }}>X</button>
          <div className="font-press flex items-center justify-center" style={{ gap: 14, fontSize: 22, color: "#fff", letterSpacing: 1, textShadow: "-2px 0 0 #4a2ea0,2px 0 0 #4a2ea0,0 -2px 0 #4a2ea0,0 2px 0 #4a2ea0,0 5px 0 #3a2080" }}>
            <img src="/nav-lab.png" alt="" style={{ width: 30, height: 30, imageRendering: "pixelated" }} />
            CREATE AI AGENT
            <img src="/nav-lab.png" alt="" style={{ width: 30, height: 30, imageRendering: "pixelated" }} />
          </div>
          <div className="font-press inline-flex items-center" style={{ gap: 8, marginTop: 11, background: "rgba(36,24,70,.4)", border: "2px solid rgba(255,255,255,.55)", borderRadius: 10, padding: "5px 16px", fontSize: 11, color: "#ffe27a", letterSpacing: 1 }}>AI LAB</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "264px minmax(0,1fr)", gap: 16, padding: 18 }}>
          <div className="flex flex-col" style={{ gap: 16, minWidth: 0 }}>
            <div style={panelStyle}>
              <div style={panelHeadStyle}>AGENT PREVIEW</div>
              <div style={{ position: "relative", height: 236, overflow: "hidden", background: "url('/cropped_1853x969_top_only.png') center/cover no-repeat" }}>
                <div style={{ position: "absolute", left: 14, top: 10, width: 34, height: 74, background: "linear-gradient(180deg,#6a44c9,#4a2ea0)", border: "2px solid #2a1660", clipPath: "polygon(0 0,100% 0,100% 100%,50% 86%,0 100%)", display: "grid", placeItems: "start center", paddingTop: 8 }}>
                  <span style={{ width: 16, height: 16, background: "#b79bf0", transform: "rotate(45deg)", border: "2px solid #e6d8ff" }} />
                </div>
                <div style={{ position: "absolute", left: "50%", bottom: 40, transform: "translateX(-50%)", width: 130, height: 34, borderRadius: "50%", background: "radial-gradient(ellipse,#c79bff 0%,rgba(150,90,240,.4) 50%,transparent 72%)", filter: "blur(1px)" }} />
                <img src="/platform.png" alt="" style={{ position: "absolute", left: "50%", bottom: 8, transform: "translateX(-50%)", width: "62%", imageRendering: "pixelated", filter: "drop-shadow(0 8px 6px rgba(20,10,50,.45))" }} />
                <img src={PERSONALITIES[avatar].sprite} alt="" style={{ position: "absolute", left: "50%", bottom: 78, transform: "translateX(-50%)", width: "42%", imageRendering: "pixelated", filter: "drop-shadow(0 6px 4px rgba(20,10,50,.4))" }} />
              </div>
            </div>

            <div style={panelStyle}>
              <div style={panelHeadStyle}>AGENT STATS (PREVIEW)</div>
              <div className="flex flex-col" style={{ padding: "12px 14px", gap: 11 }}>
                {PREVIEW_STATS.map((stat) => (
                  <div key={stat.label} className="flex items-center" style={{ gap: 10 }}>
                    <img src={stat.icon} alt="" style={{ width: 20, height: 20, flexShrink: 0, imageRendering: "pixelated" }} />
                    <span style={{ fontWeight: 700, fontSize: 11, color: "#4a4070", width: 88, flexShrink: 0 }}>{stat.label}</span>
                    <span style={{ flex: 1, height: 13, background: "#e2d9c2", border: "2px solid #cfc4a6", borderRadius: 7, overflow: "hidden" }}>
                      <span style={{ display: "block", height: "100%", width: `${stat.value}%`, borderRadius: 5, background: stat.fill }} />
                    </span>
                    <span className="font-press" style={{ fontSize: 9, color: "#3a2e63", width: 20, textAlign: "right" }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelHeadStyle}>CONFIGURATION</div>
            <div className="flex flex-col" style={{ padding: 16, gap: 17 }}>
              <div>
                <FieldLabel num="1">AGENT NAME</FieldLabel>
                <input className="font-press" type="text" maxLength={14} value={name} onChange={(event) => setName(event.target.value.toUpperCase())} style={{ width: "100%", fontSize: 14, color: "#3a2e63", background: "#fff", border: "3px solid #cfc4a6", borderRadius: 11, padding: "13px 14px", outline: "none" }} />
              </div>

              <div>
                <FieldLabel num="2">PERSONALITY</FieldLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
                  {PERSONALITIES.map((personalityOption, index) => (
                    <button key={personalityOption.label} onClick={() => setAvatar(index)} style={{ minWidth: 0, background: avatar === index ? "#fff6e6" : "#fff", border: avatar === index ? "3px solid #f0941b" : "3px solid #d9cfb6", borderRadius: 12, padding: "9px 2px 7px", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", boxShadow: avatar === index ? "0 0 0 3px rgba(240,148,27,.3),0 4px 0 rgba(210,118,10,.3)" : "none", transform: avatar === index ? "translateY(-2px)" : "none" }}>
                      <span style={{ width: 42, height: 42, borderRadius: 9, background: avatar === index ? "linear-gradient(180deg,#ffe9c2,#ffd592)" : "#f3eee0", display: "grid", placeItems: "center", overflow: "hidden" }}>
                        <img src={personalityOption.sprite} alt="" style={{ width: 38, height: 38, objectFit: "cover", objectPosition: "center 14%", imageRendering: "pixelated" }} />
                      </span>
                      <span className="font-press" style={{ width: "100%", fontSize: 5.5, color: avatar === index ? "#d3760a" : "#7a6f50", lineHeight: 1.35, overflowWrap: "anywhere" }}>{personalityOption.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel num="3">TRADING STYLE</FieldLabel>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 13, alignItems: "start" }}>
                  <div className="flex flex-col" style={{ gap: 12 }}>
                    {TRADING_STYLES.map((tradingStyleOption, index) => (
                      <button key={tradingStyleOption.label} onClick={() => setStyle(index)} className="flex items-center" style={{ gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 12, color: style === index ? "#3a2e63" : "#4a4070", border: 0, background: "transparent", textAlign: "left", padding: 0 }}>
                        <span style={{ width: 19, height: 19, borderRadius: "50%", border: style === index ? "3px solid #6a44c9" : "3px solid #b3a98c", background: "#fff", flexShrink: 0, display: "grid", placeItems: "center" }}>
                          {style === index && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#6a44c9" }} />}
                        </span>
                        {tradingStyleOption.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ minHeight: 128, background: "#efeafc", border: "3px solid #d6cdf0", borderRadius: 11, padding: "12px 13px", position: "relative", fontWeight: 700, fontSize: 11, lineHeight: 1.55, color: "#6a5fa0" }}>
                    {TRADING_STYLES[style].desc}
                    <span style={{ position: "absolute", right: 9, bottom: 8, color: "#ffb22e", fontSize: 13 }}>*</span>
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel num="4">CREATOR BOND</FieldLabel>
                <div className="flex items-center" style={{ gap: 12 }}>
                  <div className="flex items-center" style={{ gap: 10, background: "#fff", border: "3px solid #cfc4a6", borderRadius: 11, padding: "11px 13px", flex: 1 }}>
                    <img src="/usdc-logo.png" alt="" style={{ width: 24, height: 24 }} />
                    <span className="font-press" style={{ fontSize: 12, color: "#3a2e63", flex: 1 }}>{formatToken(roundedBond)} mUSDC</span>
                    <span style={{ fontSize: 12, color: "#9a8fc0" }}>LOCKED</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 10, color: "#9a8fc0", width: 100, lineHeight: 1.4 }}>Required bond. Not used as battle capital.</div>
                </div>
              </div>

              <div style={{ background: "#efeafc", border: "3px solid #d6cdf0", borderRadius: 11, padding: "11px 13px", fontWeight: 700, fontSize: 11, lineHeight: 1.55, color: "#6a5fa0" }}>
                <div>Open round: {noOpenRound ? "waiting for operator" : `#${currentRoundId.toString()}`}</div>
                <div>Your mUSDC: {formatToken(usdcBalance)} </div>
                {status ? <div style={{ color: "#2faa55", marginTop: 6 }}>{status}</div> : null}
                {errorMessage ? <div style={{ color: "#e0463c", marginTop: 6 }}>{errorMessage}</div> : null}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, alignItems: "stretch", padding: "0 18px 18px" }}>
          <button onClick={onClose} className="font-press" style={{ fontSize: 12, color: "#fff", letterSpacing: ".5px", background: "linear-gradient(180deg,#9b78ee,#6a44c9)", border: "4px solid #4a2ea0", borderRadius: 13, padding: "0 22px", cursor: "pointer", textShadow: "0 2px 0 #4a2ea0", boxShadow: "0 5px 0 #4a2ea0,inset 0 2px 0 rgba(255,255,255,.3)" }}>CANCEL</button>
          <button
            onClick={handleCreateClick}
            disabled={isPending || noOpenRound || insufficientBalance || !isConnected}
            className="font-press flex items-center justify-center"
            style={{ gap: 14, fontSize: 16, color: "#fff", letterSpacing: 1, background: "linear-gradient(180deg,#ffd95a 0%,#ffb22e 55%,#f08c12 100%)", border: "4px solid #7a4405", borderRadius: 13, padding: 16, cursor: isPending ? "progress" : "pointer", textShadow: "0 2px 0 #c96a08", boxShadow: "0 6px 0 #b86a05,inset 0 3px 0 rgba(255,255,255,.5)", opacity: isPending || noOpenRound || insufficientBalance || !isConnected ? 0.65 : 1 }}
          >
            {isPending ? "PENDING..." : "CREATE AGENT"}
            <img src="/enter-star.png" alt="" style={{ width: 24, height: 24, imageRendering: "pixelated" }} />
          </button>
          <div className="flex flex-col items-center justify-center" style={{ gap: 5, background: "#f4efe0", border: "4px solid #4a2ea0", borderRadius: 13, padding: "8px 16px", boxShadow: "0 5px 0 rgba(74,46,160,.2)" }}>
            <span className="font-press" style={{ fontSize: 8, color: "#9a8f6e", letterSpacing: ".5px" }}>BOND</span>
            <span className="font-press flex items-center" style={{ gap: 7, fontSize: 11, color: "#3a2e63" }}><img src="/usdc-logo.png" alt="" style={{ width: 20, height: 20 }} />{formatToken(roundedBond)} mUSDC</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ num, children }: { num: string; children: ReactNode }) {
  return (
    <div className="font-press flex items-center" style={{ gap: 9, marginBottom: 10, fontSize: 10, color: "#6a5fa0", letterSpacing: ".5px" }}>
      <span className="grid place-items-center" style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, background: "linear-gradient(180deg,#9b78ee,#6a44c9)", border: "2px solid #4a2ea0", color: "#fff", fontSize: 8, boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>{num}</span>
      {children}
    </div>
  );
}

const panelStyle: CSSProperties = {
  minWidth: 0,
  background: "#f4efe0",
  border: "3px solid #4a2ea0",
  borderRadius: 14,
  overflow: "hidden",
  boxShadow: "0 5px 0 rgba(74,46,160,.18)",
};

const panelHeadStyle: CSSProperties = {
  background: "linear-gradient(180deg,#8a5fe0,#6a44c9)",
  borderBottom: "3px solid #4a2ea0",
  padding: "9px 14px",
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 10,
  color: "#fff",
  letterSpacing: 1,
  textShadow: "0 2px 0 #4a2ea0",
  textAlign: "center",
};
