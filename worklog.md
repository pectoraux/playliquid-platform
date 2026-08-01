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

---
Task ID: 2
Agent: main (Z.ai Code)
Task: Build PlayLiquid Studio v0.1 — the Experience Composer (creator layer on top of the kernel)

Work Log:
- Enriched 6 existing extensions with ConfigSchema, icon, tags
- Added 3 new extensions: Weather (PHYSICS), Marketplace (ECONOMY, mints GOLD), Competition (SOCIAL, leaderboard)
- Added Studio domain types to kernel: ExperienceKind, ExperienceEmotion, ExperienceIntent, PublishedExperience, ConfigField
- Added Prisma models: CreatorRecord, ExperienceRecord (with fork lineage)
- Built Studio data layer: studio-service.ts (drafts, publish, fork, creator profile), ai-composer.ts (LLM-powered), suggestion-utils.ts (pure converter)
- Built AI Experience Composer using z-ai-web-dev-sdk: takes natural language + intent → suggests extension graph with reasoning, instances, wires, token flow
- Split ai-composer into server-only (SDK) + client-safe (types, converter) to avoid SSR import issues
- Built 8 Studio API routes: drafts CRUD, experiences list/get, publish, fork, bundle, AI compose, creator profile
- Built Studio Zustand store with React Flow node/edge state + wizard state + compile result
- Built Studio UI components:
  - StudioHome (landing with hero, stats, how-it-works, recent experiences)
  - CreationWizard (4-step: type → emotions → describe → AI suggestion)
  - ExtensionLibrary (searchable, categorized extension palette)
  - GraphEditor (React Flow with custom extension nodes, typed handles, drag-connect wires)
  - ConfigInspector (auto-generates forms from ConfigSchema: sliders, selects, inputs)
  - RuntimePreview (live session state, token balances, event log)
  - ExperiencesView (discover + fork published experiences)
  - CreatorProfile (stats: experiences, forks, liquid earned, player hours)
  - StudioEditor (3-panel layout: library | canvas | inspector+preview)
  - Playground (kernel dev tools from v0.1, accessible via "Kernel" button)
- Built Farm Kingdom demo bundle (Weather → Farm → Cooking → Marketplace → Competition)
- Restructured page.tsx with view-based routing (home/wizard/editor/experiences/creator/kernel-dev)

Browser Verification:
- Studio Home renders with 9 extensions, 0 experiences → created Farm Kingdom → 1 experience
- Farm Kingdom loads into editor with 5 extension nodes visible in React Flow graph
- Compile succeeds: "valid, weather → farm → cooking → marketplace → competition, deterministic, tokens: CORN, MEAL, GOLD"
- Play Test starts session, ticking shows economy flow: CORN produced → MEAL cooked → GOLD traded → score=55
- Publish works: Farm Kingdom appears on Discover Experiences page
- AI Composer tested: "farming game with competition" → AI suggested 5 extensions (Physics, Farm, Cooking, Marketplace, Competition) with correct token flow "CORN → MEAL → GOLD → leaderboard"
- AI-composed graph loads into editor and compiles valid
- Fork tested: Forked Farm Kingdom → new draft "Farm Kingdom (Fork)" with 6 nodes, same graph
- Creator Profile shows: 1 Experience, 0 Forks, correct stats
- Kernel Developer Playground accessible via "Kernel" button
- Sticky footer verified (sticks: true)
- No console errors, lint clean

Stage Summary:
- ALL success criteria met:
  1. Non-programmer can create an Experience ✓ (wizard → AI compose → editor → publish)
  2. Extensions discovered visually ✓ (ExtensionLibrary with search + categories)
  3. Graphs composed visually ✓ (React Flow drag-and-drop with typed handles)
  4. AI suggests graphs ✓ (LLM-powered composer with natural language → extension graph)
  5. Graphs compile through existing kernel ✓ (same /api/kernel/compile endpoint)
  6. Experiences tested ✓ (Play Test with live runtime preview)
  7. Experiences forked ✓ (fork creates draft with parentExperienceId)
  8. Genome metadata generated ✓ (auto-computed at publish, stored in genomeJson)

- Farm Kingdom demo fully functional end-to-end: load → compile → play → see economy flow → publish → fork
