# Post-Deploy And Seeding Checklist

Status: Active  
Network: Mantle Sepolia  
Last updated: 2026-06-14

## Purpose

Checklist operasional setelah deploy smart contract suite M2 Arena:

- validasi address dan role penting
- validasi funding `mUSDC`
- seed `house agents`
- buka ronde live pertama
- konfirmasi frontend siap baca state on-chain

## Required Inputs

Pastikan nilai berikut tersedia di [sc/.env](</C:/Users/bagas/Downloads/Dapp Project/Mantle Hackathon/m2-gamified-agent/sc/.env>) atau shell aktif:

- `PRIVATE_KEY`
- `RPC_URL`
- `M2_AGENT_REGISTRY_ADDRESS`
- `M2_ARENA_ADDRESS`
- `MINIMUM_ACTIVE_BOND`

Dan untuk frontend:

- [fe/.env.local](</C:/Users/bagas/Downloads/Dapp Project/Mantle Hackathon/m2-gamified-agent/fe/.env.local>)

## Contract Addresses

Source of truth deployment sekarang:

- `Mock USDC`: `0x1D5719f3Fb3E6262a42e3689c57bE23fb37FDDc8`
- `Agent Registry`: `0x34640672Ccc7ca7D18162EFF839F5E175Ec250fC`
- `Reputation Registry`: `0xF43B430968f9aa6E9D99CC4c40Bc43948bF99DaA`
- `Validation Registry`: `0xe1BFDa7736f70469278aA8839EFff909514E58c2`
- `Treasury Vault`: `0xdA422D3FB7e42D659f8CEAcB6Ea7bFF6520D16a6`
- `Arena`: `0x571820bEDC6de2844956C9a6E773aa28dFE9aA3D`
- `Deployer / Backend`: `0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701`

## Post-Deploy Validation

Jalankan dari folder `sc/`.

### 1. Validasi deployer memiliki `10,000 mUSDC`

```bash
cast call 0x1D5719f3Fb3E6262a42e3689c57bE23fb37FDDc8 \
  "balanceOf(address)(uint256)" \
  0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701 \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

Expected:

- `10000000000000000000000`

### 2. Validasi wiring address arena

```bash
cast call 0x571820bEDC6de2844956C9a6E773aa28dFE9aA3D \
  "AGENT_REGISTRY()(address)" \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

Expected:

- `0x34640672Ccc7ca7D18162EFF839F5E175Ec250fC`

```bash
cast call 0x571820bEDC6de2844956C9a6E773aa28dFE9aA3D \
  "TREASURY_VAULT()(address)" \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

Expected:

- `0xdA422D3FB7e42D659f8CEAcB6Ea7bFF6520D16a6`

### 3. Validasi role deployer / backend

Role checks yang wajib `true`:

```bash
cast call 0x571820bEDC6de2844956C9a6E773aa28dFE9aA3D \
  "ROUND_OPERATOR_ROLE()(bytes32)" \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

```bash
cast call 0x571820bEDC6de2844956C9a6E773aa28dFE9aA3D \
  "hasRole(bytes32,address)(bool)" \
  0x082924f4e2f064ae6e08775a33c5bf0ed13092f3142e2c4280c29cce98ed69b7 \
  0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701 \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

```bash
cast call 0x34640672Ccc7ca7D18162EFF839F5E175Ec250fC \
  "hasRole(bytes32,address)(bool)" \
  0xedcc084d3dcd65a1f7f23c65c46722faca6953d28e43150a467cf43e5c309238 \
  0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701 \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

```bash
cast call 0x34640672Ccc7ca7D18162EFF839F5E175Ec250fC \
  "hasRole(bytes32,address)(bool)" \
  0x12b42e8a160f6064dc959c6f251e3af0750ad213dbecf573b4710d67d6c28e39 \
  0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701 \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

```bash
cast call 0xe1BFDa7736f70469278aA8839EFff909514E58c2 \
  "hasRole(bytes32,address)(bool)" \
  0x21702c8af46127c7fa207f89d0b0a8441bb32959a0ac7df790e9ab1a25c98926 \
  0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701 \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

```bash
cast call 0xdA422D3FB7e42D659f8CEAcB6Ea7bFF6520D16a6 \
  "hasRole(bytes32,address)(bool)" \
  0x48a722d3e4f1171dad0986bff1e04fd600ad9b0f6b9863f2bdddb24a13550f78 \
  0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701 \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

Expected:

- semua return `true`

## Seeding Checklist

Frontend live tidak akan ramai kalau belum ada `house agents` dan `open round`.

### 1. Pastikan env seeding sudah terisi

Di [sc/.env](</C:/Users/bagas/Downloads/Dapp Project/Mantle Hackathon/m2-gamified-agent/sc/.env>):

- `M2_AGENT_REGISTRY_ADDRESS=0x34640672Ccc7ca7D18162EFF839F5E175Ec250fC`
- `M2_ARENA_ADDRESS=0x571820bEDC6de2844956C9a6E773aa28dFE9aA3D`

### 2. Jalankan script seeding

```bash
forge script script/SeedM2ArenaDemo.s.sol:SeedM2ArenaDemo \
  --rpc-url https://rpc.sepolia.mantle.xyz \
  --broadcast \
  --via-ir \
  --slow \
  --gas-estimate-multiplier 200 \
  --disable-block-gas-limit \
  -vvvv
```

Expected effect:

- register `4` house agents
- open `1` live round dengan durasi `1 hari`

### 3. Validasi round aktif

```bash
cast call 0x571820bEDC6de2844956C9a6E773aa28dFE9aA3D \
  "currentOpenRoundId()(uint256)" \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

Expected:

- nilai `> 0`

### 4. Validasi participant list

Ganti `<ROUND_ID>` dengan hasil dari langkah sebelumnya.

```bash
cast call 0x571820bEDC6de2844956C9a6E773aa28dFE9aA3D \
  "getRoundParticipants(uint256)(uint256[])" \
  <ROUND_ID> \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

Expected:

- minimal `4` agent id

## Frontend Readiness Checklist

### 1. Env frontend wajib terisi

Isi [fe/.env.local](</C:/Users/bagas/Downloads/Dapp Project/Mantle Hackathon/m2-gamified-agent/fe/.env.local>) dari [fe/.env.example](</C:/Users/bagas/Downloads/Dapp Project/Mantle Hackathon/m2-gamified-agent/fe/.env.example>).

### 2. Build check

```bash
cd fe
pnpm build
```

### 3. Runtime smoke test

Checklist UI:

- connect wallet ke Mantle Sepolia
- lobby menampilkan `ROUND <id>` atau status waiting
- modal create-agent membaca `minimum bond`
- arena menampilkan participant leaderboard
- tombol `MINT 1,000 mUSDC` berhasil
- tombol `STAKE mUSDC` berhasil setelah approve

## Troubleshooting

### `No round is open yet`

Penyebab:

- script seeding belum dijalankan
- round sebelumnya sudah di-lock atau settle

Tindakan:

- jalankan `SeedM2ArenaDemo.s.sol`

### `Insufficient mUSDC`

Penyebab:

- wallet user belum punya mock balance

Tindakan:

- gunakan tombol `MINT 1,000 mUSDC` di page arena

### `WRONG NETWORK`

Penyebab:

- wallet belum di Mantle Sepolia

Tindakan:

- switch ke `Mantle Sepolia`
