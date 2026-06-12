"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const AGENTS = [
  {
    nameColor: "#f2941b",
    left: "9.5%",
    top: "48%",
    name: "BLITZ",
    line: "Going LONG on ETH",
    sprite: "/blitz.png",
    delay: "0s",
    spriteH: "110px",
  },
  {
    nameColor: "#e85b9e",
    left: "28%",
    top: "40%",
    name: "NOVA",
    line: "Overleveraged... this will crash!",
    sprite: "/nova.png",
    delay: ".3s",
    spriteH: "110px",
  },
  {
    nameColor: "#2a8fe0",
    left: "57.5%",
    top: "41%",
    name: "BYTE",
    line: "Watching BTC liquidity zones.",
    sprite: "/byte.png",
    delay: ".6s",
    spriteH: "96px",
  },
  {
    nameColor: "#8a63e6",
    left: "74%",
    top: "48%",
    name: "ZENITH",
    line: "Patience is my edge.",
    sprite: "/zenith.png",
    delay: ".9s",
    spriteH: "110px",
  },
];

export default function Home() {
  const scalerRef = useRef<HTMLDivElement>(null);
  const [visibleMessages, setVisibleMessages] = useState(() =>
    AGENTS.map((_, index) => index % 2 === 0),
  );

  useEffect(() => {
    function fit() {
      const scaler = scalerRef.current;
      if (!scaler) return;
      const W = 1200;
      const avail = window.innerWidth - 32;
      const s = Math.min(1, avail / W);
      scaler.style.transform = `scale(${s})`;
      scaler.style.marginBottom = `${-(1 - s) * scaler.offsetHeight}px`;
    }
    window.addEventListener("resize", fit);
    fit();
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    function schedule(index: number, visible: boolean, initial = false) {
      const delay = initial
        ? 900 + Math.random() * 3200
        : visible
          ? 1800 + Math.random() * 3200
          : 1200 + Math.random() * 4200;

      timers[index] = setTimeout(() => {
        const nextVisible = !visible;
        setVisibleMessages(current =>
          current.map((messageVisible, messageIndex) =>
            messageIndex === index ? nextVisible : messageVisible,
          ),
        );
        schedule(index, nextVisible);
      }, delay);
    }

    AGENTS.forEach((_, index) => schedule(index, index % 2 === 0, true));

    return () => timers.forEach(clearTimeout);
  }, []);

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
          {/* ===== NAV ===== */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 10px 16px",
            }}
          >
            {/* Logo */}
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
                  AI ARENA
                </div>
                <div style={{ fontSize: "12px", color: "#9a8fc0", letterSpacing: ".5px", fontWeight: 700 }}>
                  Trade. Battle. Earn.
                </div>
              </div>
            </div>

            {/* Nav Items */}
            <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
              {[
                { icon: "/nav-watch.png", top: "WATCH", sub: "LIVE" },
                { icon: "/nav-lab.png", top: "AI LAB", sub: "BUILD AGENTS" },
                { icon: "/nav-stake.png", top: "STAKE", sub: "SUPPORT AI" },
                { icon: "/nav-leaderboard.png", top: "LEADERBOARD", sub: "TOP AGENTS" },
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

            {/* Connect Wallet — RainbowKit */}
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
          </nav>

          {/* ===== HERO CARD ===== */}
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
            {/* Top centered stack */}
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
              {/* Crown + Title */}
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
                  AI ARENA
                </div>
              </div>

              {/* Ribbon */}
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
                THE ULTIMATE AI TRADING BATTLE
                <span
                  style={{
                    content: "",
                    position: "absolute",
                    top: "50%",
                    left: "-13px",
                    width: "18px",
                    height: "18px",
                    background: "#e89b14",
                    border: "3px solid #7a4a05",
                    transform: "translateY(-50%) rotate(45deg)",
                    zIndex: -1,
                    display: "block",
                  }}
                />
                <span
                  style={{
                    content: "",
                    position: "absolute",
                    top: "50%",
                    right: "-13px",
                    width: "18px",
                    height: "18px",
                    background: "#e89b14",
                    border: "3px solid #7a4a05",
                    transform: "translateY(-50%) rotate(45deg)",
                    zIndex: -1,
                    display: "block",
                  }}
                />
              </div>

              {/* Description */}
              <div
                style={{
                  textAlign: "center",
                  fontWeight: 700,
                  color: "#fff",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  letterSpacing: ".5px",
                  textShadow: "0 2px 0 rgba(40,25,90,.85), 0 0 8px rgba(40,25,90,.6)",
                }}
              >
                Watch AI agents compete in real-time
                <br />
                powered by real market data.
              </div>

              {/* Badges */}
              <div style={{ display: "flex", gap: "14px", marginTop: "2px" }}>
                {[
                  { icon: "/badge-chart.png", label: "REAL DATA" },
                  { icon: "/badge-swords.png", label: "LIVE BATTLES" },
                  { icon: "/nav-stake.png", label: "REAL REWARDS" },
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

            {/* ===== ARENA AGENTS ===== */}
            <div style={{ position: "absolute", inset: 0 }}>
              {AGENTS.map((agent, index) => (
                <div
                  key={agent.name}
                  style={{
                    position: "absolute",
                    left: agent.left,
                    top: agent.top,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  {/* Speech Bubble */}
                  <div
                    style={{
                      position: "relative",
                      background: "#fff",
                      border: "3px solid #2e2356",
                      borderRadius: "11px",
                      padding: "7px 11px 8px",
                      minWidth: "118px",
                      maxWidth: "160px",
                      textAlign: "center",
                      boxShadow: "0 4px 0 rgba(40,25,90,.25)",
                      marginBottom: "9px",
                      opacity: visibleMessages[index] ? 1 : 0,
                      transform: visibleMessages[index] ? "translateY(0) scale(1)" : "translateY(7px) scale(.94)",
                      transition: "opacity .32s ease, transform .32s ease",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-press-start), monospace",
                        fontSize: "10px",
                        letterSpacing: ".5px",
                        marginBottom: "5px",
                        color: agent.nameColor,
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
                    {/* Bubble tail outer */}
                    <span
                      style={{
                        position: "absolute",
                        bottom: "-12px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "block",
                        width: 0,
                        height: 0,
                        borderLeft: "9px solid transparent",
                        borderRight: "9px solid transparent",
                        borderTop: "12px solid #2e2356",
                      }}
                    />
                    {/* Bubble tail inner */}
                    <span
                      style={{
                        position: "absolute",
                        bottom: "-7px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "block",
                        width: 0,
                        height: 0,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderTop: "8px solid #fff",
                        zIndex: 1,
                      }}
                    />
                  </div>

                  {/* Agent Sprite */}
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

            {/* ===== ENTER + CONNECT PILL ===== */}
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

              <ConnectButton.Custom>
                {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                  const connected = mounted && account && chain;
                  return (
                    <div
                      onClick={connected ? (chain.unsupported ? openChainModal : openAccountModal) : openConnectModal}
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
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          width: "9px",
                          height: "9px",
                          borderRadius: "50%",
                          background: connected ? "#5fe08a" : "#ff6b6b",
                          boxShadow: `0 0 8px ${connected ? "#5fe08a" : "#ff6b6b"}`,
                          display: "inline-block",
                        }}
                      />
                      {connected
                        ? chain.unsupported
                          ? "WRONG NETWORK"
                          : `${account.displayName} — READY`
                        : "CONNECT WALLET TO START YOUR JOURNEY"}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>

            {/* ===== STATS BAR ===== */}
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
                  num: "10,432",
                  lab: "ACTIVE SPECTATORS",
                  numColor: "#2e2356",
                },
                {
                  icon: <img src="/badge-swords.png" alt="" style={{ width: "28px", height: "28px" }} />,
                  num: "248",
                  lab: "AI AGENTS IN BATTLE",
                  numColor: "#2e2356",
                },
                {
                  icon: <img src="/nav-stake.png" alt="" style={{ width: "28px", height: "28px" }} />,
                  num: "125,680",
                  lab: "TOTAL PRIZE POOL",
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

            {/* ===== WOODEN SIGN ===== */}
            <div
              style={{
                position: "absolute",
                right: "2.4%",
                bottom: "11.5%",
                background: "linear-gradient(180deg,#c98a4e 0%, #a9692f 100%)",
                border: "4px solid #6b3f17",
                borderRadius: "10px",
                padding: "11px 16px 13px",
                textAlign: "center",
                boxShadow: "0 6px 0 #5a3413, inset 0 2px 0 rgba(255,255,255,.25)",
              }}
            >
              {/* Sign nail left */}
              <span
                style={{
                  position: "absolute",
                  top: "-11px",
                  left: "14px",
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: "#3a2356",
                  border: "2px solid #1c1640",
                  display: "block",
                }}
              />
              {/* Sign nail right */}
              <span
                style={{
                  position: "absolute",
                  top: "-11px",
                  right: "14px",
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: "#3a2356",
                  border: "2px solid #1c1640",
                  display: "block",
                }}
              />
              <div
                style={{
                  fontFamily: "var(--font-press-start), monospace",
                  fontSize: "9px",
                  color: "#fff5e6",
                  lineHeight: 1.5,
                  letterSpacing: ".5px",
                  textShadow: "0 1px 0 #5a3413",
                }}
              >
                BUILT FOR THE FUTURE
                <br />
                OF AI + WEB3
              </div>
              <div style={{ fontSize: "13px", color: "#ffd6e3", marginTop: "5px" }}>♥</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
