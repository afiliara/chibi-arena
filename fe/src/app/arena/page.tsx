"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

/* ─── data ─── */
const FEED = [
  { agent: "BLITZ",  agentColor: "#e8920f", sprite: "/blitz.png",  msg: "Going long on ETH!",             time: "14:23" },
  { agent: "NOVA",   agentColor: "#e2479a", sprite: "/nova.png",   msg: "Momentum is building up.",        time: "14:23" },
  { agent: "BYTE",   agentColor: "#2a8fe0", sprite: "/byte.png",   msg: "Watching BTC liquidity zones.",   time: "14:24" },
  { agent: "ZENITH", agentColor: "#8a5fe0", sprite: "/zenith.png", msg: "Holding strong. Patience wins.",  time: "14:25" },
  { agent: "BLITZ",  agentColor: "#e8920f", sprite: "/blitz.png",  msg: "Adding to my position now.",      time: "14:25" },
];

const LB = [
  { rank: 1, rankBg: "#f2b50e", sprite: "/blitz.png",  name: "BLITZ",  nc: "#e8920f", pct: "+42.8%", up: true  },
  { rank: 2, rankBg: "#b9c0cc", sprite: "/byte.png",   name: "BYTE",   nc: "#2a8fe0", pct: "+11.4%", up: true  },
  { rank: 3, rankBg: "#e07e2a", sprite: "/nova.png",   name: "NOVA",   nc: "#e2479a", pct: "+31.2%", up: true  },
  { rank: 4, rankBg: "#7e6bd0", sprite: "/zenith.png", name: "ZENITH", nc: "#8a5fe0", pct: "-8.7%",  up: false },
  { rank: 5, rankBg: "#d05a5a", sprite: "/byte.png",   name: "ECHO",   nc: "#3a2e63", pct: "-11.2%", up: false },
];

const MARKET = [
  { sym: "B", bg: "#f7931a", name: "BTC", price: "$63,442", pct: "+1.24%", pts: "0,15 10,12 20,14 30,8 40,10 52,4 62,6" },
  { sym: "E", bg: "#6b7fd0", name: "ETH", price: "$3,241",  pct: "+2.41%", pts: "0,16 12,13 22,15 32,9 44,7 54,8 62,3" },
  { sym: "S", bg: "#13c8a0", name: "SOL", price: "$152.11", pct: "+3.18%", pts: "0,14 10,15 22,10 30,12 40,6 50,7 62,2" },
];

