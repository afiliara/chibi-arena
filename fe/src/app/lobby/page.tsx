"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

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
const PERSONALITIES = [
  { label: "AGGRESSIVE",   sprite: "/blitz.png"  },
  { label: "MOMENTUM",     sprite: "/nova.png"   },
  { label: "ANALYST",      sprite: "/byte.png"   },
  { label: "CONSERVATIVE", sprite: "/zenith.png" },
];
const TRADING_STYLES = [
  { label: "Scalper", desc: "Scalper style focuses on short-term price moves with high speed and quick decisions." },
  { label: "Swing Trader", desc: "Swing Trader rides medium-term trends, holding positions across multiple rounds for bigger swings." },
  { label: "Trend Follower", desc: "Trend Follower locks onto strong directional momentum and stays in until the trend breaks." },
  { label: "Contrarian", desc: "Contrarian bets against the crowd, buying fear and selling greed for high-variance plays." },
];
const PREVIEW_STATS = [
  { label: "Profitability", value: 85, icon: "/badge-chart.png", fill: "linear-gradient(90deg,#3ad07a,#2faa55)" },
  { label: "Risk Tolerance", value: 72, icon: "/nav-shield.png", fill: "linear-gradient(90deg,#ffcf3f,#f0941b)" },
  { label: "Speed", value: 90, icon: "/nav-watch.png", fill: "linear-gradient(90deg,#6fb0ff,#4f8ae8)" },
  { label: "Stability", value: 65, icon: "/badge-swords.png", fill: "linear-gradient(90deg,#6fb0ff,#4f8ae8)" },
];

