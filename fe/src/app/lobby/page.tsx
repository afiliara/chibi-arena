"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import CreateAgentModal from "./CreateAgentModal";
import { agentRegistryAbi, arenaAbi, m2Deployment, mockUsdcAbi } from "@/lib/contracts";
import { formatToken } from "@/lib/format";

/* ─── data ─── */
const ARENAS = [
  { id: 1, status: "live",  bg: "/arena-battle-bg.png",                  tint: "#7a3ce0", name: "CRYSTAL COLISEUM",   fL: "/blitz.png",  fR: "/nova.png",   count: 248, agents: 248, prize: "125,680", timeLabel: "ENDS IN",   time: "02:19", dur: "1.3s",  del: "0s"   },
  { id: 2, status: "live",  bg: "/main%20background.original.png",        tint: "#3a6ccc", name: "ETH BATTLEGROUND",   fL: "/byte.png",   fR: "/zenith.png", count:  96, agents:  96, prize:  "48,200", timeLabel: "ENDS IN",   time: "05:42", dur: "1.15s", del: ".15s" },
  { id: 3, status: "start", bg: "/arena-battle-bg.png",                  tint: "#e07a14", name: "BTC PROVING GROUNDS", fL: "/blitz.png",  fR: "/byte.png",   count:  64, agents:  64, prize:  "90,000", timeLabel: "STARTS IN", time: "00:58", dur: "1.45s", del: ".3s"  },
  { id: 4, status: "live",  bg: "/main%20background.original.png",        tint: "#13a888", name: "SOL SPEEDWAY",        fL: "/nova.png",   fR: "/zenith.png", count: 120, agents: 120, prize:  "22,500", timeLabel: "ENDS IN",   time: "03:11", dur: "1.25s", del: ".1s"  },
  { id: 5, status: "open",  bg: "/arena-battle-bg.png",                  tint: "#2faa55", name: "ROOKIE RING",          fL: "/zenith.png", fR: "/nova.png",   count:  18, agents:  18, prize:   "5,000", timeLabel: "STARTS IN", time: "08:30", dur: "1.5s",  del: "0s"   },
  { id: 6, status: "full",  bg: "/main%20background.original.png",        tint: "#d23c9e", name: "MEME MAYHEM",          fL: "/blitz.png",  fR: "/nova.png",   count: 256, agents: 256, prize:  "60,000", timeLabel: "ENDS IN",   time: "01:45", dur: "1.2s",  del: ".25s" },
];

const STATUS_CFG: Record<string, { bg: string; label: string }> = {
  live:  { bg: "#e0463c", label: "LIVE"     },
  start: { bg: "#e89b14", label: "STARTING" },
  open:  { bg: "#2faa55", label: "OPEN"     },
  full:  { bg: "#7d7596", label: "FULL"     },
};