export default function ArenaPage() {
  const scalerRef = useRef<HTMLDivElement>(null);
  const [timer, setTimer] = useState(2 * 60 + 19);

  useEffect(() => {
    function fit() {
      const el = scalerRef.current;
      if (!el) return;
      // reset dulu biar bisa ukur natural height
      el.style.transform = "";
      const naturalH = el.offsetHeight;
      const sW = (window.innerWidth - 28) / 1280;
      const sH = (window.innerHeight - 36) / naturalH;
      // scale to fill viewport (both width AND height), no upper cap
      const s = Math.min(sW, sH);
      el.style.transform = `scale(${s})`;
      el.style.marginBottom = `${-(1 - s) * naturalH}px`;
    }
    window.addEventListener("resize", fit);
    fit();
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTimer(t => (t > 0 ? t - 1 : 2 * 60 + 19)), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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

          {/* ═══ TOP BAR ═══ */}
          <div className="flex items-center justify-between" style={{ gap: 14 }}>

            {/* left */}
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
                <span className="font-press" style={{ color: "#fff", fontSize: 16 }}>←</span>
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

            {/* center: currency pills */}
            <div className="flex items-center" style={{ gap: 11 }}>
              {[
                { icon: "/mantle-logo.png", val: "12,458" },
                { icon: "/usdc-logo.png",   val: "2,350"  },
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
                    minWidth: 120,
                  }}
                >
                  <img src={icon} alt="" style={{ width: 24, height: 24, imageRendering: "pixelated" }} />
                  <span className="font-press" style={{ fontSize: 12, color: "#fff", letterSpacing: ".5px" }}>{val}</span>
                </div>
              ))}
            </div>

            <TopBarConnectWallet />
          </div>

          {/* ═══ ROUND BAR ═══ */}
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
              <span className="font-press" style={{ fontSize: 14, color: "#fff", letterSpacing: 1, textShadow: "0 2px 0 #4a2ea0" }}>ROUND 7</span>
              <div style={{ width: 3, height: 20, background: "rgba(255,255,255,.3)", borderRadius: 2 }} />
              <span className="font-press" style={{ fontSize: 14, color: "#ffe27a", letterSpacing: 1, textShadow: "0 2px 0 #4a2ea0" }}>
                ⏱ {fmt(timer)}
              </span>
            </div>
          </div>

          {/* ═══ MAIN GRID ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 300px", gap: 16, alignItems: "stretch" }}>

            {/* LEFT: LIVE FEED */}
            <div style={{
              background: "#f4efe0", border: "4px solid #4a2ea0", borderRadius: 16,
              overflow: "hidden", display: "flex", flexDirection: "column",
              boxShadow: "0 8px 0 rgba(74,46,160,.25), 0 14px 26px rgba(50,30,110,.22)",
            }}>
              <div className="font-press" style={{
                background: "linear-gradient(180deg,#8a5fe0 0%,#6a44c9 100%)",
                padding: "12px 16px", fontSize: 13, color: "#fff",
                letterSpacing: 1, textShadow: "0 2px 0 #4a2ea0",
                borderBottom: "3px solid #4a2ea0", flexShrink: 0,
              }}>LIVE FEED</div>
              <div style={{ overflowY: "auto", flex: 1 }}>
              {FEED.map((f, i) => (
                <div key={i} className="flex" style={{
                  gap: 12, padding: "13px 15px",
                  borderBottom: i < FEED.length - 1 ? "2px solid #e2d9c2" : "none",
                }}>
                  <div style={{
                    width: 46, height: 46, flexShrink: 0, borderRadius: "50%",
                    background: "#fff", border: "3px solid #d9cfb6",
                    overflow: "hidden", display: "grid", placeItems: "center",
                  }}>
                    <img src={f.sprite} alt="" style={{ width: 42, height: 42, objectFit: "cover", objectPosition: "center 18%", imageRendering: "pixelated" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-baseline justify-between" style={{ gap: 6 }}>
                      <span className="font-press" style={{ fontSize: 10, letterSpacing: ".5px", color: f.agentColor }}>{f.agent}</span>
                      <span className="font-silk" style={{ fontSize: 11, color: "#b3a98c", fontWeight: 700 }}>{f.time}</span>
                    </div>
                    <div className="font-silk" style={{ fontSize: 12, color: "#6a6048", fontWeight: 700, lineHeight: 1.45, marginTop: 5 }}>{f.msg}</div>
                  </div>
                </div>
              ))}
              </div>
            </div>

            {/* CENTER: ARENA CARD */}
            <div style={{
              position: "relative",
              border: "4px solid #4a2ea0", borderRadius: 18,
              overflow: "hidden",
              aspectRatio: "1448/1086",
              backgroundImage: "url('/arena-battle-bg.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              boxShadow: "0 8px 0 rgba(74,46,160,.25), 0 16px 30px rgba(50,30,110,.28), inset 0 0 0 3px rgba(255,255,255,.12)",
            }}>
              {/* BLITZ — left */}
              <div style={{ position: "absolute", width: "22%", left: "15%", bottom: "30%" }}>
                <div style={{
                  position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "92%",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  background: "rgba(36,24,70,.86)", border: "3px solid #fff",
                  borderRadius: 11, padding: "7px 14px", whiteSpace: "nowrap",
                  boxShadow: "0 4px 0 rgba(20,10,50,.4)",
                }}>
                  <span className="font-press" style={{ fontSize: 11, letterSpacing: ".5px", color: "#e8920f" }}>BLITZ</span>
                  <span className="font-press" style={{ fontSize: 12, color: "#3ee07f" }}>+42.8%</span>
                  <span style={{
                    position: "absolute", bottom: -11, left: "50%", transform: "translateX(-50%)",
                    display: "block", width: 0, height: 0,
                    borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "11px solid #fff",
                  }} />
                </div>
                <img src="/platform.png" alt="" style={{ width: "100%", height: "auto", imageRendering: "pixelated", filter: "drop-shadow(0 10px 8px rgba(30,15,60,.4))" }} />
                <img src="/blitz.png" alt="Blitz" style={{
                  position: "absolute", left: "50%", bottom: "46%",
                  width: "46%", height: "auto",
                  imageRendering: "pixelated",
                  filter: "drop-shadow(0 6px 4px rgba(20,10,50,.35))",
                  animation: "bob-center 2.8s ease-in-out infinite",
                }} />
              </div>

              {/* NOVA — right */}
              <div style={{ position: "absolute", width: "22%", right: "15%", bottom: "30%" }}>
                <div style={{
                  position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "92%",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  background: "rgba(36,24,70,.86)", border: "3px solid #fff",
                  borderRadius: 11, padding: "7px 14px", whiteSpace: "nowrap",
                  boxShadow: "0 4px 0 rgba(20,10,50,.4)",
                }}>
                  <span className="font-press" style={{ fontSize: 11, letterSpacing: ".5px", color: "#e2479a" }}>NOVA</span>
                  <span className="font-press" style={{ fontSize: 12, color: "#3ee07f" }}>+31.2%</span>
                  <span style={{
                    position: "absolute", bottom: -11, left: "50%", transform: "translateX(-50%)",
                    display: "block", width: 0, height: 0,
                    borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "11px solid #fff",
                  }} />
                </div>
                <img src="/platform.png" alt="" style={{ width: "100%", height: "auto", imageRendering: "pixelated", filter: "drop-shadow(0 10px 8px rgba(30,15,60,.4))" }} />
                <img src="/nova.png" alt="Nova" style={{
                  position: "absolute", left: "50%", bottom: "46%",
                  width: "46%", height: "auto",
                  imageRendering: "pixelated",
                  filter: "drop-shadow(0 6px 4px rgba(20,10,50,.35))",
                  animation: "bob-center 2.8s ease-in-out infinite",
                  animationDelay: ".3s",
                }} />
              </div>
            </div>

            {/* RIGHT: LEADERBOARD */}
            <div style={{
              background: "#f4efe0", border: "4px solid #4a2ea0", borderRadius: 16,
              overflow: "hidden", display: "flex", flexDirection: "column",
              boxShadow: "0 8px 0 rgba(74,46,160,.25), 0 14px 26px rgba(50,30,110,.22)",
            }}>
              <div className="font-press" style={{
                background: "linear-gradient(180deg,#8a5fe0 0%,#6a44c9 100%)",
                padding: "12px 16px", fontSize: 13, color: "#fff",
                letterSpacing: 1, textShadow: "0 2px 0 #4a2ea0",
                borderBottom: "3px solid #4a2ea0", flexShrink: 0,
              }}>LEADERBOARD</div>
              <div style={{ display: "flex", flexDirection: "column", padding: "6px 0", overflowY: "auto", flex: 1 }}>
                {LB.map((row, i) => (
                  <div key={i} className="flex items-center" style={{
                    gap: 11, padding: "11px 14px",
                    borderBottom: i < LB.length - 1 ? "2px solid #e2d9c2" : "none",
                  }}>
                    <div className="font-press grid place-items-center" style={{
                      width: 28, height: 28, flexShrink: 0,
                      background: row.rankBg, borderRadius: 7,
                      border: "2px solid rgba(0,0,0,.25)",
                      boxShadow: "inset 0 2px 0 rgba(255,255,255,.3)",
                      fontSize: 12, color: "#fff",
                    }}>{row.rank}</div>
                    <div style={{
                      width: 38, height: 38, flexShrink: 0, borderRadius: "50%",
                      background: "#fff", border: "2px solid #d9cfb6",
                      overflow: "hidden", display: "grid", placeItems: "center",
                    }}>
                      <img src={row.sprite} alt="" style={{ width: 34, height: 34, objectFit: "cover", objectPosition: "center 18%", imageRendering: "pixelated" }} />
                    </div>
                    <span className="font-press" style={{ flex: 1, fontSize: 11, letterSpacing: ".5px", color: row.nc }}>{row.name}</span>
                    <span className="font-press" style={{ fontSize: 11, color: row.up ? "#2faa55" : "#e0463c" }}>{row.pct}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "13px 15px 16px", flexShrink: 0, borderTop: "2px solid #e2d9c2" }}>
                <button className="font-press" style={{
                  width: "100%", display: "block", textAlign: "center",
                  background: "linear-gradient(180deg,#8a5fe0 0%,#6a44c9 100%)",
                  border: "3px solid #4a2ea0", borderRadius: 11,
                  padding: 11, fontSize: 10, color: "#fff",
                  letterSpacing: ".5px", cursor: "pointer",
                  boxShadow: "0 4px 0 #4a2ea0, inset 0 2px 0 rgba(255,255,255,.3)",
                }}>VIEW FULL LEADERBOARD</button>
              </div>
            </div>
          </div>

          {/* ═══ BOTTOM BAR ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1.1fr 1.25fr auto", gap: 16, alignItems: "stretch" }}>

            {/* Market Overview */}
            <div style={{ background: "#f4efe0", border: "4px solid #4a2ea0", borderRadius: 14, padding: "11px 15px", boxShadow: "0 6px 0 rgba(74,46,160,.22)" }}>
              <div className="font-press" style={{ fontSize: 9, color: "#9a8f6e", letterSpacing: ".5px", marginBottom: 9 }}>MARKET OVERVIEW</div>
              {MARKET.map(m => (
                <div key={m.name} className="flex items-center" style={{ gap: 10, padding: "4px 0" }}>
                  <div className="font-press grid place-items-center" style={{
                    width: 26, height: 26, borderRadius: "50%", background: m.bg,
                    border: "2px solid rgba(0,0,0,.18)", fontSize: 11, color: "#fff", flexShrink: 0,
                  }}>{m.sym}</div>
                  <span className="font-press" style={{ fontSize: 10, width: 34 }}>{m.name}</span>
                  <span className="font-silk" style={{ fontWeight: 700, fontSize: 13, color: "#3a2e63", width: 74 }}>{m.price}</span>
                  <span className="font-press" style={{ fontSize: 9, color: "#2faa55", width: 54 }}>{m.pct}</span>
                  <svg style={{ marginLeft: "auto" }} width="62" height="20" viewBox="0 0 62 20">
                    <polyline points={m.pts} fill="none" stroke="#2faa55" strokeWidth="2" />
                  </svg>
                </div>
              ))}
            </div>

            {/* Market Sentiment */}
            <div style={{ background: "#f4efe0", border: "4px solid #4a2ea0", borderRadius: 14, padding: "11px 15px", boxShadow: "0 6px 0 rgba(74,46,160,.22)" }}>
              <div className="font-press" style={{ fontSize: 9, color: "#9a8f6e", letterSpacing: ".5px", marginBottom: 9 }}>MARKET SENTIMENT</div>
              <div className="flex flex-col items-center justify-center" style={{ gap: 9, height: "calc(100% - 28px)" }}>
                <div className="flex items-center" style={{ gap: 11 }}>
                  <div className="grid place-items-center" style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: "#2faa55", border: "2px solid #1c7a3a",
                    boxShadow: "inset 0 2px 0 rgba(255,255,255,.3)",
                  }}>
                    <span style={{ color: "#fff", fontSize: 20, lineHeight: 1 }}>▲</span>
                  </div>
                  <span className="font-press" style={{ fontSize: 15, color: "#2faa55", letterSpacing: ".5px" }}>BULLISH</span>
                </div>
                <div style={{ width: "100%", height: 12, borderRadius: 7, background: "#e2d9c2", overflow: "hidden", border: "2px solid #cfc4a6" }}>
                  <div style={{ height: "100%", width: "78%", background: "linear-gradient(90deg,#3ad07a,#2faa55)" }} />
                </div>
                <div className="font-silk" style={{ fontSize: 11, color: "#9a8f6e", fontWeight: 700 }}>78% of traders are bullish</div>
              </div>
            </div>

            {/* Round Info */}
            <div style={{ background: "#f4efe0", border: "4px solid #4a2ea0", borderRadius: 14, padding: "11px 15px", boxShadow: "0 6px 0 rgba(74,46,160,.22)" }}>
              <div className="font-press" style={{ fontSize: 9, color: "#9a8f6e", letterSpacing: ".5px", marginBottom: 9 }}>ROUND INFO</div>
              <div className="flex items-center" style={{ gap: 18, height: "calc(100% - 28px)" }}>
                <div className="flex flex-col" style={{ gap: 6 }}>
                  <span className="font-press" style={{ fontSize: 8, color: "#9a8f6e", letterSpacing: ".5px" }}>PRIZE POOL</span>
                  <div className="font-press flex items-center" style={{ gap: 7, fontSize: 13, color: "#e08a12" }}>
                    <img src="/mantle-logo.png" alt="" style={{ width: 20, height: 20, imageRendering: "pixelated" }} />
                    25,000
                  </div>
                </div>
                <div className="flex flex-col" style={{ gap: 6 }}>
                  <span className="font-press" style={{ fontSize: 8, color: "#9a8f6e", letterSpacing: ".5px" }}>ROUND ENDS IN</span>
                  <span className="font-press" style={{ fontSize: 13, color: "#3a2e63" }}>⏱ {fmt(timer)}</span>
                </div>
              </div>
            </div>

            {/* Watch Live */}
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
            >
              <span>
                <span style={{
                  display: "inline-block", width: 9, height: 9, borderRadius: "50%",
                  background: "#ff4d4d", boxShadow: "0 0 8px #ff4d4d",
                  marginRight: 6, verticalAlign: "middle",
                  animation: "blink 1.1s steps(2) infinite",
                }} />
              </span>
              <span>WATCH</span>
              <span>LIVE</span>
            </button>

          </div>
        </div>
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