/* ─── component ─── */
export default function LobbyPage() {
  const scalerRef              = useRef<HTMLDivElement>(null);
  const [filter, setFilter]    = useState("all");
  const [modal, setModal]      = useState(false);
  const [avatar, setAvatar]    = useState(0);
  const [strat, setStrat]      = useState(0);
  const [name, setName]        = useState("BLITZ-X");
  const [toast, setToast]      = useState<string | null>(null);

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

  function handleCreate() {
    setModal(false);
    const msg = `${name.toUpperCase() || "AGENT"} CREATED!`;
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
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
              {[{ icon: "/mantle-logo.png", val: "12,458" }, { icon: "/usdc-logo.png", val: "2,350" }].map(({ icon, val }) => (
                <div key={val} className="flex items-center" style={{ gap: 9, ...curSt }}>
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
        <div
          className="flex items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(26,16,60,.66)", backdropFilter: "blur(3px)", zIndex: 50, padding: 14, overflow: "auto" }}
        >
          <div style={{ width: 700, maxWidth: "100%", margin: "auto", background: "linear-gradient(180deg,#efeafc 0%,#e6def6 100%)", border: "5px solid #4a2ea0", borderRadius: 22, overflow: "hidden", boxShadow: "0 14px 0 rgba(74,46,160,.3),0 26px 50px rgba(20,10,60,.45)" }}>
            <div style={{ position: "relative", textAlign: "center", background: "linear-gradient(180deg,#9b78ee 0%,#7a52da 55%,#6a44c9 100%)", borderBottom: "4px solid #4a2ea0", padding: "14px 18px 18px" }}>
              <button onClick={() => setModal(false)} className="font-press" style={{ position: "absolute", top: 12, right: 14, width: 38, height: 38, borderRadius: 10, background: "linear-gradient(180deg,#ff6a5f,#e0463c)", border: "3px solid #fff", color: "#fff", fontSize: 14, cursor: "pointer", boxShadow: "0 3px 0 #9a2820" }}>✕</button>
              <div className="font-press flex items-center justify-center" style={{ gap: 14, fontSize: 22, color: "#fff", letterSpacing: 1, textShadow: "-2px 0 0 #4a2ea0,2px 0 0 #4a2ea0,0 -2px 0 #4a2ea0,0 2px 0 #4a2ea0,0 5px 0 #3a2080" }}>
                <img src="/nav-lab.png" alt="" style={{ width: 30, height: 30, imageRendering: "pixelated" }} />
                CREATE AI AGENT
                <img src="/nav-lab.png" alt="" style={{ width: 30, height: 30, imageRendering: "pixelated" }} />
              </div>
              <div className="font-press inline-flex items-center" style={{ gap: 8, marginTop: 11, background: "rgba(36,24,70,.4)", border: "2px solid rgba(255,255,255,.55)", borderRadius: 10, padding: "5px 16px", fontSize: 11, color: "#ffe27a", letterSpacing: 1 }}>
                ✦ AI LAB ✦
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "264px minmax(0,1fr)", gap: 16, padding: 18 }}>
              <div className="flex flex-col" style={{ gap: 16, minWidth: 0 }}>
                <div style={modalPanelSt}>
                  <div style={modalPanelHeadSt}>AGENT PREVIEW</div>
                  <div style={{ position: "relative", height: 236, overflow: "hidden", background: "url('/cropped_1853x969_top_only.png') center/cover no-repeat" }}>
                    <div style={{ position: "absolute", left: 14, top: 10, width: 34, height: 74, background: "linear-gradient(180deg,#6a44c9,#4a2ea0)", border: "2px solid #2a1660", clipPath: "polygon(0 0,100% 0,100% 100%,50% 86%,0 100%)", display: "grid", placeItems: "start center", paddingTop: 8 }}>
                      <span style={{ width: 16, height: 16, background: "#b79bf0", transform: "rotate(45deg)", border: "2px solid #e6d8ff" }} />
                    </div>
                    <div style={{ position: "absolute", left: "50%", bottom: 40, transform: "translateX(-50%)", width: 130, height: 34, borderRadius: "50%", background: "radial-gradient(ellipse,#c79bff 0%,rgba(150,90,240,.4) 50%,transparent 72%)", filter: "blur(1px)" }} />
                    <img src="/platform.png" alt="" style={{ position: "absolute", left: "50%", bottom: 8, transform: "translateX(-50%)", width: "62%", imageRendering: "pixelated", filter: "drop-shadow(0 8px 6px rgba(20,10,50,.45))" }} />
                    <img src={PERSONALITIES[avatar].sprite} alt="" style={{ position: "absolute", left: "50%", bottom: 78, transform: "translateX(-50%)", width: "42%", imageRendering: "pixelated", filter: "drop-shadow(0 6px 4px rgba(20,10,50,.4))" }} />
                  </div>
                </div>

                <div style={modalPanelSt}>
                  <div style={modalPanelHeadSt}>AGENT STATS (PREVIEW)</div>
                  <div className="flex flex-col" style={{ padding: "12px 14px", gap: 11 }}>
                    {PREVIEW_STATS.map(stat => (
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

              <div style={modalPanelSt}>
                <div style={modalPanelHeadSt}>CONFIGURATION</div>
                <div className="flex flex-col" style={{ padding: 16, gap: 17 }}>
                  <div>
                    <ModalFieldLabel num="1">AGENT NAME</ModalFieldLabel>
                    <input className="font-press" type="text" maxLength={14} value={name} onChange={e => setName(e.target.value.toUpperCase())} style={{ width: "100%", fontSize: 14, color: "#3a2e63", background: "#fff", border: "3px solid #cfc4a6", borderRadius: 11, padding: "13px 14px", outline: "none" }} />
                  </div>

                  <div>
                    <ModalFieldLabel num="2">PERSONALITY</ModalFieldLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
                      {PERSONALITIES.map((personality, i) => (
                        <button key={personality.label} onClick={() => setAvatar(i)} style={{ minWidth: 0, background: avatar === i ? "#fff6e6" : "#fff", border: avatar === i ? "3px solid #f0941b" : "3px solid #d9cfb6", borderRadius: 12, padding: "9px 2px 7px", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", boxShadow: avatar === i ? "0 0 0 3px rgba(240,148,27,.3),0 4px 0 rgba(210,118,10,.3)" : "none", transform: avatar === i ? "translateY(-2px)" : "none" }}>
                          <span style={{ width: 42, height: 42, borderRadius: 9, background: avatar === i ? "linear-gradient(180deg,#ffe9c2,#ffd592)" : "#f3eee0", display: "grid", placeItems: "center", overflow: "hidden" }}>
                            <img src={personality.sprite} alt="" style={{ width: 38, height: 38, objectFit: "cover", objectPosition: "center 14%", imageRendering: "pixelated" }} />
                          </span>
                          <span className="font-press" style={{ width: "100%", fontSize: 5.5, color: avatar === i ? "#d3760a" : "#7a6f50", lineHeight: 1.35, overflowWrap: "anywhere" }}>{personality.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <ModalFieldLabel num="3">TRADING STYLE</ModalFieldLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 13, alignItems: "start" }}>
                      <div className="flex flex-col" style={{ gap: 12 }}>
                        {TRADING_STYLES.map((style, i) => (
                          <button key={style.label} onClick={() => setStrat(i)} className="flex items-center" style={{ gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 12, color: strat === i ? "#3a2e63" : "#4a4070", border: 0, background: "transparent", textAlign: "left", padding: 0 }}>
                            <span style={{ width: 19, height: 19, borderRadius: "50%", border: strat === i ? "3px solid #6a44c9" : "3px solid #b3a98c", background: "#fff", flexShrink: 0, display: "grid", placeItems: "center" }}>
                              {strat === i && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#6a44c9" }} />}
                            </span>
                            {style.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ minHeight: 128, background: "#efeafc", border: "3px solid #d6cdf0", borderRadius: 11, padding: "12px 13px", position: "relative", fontWeight: 700, fontSize: 11, lineHeight: 1.55, color: "#6a5fa0" }}>
                        {TRADING_STYLES[strat].desc}
                        <span style={{ position: "absolute", right: 9, bottom: 8, color: "#ffb22e", fontSize: 13 }}>✦</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <ModalFieldLabel num="4">STARTING CAPITAL</ModalFieldLabel>
                    <div className="flex items-center" style={{ gap: 12 }}>
                      <div className="flex items-center" style={{ gap: 10, background: "#fff", border: "3px solid #cfc4a6", borderRadius: 11, padding: "11px 13px", flex: 1 }}>
                        <img src="/usdc-logo.png" alt="" style={{ width: 24, height: 24 }} />
                        <span className="font-press" style={{ fontSize: 12, color: "#3a2e63", flex: 1 }}>100 USDC</span>
                        <span style={{ fontSize: 17 }}>🔒</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 10, color: "#9a8fc0", width: 90, lineHeight: 1.4 }}>Entry fee. Non-refundable.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, alignItems: "stretch", padding: "0 18px 18px" }}>
              <button onClick={() => setModal(false)} className="font-press" style={{ fontSize: 12, color: "#fff", letterSpacing: ".5px", background: "linear-gradient(180deg,#9b78ee,#6a44c9)", border: "4px solid #4a2ea0", borderRadius: 13, padding: "0 22px", cursor: "pointer", textShadow: "0 2px 0 #4a2ea0", boxShadow: "0 5px 0 #4a2ea0,inset 0 2px 0 rgba(255,255,255,.3)" }}>CANCEL</button>
              <button onClick={handleCreate} className="font-press flex items-center justify-center" style={{ gap: 14, fontSize: 16, color: "#fff", letterSpacing: 1, background: "linear-gradient(180deg,#ffd95a 0%,#ffb22e 55%,#f08c12 100%)", border: "4px solid #7a4405", borderRadius: 13, padding: 16, cursor: "pointer", textShadow: "0 2px 0 #c96a08", boxShadow: "0 6px 0 #b86a05,inset 0 3px 0 rgba(255,255,255,.5)" }}>
                CREATE AGENT
                <img src="/enter-star.png" alt="" style={{ width: 24, height: 24, imageRendering: "pixelated" }} />
              </button>
              <div className="flex flex-col items-center justify-center" style={{ gap: 5, background: "#f4efe0", border: "4px solid #4a2ea0", borderRadius: 13, padding: "8px 16px", boxShadow: "0 5px 0 rgba(74,46,160,.2)" }}>
                <span className="font-press" style={{ fontSize: 8, color: "#9a8f6e", letterSpacing: ".5px" }}>ENTRY FEE</span>
                <span className="font-press flex items-center" style={{ gap: 7, fontSize: 11, color: "#3a2e63" }}><img src="/usdc-logo.png" alt="" style={{ width: 20, height: 20 }} />100 USDC</span>
              </div>
            </div>
          </div>
        </div>
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

function ModalFieldLabel({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <div className="font-press flex items-center" style={{ gap: 9, marginBottom: 10, fontSize: 10, color: "#6a5fa0", letterSpacing: ".5px" }}>
      <span className="grid place-items-center" style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, background: "linear-gradient(180deg,#9b78ee,#6a44c9)", border: "2px solid #4a2ea0", color: "#fff", fontSize: 8, boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>
        {num}
      </span>
      {children}
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
const modalPanelSt: React.CSSProperties = {
  minWidth: 0,
  background: "#f4efe0",
  border: "3px solid #4a2ea0",
  borderRadius: 14,
  overflow: "hidden",
  boxShadow: "0 5px 0 rgba(74,46,160,.18)",
};
const modalPanelHeadSt: React.CSSProperties = {
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
