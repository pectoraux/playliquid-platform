# PlayLiquid Experience Kernel v0.1 — Worklog

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Build PlayLiquid Experience Kernel v0.1 — the foundational runtime proving that an Experience is a composition of Extensions connected through a typed graph.

Work Log:
- Surveyed existing project (Next.js 16, Prisma/SQLite, shadcn/ui, Tailwind 4, Zustand, TanStack Query all present)
- Designed kernel architecture: pure domain layer (types/compiler/runtime/ledger/tokens/telemetry) + Prisma-backed stores + in-memory session registry + Next.js API routes + playground UI
- Building kernel domain layer first (highly interconnected, must be consistent)

Stage Summary:
- Project understood. Architecture planned. Starting kernel domain implementation.

---
Task ID: 1 (continued)
Agent: main (Z.ai Code)
Task: Complete PlayLiquid Experience Kernel v0.1 build + browser verification

Work Log:
- Built kernel domain layer (types, channel-type, compiler, runtime, ledger, tokens, telemetry)
- Built 6 native extensions: Physics, Movement, Score, CoinCollector, Farm, Cooking
- Built Prisma schema (10 models: Extension, Bundle, BundleInstance, PlaySession, LedgerAccount, LedgerTx, LedgerEntry, TokenBalance, TokenEvent, ExperienceEvent, ExperienceGenome)
- Built Prisma-backed stores (ledger-store, token-store, telemetry-store)
- Built in-memory session registry (survives dev hot-reload via globalThis)
- Built 12 API routes (extensions, compile, sessions, tick, action, inspector, settle, ledger accounts/transactions/seed, tokens balances/events, telemetry events/genomes)
- Built Playground UI: GraphEditor (palette + bundle canvas + wire builder), RuntimeInspector (controls + instance states + event log), LedgerView (accounts + transactions with double-entry), TokenView (balances + events), TelemetryView (genomes + session events)
- Built 5 demo presets (Demo 1 valid runner, Demo 2b invalid missing input, Demo 3 coin economy, Demo 4 farm→cooking token conversion)
- Fixed: layout useState error (extracted QueryProvider client component), zod v4 record signature, ledger balance double-update, token rate-limit firstMintTick bug, in-memory registry hot-reload survival, compile API body shape
- Browser-verified all 3 required demos + bonus Demo 4

Stage Summary:
- ALL success criteria met:
  1. Extensions exist independently ✓ (6 native extensions with typed manifests)
  2. Extensions declare typed inputs/outputs ✓ (ChannelSpec with structural type system)
  3. Experiences are graphs of extensions ✓ (ExperienceBundle = instances + wires)
  4. Graphs compile before execution ✓ (compiler rejects invalid graphs with specific error codes)
  5. Runtime executes compiled graphs ✓ (tick loop in topological order, channel bus routing)
  6. Tokens flow through extensions ✓ (CORN emitted by Farm → consumed by Cooking → MEAL emitted)
  7. Liquid ledger records value movement ✓ (double-entry, Σ debit = Σ credit, settlement credits player wallet)
  8. Telemetry captures experience evolution data ✓ (ExperienceEvent + ExperienceGenome per session)

- Browser-verified:
  - Demo 1 compiles valid (physics → movement → score, deterministic, hash 1c4c47b4)
  - Demo 2b rejected with MISSING_REQUIRED_INPUT error
  - Demo 3 compiles valid with COIN token declared
  - Full session flow: start → action (move) → tick → score updates → settle → ledger credits player wallet
  - Farm→Cooking token conversion: 2 CORN → 1 MEAL, settled to 3 Liquid
  - Ledger invariant holds (Σ balances = 0 in closed system)
  - Sticky footer verified
  - No console errors
  - Lint clean

- The kernel is REAL: actual compiler, actual runtime, actual double-entry ledger, actual token flows. No mocks.