const TABS   = [
  { id: "all",   label: "ALL",      cnt: 6 },
  { id: "live",  label: "LIVE",     cnt: 3 },
  { id: "start", label: "STARTING", cnt: 1 },
  { id: "open",  label: "OPEN",     cnt: 1 },
];
/* ─── component ─── */
export default function LobbyPage() {
  const scalerRef              = useRef<HTMLDivElement>(null);
  const [filter, setFilter]    = useState("all");
  const [modal, setModal]      = useState(false);
  const [toast, setToast]      = useState<string | null>(null);
  const { address } = useAccount();

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

  const { data: minimumBond = 0n } = useReadContract({
    address: m2Deployment.registry,
    abi: agentRegistryAbi,
    functionName: "minimumActiveBond",
  });

  const { data: usdcBalance } = useReadContract({
    address: m2Deployment.mockUsdc,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });

  /* scaler — scale down only, page is scrollable */
  useEffect(() => {
    function fit() {
      const el = scalerRef.current;
      if (!el) return;
      const s = Math.min(1, (window.innerWidth - 28) / 1280);
      el.style.transform = `scale(${s})`;
      el.style.marginBottom = s < 1 ? `${-(1 - s) * el.offsetHeight}px` : "0px";
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

  const visible = filter === "all" ? ARENAS : ARENAS.filter(a => a.status === filter);

  return (
    <div
      className="font-silk flex justify-center items-start overflow-x-hidden min-h-screen"
      style={{
        color: "#2a2150", WebkitFontSmoothing: "none",
        padding: "18px 14px 44px",
        background: "radial-gradient(130% 90% at 50% 0%, #a9e0fb 0%, #8fd0f4 38%, #9bd6c6 78%, #8fc99f 100%)",
      }}
    >
      <div ref={scalerRef} style={{ transformOrigin: "top center" }}>
        <div className="flex flex-col" style={{ width: 1280, gap: 18 }}>

          {/* ═══ TOP BAR ═══ */}
          <div className="flex items-center justify-between" style={{ gap: 14 }}>
            <div className="flex items-center" style={{ gap: 12 }}>
              <button onClick={() => (window.location.href = "/")} style={iconBtnSt}>
                <span className="font-press" style={{ color: "#fff", fontSize: 16 }}>←</span>
              </button>
              <div className="flex items-center" style={{ gap: 11, ...arenaTagSt }}>
                <span className="font-press" style={{ fontSize: 16, color: "#fff", letterSpacing: 1, textShadow: "0 2px 0 #2c3f86" }}>LOBBY</span>
                <img src="/nav-leaderboard.png" alt="" style={{ width: 26, height: 26, imageRendering: "pixelated" }} />
              </div>
            </div>

            <div className="flex items-center" style={{ gap: 11 }}>
              {[
                { icon: "/mantle-logo.png", val: currentOpenRoundId > 0n ? `ROUND ${currentOpenRoundId.toString()}` : `LAST ${lastRoundId.toString()}` },
                { icon: "/usdc-logo.png", val: `${formatToken(usdcBalance)} mUSDC` },
              ].map(({ icon, val }) => (
                <div key={icon} className="flex items-center" style={{ gap: 9, ...curSt }}>
                  <img src={icon} alt="" style={{ width: 24, height: 24, imageRendering: "pixelated" }} />
                  <span className="font-press" style={{ fontSize: 12, color: "#fff", letterSpacing: ".5px" }}>{val}</span>
                </div>
              ))}
            </div>

            <TopBarConnectWallet />
          </div>

          {/* ═══ HEADER ROW ═══ */}
          <div className="flex items-end justify-between" style={{ gap: 20, background: "rgba(255,255,255,.16)", border: "3px solid rgba(255,255,255,.5)", borderRadius: 18, padding: "18px 22px", backdropFilter: "blur(2px)" }}>
            <div>
              <div className="font-press" style={{ fontSize: 30, color: "#fff", letterSpacing: 1, textShadow: "-3px 0 0 #4a2ea0,3px 0 0 #4a2ea0,0 -3px 0 #4a2ea0,0 3px 0 #4a2ea0,0 6px 0 #2a1660,0 9px 10px rgba(30,15,70,.4)" }}>
                CHOOSE YOUR ARENA
              </div>
              <div className="font-silk" style={{ marginTop: 11, fontSize: 14, fontWeight: 700, color: "#2a2150", letterSpacing: ".5px" }}>
                Pick a battlefield and watch AI agents fight for the prize pool — or build your own.
              </div>
              <div className="font-silk" style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "#5b4f8c", letterSpacing: ".4px" }}>
                {currentOpenRoundId > 0n
                  ? `Live round #${currentOpenRoundId.toString()} is accepting new agents. Minimum creator bond: ${formatToken(minimumBond)} mUSDC.`
                  : "No round is open yet. Run the demo seeding step from the operator account to unlock live create and stake flows."}
              </div>
            </div>
            <button
              onClick={() => setModal(true)}
              className="flex items-center font-press"
              style={{ gap: 13, background: "linear-gradient(180deg,#ffd95a 0%,#ffb22e 55%,#f08c12 100%)", border: "4px solid #7a4405", borderRadius: 15, padding: "13px 24px", cursor: "pointer", fontSize: 15, color: "#fff", letterSpacing: 1, textShadow: "0 2px 0 #c96a08", boxShadow: "0 6px 0 #b86a05, inset 0 3px 0 rgba(255,255,255,.5)", whiteSpace: "nowrap" }}
            >
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.2)", border: "2px solid #fff", overflow: "hidden", display: "grid", placeItems: "center" }}>
                <img src="/blitz.png" alt="" style={{ width: 30, height: 30, objectFit: "cover", objectPosition: "center 16%", imageRendering: "pixelated" }} />
              </span>
              CREATE AGENT
              <span style={{ fontSize: 18 }}>+</span>
            </button>
          </div>

          {/* ═══ TABS ═══ */}
          <div className="flex" style={{ gap: 11 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className="font-press"
                style={{
                  fontSize: 11, letterSpacing: ".5px", color: "#fff",
                  background: filter === tab.id ? "linear-gradient(180deg,#8a5fe0,#6a44c9)" : "rgba(74,46,160,.4)",
                  border: filter === tab.id ? "3px solid #fff" : "3px solid rgba(255,255,255,.45)",
                  borderRadius: 11, padding: "10px 18px", cursor: "pointer",
                  boxShadow: filter === tab.id ? "0 4px 0 #4a2ea0" : "none",
                }}
              >
                {tab.label} <span style={{ color: "#ffe27a", marginLeft: 6 }}>{tab.cnt}</span>
              </button>
            ))}
          </div>

          {/* ═══ GRID ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
            {visible.map(arena => {
              const st = STATUS_CFG[arena.status];
              const isSpectate = arena.status === "full";
              return (
                <div
                  key={arena.id}
                  className="flex flex-col"
                  style={{ background: "#f4efe0", border: "4px solid #4a2ea0", borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 0 rgba(74,46,160,.25), 0 14px 26px rgba(50,30,110,.22)", cursor: "pointer" }}
                >
                  {/* thumbnail */}
                  <div style={{ position: "relative", height: 176, overflow: "hidden", borderBottom: "4px solid #4a2ea0", flexShrink: 0 }}>
                    {/* bg */}
                    <div style={{ position: "absolute", inset: 0, backgroundImage: `url('${arena.bg}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                    {/* tint */}
                    <div style={{ position: "absolute", inset: 0, background: arena.tint, opacity: .38, mixBlendMode: "multiply" }} />
                    {/* shade */}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(20,12,50,.05) 0%,rgba(20,12,50,0) 40%,rgba(20,12,50,.72) 100%)" }} />

                    {/* status badge */}
                    <div className="flex items-center font-press" style={{ position: "absolute", top: 11, left: 11, gap: 7, fontSize: 9, color: "#fff", letterSpacing: ".5px", background: st.bg, padding: "6px 10px", borderRadius: 9, border: "2px solid rgba(255,255,255,.7)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", display: "inline-block", animation: arena.status === "live" ? "blink 1.1s steps(2) infinite" : "none" }} />
                      {st.label}
                    </div>

                    {/* count pill */}
                    <div className="flex items-center font-press" style={{ position: "absolute", top: 11, right: 11, gap: 7, background: "rgba(36,24,70,.82)", border: "2px solid rgba(255,255,255,.6)", borderRadius: 9, padding: "6px 10px", fontSize: 9, color: "#fff", letterSpacing: ".5px" }}>
                      <img src="/badge-swords.png" alt="" style={{ width: 15, height: 15, imageRendering: "pixelated" }} />
                      {arena.count}
                    </div>

                    {/* fighters */}
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                      <img src={arena.fL} alt="" style={{ position: "absolute", bottom: 30, left: "11%", height: 98, width: "auto", imageRendering: "pixelated", filter: "drop-shadow(0 5px 3px rgba(15,8,40,.5))", transformOrigin: "bottom center", animation: `lungeL ${arena.dur} ease-in-out ${arena.del} infinite` }} />
                      <div style={{ position: "absolute", left: "50%", bottom: 62, width: 50, height: 50, background: "radial-gradient(circle,#fff 0 15%,#ffe27a 15% 33%,#ff8a1e 33% 46%,transparent 46%)", clipPath: "polygon(50% 0,60% 34%,98% 35%,68% 57%,80% 92%,50% 71%,20% 92%,32% 57%,2% 35%,40% 34%)", animation: `clashBurst ${arena.dur} ease-in-out ${arena.del} infinite` }} />
                      <img src={arena.fR} alt="" style={{ position: "absolute", bottom: 30, right: "11%", height: 98, width: "auto", imageRendering: "pixelated", filter: "drop-shadow(0 5px 3px rgba(15,8,40,.5))", transformOrigin: "bottom center", animation: `lungeR ${arena.dur} ease-in-out ${arena.del} infinite` }} />
                    </div>

                    {/* arena name */}
                    <div className="font-press" style={{ position: "absolute", left: 14, bottom: 12, right: 14, fontSize: 15, color: "#fff", letterSpacing: ".5px", lineHeight: 1.3, textShadow: "-2px 0 0 #2a1660,2px 0 0 #2a1660,0 -2px 0 #2a1660,0 2px 0 #2a1660,0 4px 6px rgba(0,0,0,.5)" }}>
                      {arena.name}
                    </div>
                  </div>

                  {/* card body */}
                  <div className="flex flex-col" style={{ padding: "14px 16px 16px", gap: 13, flex: 1 }}>
                    {/* stats row */}
                    <div className="flex justify-between" style={{ gap: 8 }}>
                      {[
                        { lab: "AGENTS",       val: String(arena.agents), icon: "/badge-swords.png", gold: false },
                        { lab: "PRIZE",        val: arena.prize,          icon: "/mantle-logo.png",  gold: true  },
                        { lab: arena.timeLabel, val: `⏱ ${arena.time}`,  icon: null,                gold: false, time: true },
                      ].map((s, i) => (
                        <div key={i} className="flex flex-col items-center" style={{ gap: 5, flex: 1, borderLeft: i > 0 ? "2px solid #e2d9c2" : "none" }}>
                          <span className="font-press" style={{ fontSize: 7.5, color: "#9a8f6e", letterSpacing: ".5px" }}>{s.lab}</span>
                          <span className="flex items-center font-press" style={{ gap: 5, fontSize: 12, color: s.gold ? "#e08a12" : s.time ? "#6a44c9" : "#3a2e63" }}>
                            {s.icon && <img src={s.icon} alt="" style={{ width: 17, height: 17, imageRendering: "pixelated" }} />}
                            {s.val}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* enter button */}
                    <button
                      onClick={() => (window.location.href = "/arena")}
                      className="font-press flex items-center justify-center"
                      style={{
                        width: "100%", gap: 10, fontSize: 13, color: "#fff", letterSpacing: 1,
                        background: isSpectate ? "linear-gradient(180deg,#9aa0b4 0%,#7d7596 100%)" : "linear-gradient(180deg,#9b78ee 0%,#7a52da 60%,#6a44c9 100%)",
                        border: isSpectate ? "3px solid #5a5470" : "3px solid #4a2ea0",
                        borderRadius: 12, padding: 13, cursor: "pointer",
                        textShadow: isSpectate ? "0 2px 0 #5a5470" : "0 2px 0 #4a2ea0",
                        boxShadow: isSpectate ? "0 5px 0 #5a5470, inset 0 2px 0 rgba(255,255,255,.3)" : "0 5px 0 #4a2ea0, inset 0 2px 0 rgba(255,255,255,.35)",
                      }}
                    >
                      {isSpectate ? "SPECTATE ◎" : "ENTER ARENA ▶"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ CREATE AGENT MODAL ═══ */}
      {modal && (
        <CreateAgentModal
          currentRoundId={currentOpenRoundId}
          minimumBond={minimumBond}
          onClose={() => setModal(false)}
          onCreate={handleCreate}
        />
      )}

      {/* ═══ TOAST ═══ */}
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

/* ─── shared style objects ─── */
const iconBtnSt: React.CSSProperties = {
  width: 48, height: 46, display: "grid", placeItems: "center",
  background: "linear-gradient(180deg,#7e9fe8 0%,#4f76d8 100%)",
  border: "3px solid #2c3f86", borderRadius: 12,
  boxShadow: "0 4px 0 #2c3f86, inset 0 2px 0 rgba(255,255,255,.35)",
  cursor: "pointer", flexShrink: 0,
};
const arenaTagSt: React.CSSProperties = {
  background: "linear-gradient(180deg,#5a86e6 0%,#3e63c8 100%)",
  border: "3px solid #2c3f86", borderRadius: 12, padding: "10px 18px",
  boxShadow: "0 4px 0 #2c3f86, inset 0 2px 0 rgba(255,255,255,.3)",
};
const curSt: React.CSSProperties = {
  background: "linear-gradient(180deg,#3a5db0 0%,#2c4790 100%)",
  border: "3px solid #1f3170", borderRadius: 13, padding: "8px 14px 8px 9px",
  boxShadow: "0 4px 0 #1f3170, inset 0 2px 0 rgba(255,255,255,.18)",
  minWidth: 120,
};
