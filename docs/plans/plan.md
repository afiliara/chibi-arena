# Master Plan

Status: Active
Last updated: 2026-06-14

## Current Focus

`SC live, backend operator live, FE wired to SC + BE live data, arena live preview refresh added, pending final demo polish`

## Global Order

1. Smart contract final
2. Frontend integration ke contract
3. Backend battle/reasoning mengikuti interface contract
4. Frontend polish

## Task Checklist

- [ ] Review dan approve design spec
- [ ] Review dan approve smart contract implementation plan
- [x] Finalkan strategi integrasi ERC-8004
- [x] Implement Phase A: registry foundation
- [x] Implement Phase B: round admission dan staking
- [x] Implement Phase C: settlement engine
- [x] Implement Phase D: claim system
- [x] Implement Phase E: hardening dan integration readiness
- [x] Integrasi FE ke ABI dan event contract
- [x] Review backend operator design spec
- [x] Implement backend round operator dan battle engine
- [x] Sinkronisasi FE live data
- [ ] Final FE polish untuk demo

## Notes

- Semua perubahan scope besar harus diperbarui di file ini dulu
- Task yang selesai akan ditandai/dihapus bertahap setelah milestone benar-benar kelar
- Final FE polish berjalan: arena live feed sudah memakai viewport scroll tetap dan leaderboard sekarang menampilkan viewport top 3 dengan scroll untuk ranking sisanya
- Final FE polish diperluas: arena sekarang mendukung deep-link round spesifik lewat `/arena/[roundId]`, sementara `/arena` otomatis resolve ke round open atau settled terbaru
