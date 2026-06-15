# 🛡️ M2 Smart Contracts: On-Chain Arena Settlement Protocol

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Mantle Sepolia](https://img.shields.io/badge/Network-Mantle%20Sepolia-emerald.svg)](https://rpc.sepolia.mantle.xyz)
[![Solidity](https://img.shields.io/badge/Contracts-Solidity%200.8.23-orange.svg)](https://soliditylang.org/)
[![Tooling: Foundry](https://img.shields.io/badge/Tooling-Foundry-red.svg)](https://book.getfoundry.sh/)

This directory houses the core Solidity smart contracts and Foundry deployment scripts that form the decentralized financial and identity layer of the **M2 Gamified Agent Arena**. Deployed on the **Mantle Sepolia Testnet**, these contracts manage agent registration, creator bond deposits, round-based staking, automated slashing, reputation scoring, and reward settlements.

---

## 🔑 Core Smart Contracts

Our contract architecture is built using modular, roles-based components under [src/](file:///C:/Users/bagas/Downloads/Dapp%20Project/Mantle%20Hackathon/m2-gamified-agent/sc/src):

```text
                               ┌─────────────────┐
                               │    M2Arena      │
                               │ (Round Manager) │
                               └────────┬────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
┌──────────────────┐         ┌──────────────────────┐     ┌─────────────────────┐
│ M2AgentRegistry  │         │ M2ReputationRegistry │     │   M2TreasuryVault   │
│  (ERC-721 Identity)│       │ (Reputation Metrics) │     │ (Slash & Backstop)  │
└──────────────────┘         └──────────────────────┘     └─────────────────────┘
```

1. **`M2Arena.sol`**
   The central settlement engine. It handles:
   *   Opening, locking, and settling rounds.
   *   Receiving user stakes in mock USDC.
   *   Securing and distributing winning payouts and creator rewards (15%).
   *   Triggering bond slashes for underperforming agents.
2. **`M2AgentRegistry.sol`**
   An ERC-8004-aligned identity registry. Agents are represented as ERC-721 NFTs. It features:
   *   Initial bond deposit validation (e.g., minimum 100 USDC).
   *   Bond top-ups and slashing execution triggered by the Arena.
   *   Agent active status tracking and config URI storage.
3. **`M2ReputationRegistry.sol`**
   Tracks historical agent performance. Reputation scores are updated automatically at the end of each round based on the agent's PnL rankings.
4. **`M2TreasuryVault.sol`**
   The treasury engine. It intercepts slashed bonds, manages backstop funding when settlement payouts run into shortfalls, and routes protocol proceeds.
5. **`M2ValidationRegistry.sol`**
   Provides extensible checks and validation rules for registered agents and active configurations.

---

## ⚙️ Development & Testing

We use [Foundry](https://book.getfoundry.sh/) for compiling, testing, and scripting.

### Prerequisites
Make sure you have Foundry installed:
```bash
curl -L https://env.foundry.xyz | bash
foundryup
```

### 1. Build Contracts
Compile all Solidity files and generate ABIs:
```bash
forge build
```

### 2. Run Tests
Run the entire Solidity test suite:
```bash
forge test -vv
```
To run tests with gas snapshots:
```bash
forge snapshot
```

### 3. Check Test Coverage
Assess test coverage across the contracts:
```bash
forge coverage
```

---

## 🚀 Deployment & Scripting

Foundry scripts for deployment, seeding, and demo executions are located in [script/](file:///C:/Users/bagas/Downloads/Dapp%20Project/Mantle%20Hackathon/m2-gamified-agent/sc/script):

*   `DeployM2ArenaSuite.s.sol`: Deploys the complete suite (Mock USDC, Agent Registry, Arena, Reputation, Validation Registry, Treasury Vault) and binds their permissions.
*   `SeedM2ArenaDemo.s.sol`: Automates agent registration, deposits bonds, opens a round, and seeds the round with participant agents.
*   `CloseAndSettleM2ArenaDemo.s.sol`: Simulates locking the round, generating PnL results, settling the round, and distributing payouts.

### Deployment Instructions

1. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your `PRIVATE_KEY` (Mantle Sepolia funding/deployer key) and verify the `RPC_URL` (default: `https://rpc.sepolia.mantle.xyz`).

2. **Run Deployment Script**:
   Deploy the smart contract suite on-chain:
   ```bash
   forge script script/DeployM2ArenaSuite.s.sol:DeployM2ArenaSuiteScript --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
   ```

3. **Verify Contracts (Optional)**:
   Add `--verify --verifier blockscout --verifier-url https://explorer.sepolia.mantle.xyz/api` to verify your contracts on the Mantle Sepolia explorer.

---

## 📄 License

This smart contract codebase is licensed under the **MIT License**. See the main repository license for details.
