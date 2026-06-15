# ⚙️ Chibi Arena Backend: Operator Service & LLM Agent Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript%205.8-blue.svg)](https://www.typescriptlang.org/)
[![Server: Express](https://img.shields.io/badge/Server-Express%205.0-lightgrey.svg)](https://expressjs.com/)
[![Web3: Viem](https://img.shields.io/badge/Web3-Viem%202.x-blueviolet.svg)](https://viem.sh/)
[![Feeds: Pyth](https://img.shields.io/badge/Oracles-Pyth%20Network-violet.svg)](https://pyth.network/)

The **Chibi Arena Backend** is the automation hub, operator node, and simulated AI agent execution engine for the **Chibi Arena**. Built with **Express**, **TypeScript**, and **Viem**, this service acts as the bridge between off-chain LLM decision-making and on-chain smart contract state transitions.

The backend periodically polls the Mantle Sepolia network to drive round states forward, queries Pyth price feeds for market context, invokes OpenRouter LLM APIs to simulate agent trading behavior, and submits final PnL calculations on-chain.

---

## 🔑 Core Services

The backend features a clean, service-oriented structure located in [src/services/](file:///C:/Users/bagas/Downloads/Dapp%20Project/Mantle%20Hackathon/m2-gamified-agent/be/src/services):

1. **`SchedulerService` (`scheduler.ts`)**
   The heart of the operator. It automates round lifecycles by polling the blockchain. It determines when to:
   *   Transition from `OPEN` to `LOCKED` (staking close).
   *   Start agent decision simulation (trading phase).
   *   Settle rounds on-chain (`settleRound()`) with calculated PnLs.
2. **`BattleEngine` (`battle-engine.ts`)**
   Simulates trading rounds. It dynamically fetches active agents, aggregates their personalities/styles, constructs system prompts with market states, and queries OpenRouter models. The LLMs output structured trade forecasts (long/short/hold predictions).
3. **`ChainService` (`chain-service.ts`)**
   Interfaces with Mantle Sepolia. Encapsulates all read operations (fetching current round data, registered agents, profile metadata) and write operations (submitting operator ticks, locking rounds, and executing on-chain settlements using the Operator Private Key).
4. **`MarketService` (`market-service.ts`)**
   Interfaces with Pyth Network's Hermes API to fetch real-time price feed updates for key trading assets (BTC, ETH, SOL) to feed to the trading agents.
5. **`RuntimeStore` (`runtime-store.ts`)**
   Manages lightweight, file-based persistence for storing simulated agent decisions and temporary round parameters.

---

## 🔌 API Endpoints

The server exposes several API endpoints for frontend telemetry and administrative controls under [src/index.ts](file:///C:/Users/bagas/Downloads/Dapp%20Project/Mantle%20Hackathon/m2-gamified-agent/be/src/index.ts):

### Public Telemetry
*   `GET /health`: Returns service health status, network chain ID, and scheduler configurations.
*   `GET /status`: Retrieves current execution state snapshot.
*   `GET /round/current`: Retrieves details of the currently active round.
*   `GET /round/:roundId/result`: Retrieves the final settlement and enriched participant profiles for a completed round.
*   `GET /overview`: Combined dashboard endpoint returns live Pyth prices, current round statistics, and the latest settled results.

### Operator Controls (Admin)
*   `POST /operator/tick`: Forces an immediate scheduler cycle evaluation.
*   `POST /operator/run-current-round`: Manages LLM simulation and generates decisions for the current active round.
*   `POST /operator/settle-current-round`: Forces settlement of the current round on-chain.

---

## 🛠️ Installation & Setup

### Prerequisites
*   Node.js (v18.x or later)
*   PNPM (v9.x or later)

### 1. Configure Environment Variables
Copy `.env.example` to `.env` and fill in the necessary variables:
```bash
cp .env.example .env
```

Key configuration parameters:
*   `PORT`: Port to run the server on (default: `4000`).
*   `MANTLE_RPC_URL`: RPC endpoint (default: `https://rpc.sepolia.mantle.xyz`).
*   `OPERATOR_PRIVATE_KEY`: Private key of the wallet authorized with `ROUND_OPERATOR_ROLE` on the Arena contract.
*   `M2_ARENA_ADDRESS` & `M2_AGENT_REGISTRY_ADDRESS`: Contract addresses deployed on Mantle Sepolia.
*   `OPENROUTER_API_KEY`: API key to execute AI agent prompts.
*   `OPENROUTER_MODEL`: LLM to run simulations (e.g., `google/gemini-2.5-flash`).

---

## 📄 License

This backend operator code is licensed under the **MIT License**. See the main repository license for details.
