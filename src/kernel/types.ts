/**
 * PlayLiquid Experience Kernel — Core Types
 * ------------------------------------------
 * The primitive is the Extension. An Experience is a composition of Extensions
 * connected through a typed graph. These types define that contract.
 *
 * This module is pure TypeScript — no framework, no I/O. Everything else
 * (compiler, runtime, ledger, API, UI) is a client of these types.
 */

// ─── Channel Type System ───────────────────────────────────────────────────

/**
 * The channel type vocabulary. Primitives are the platform's built-in types;
 * records are structural shapes declared per extension.
 */
export type ChannelType =
  | { kind: 'primitive'; name: PrimitiveTypeName }
  | { kind: 'record'; fields: Record<string, ChannelType> }
  | { kind: 'enum'; variants: string[] }
  | { kind: 'token'; symbol: string };

export type PrimitiveTypeName =
  | 'Number'
  | 'String'
  | 'Boolean'
  | 'Vector2'
  | 'Entity'
  | 'Token'
  | 'Event';

/** Convenience constructors */
export const T = {
  Number: () => ({ kind: 'primitive', name: 'Number' }) as ChannelType,
  String: () => ({ kind: 'primitive', name: 'String' }) as ChannelType,
  Boolean: () => ({ kind: 'primitive', name: 'Boolean' }) as ChannelType,
  Vector2: () => ({ kind: 'primitive', name: 'Vector2' }) as ChannelType,
  Entity: () => ({ kind: 'primitive', name: 'Entity' }) as ChannelType,
  Token: () => ({ kind: 'primitive', name: 'Token' }) as ChannelType,
  Event: () => ({ kind: 'primitive', name: 'Event' }) as ChannelType,
  Record: (fields: Record<string, ChannelType>) =>
    ({ kind: 'record', fields }) as ChannelType,
  Enum: (variants: string[]) =>
    ({ kind: 'enum', variants }) as ChannelType,
  TokenOf: (symbol: string) =>
    ({ kind: 'token', symbol }) as ChannelType,
};

// ─── Channels ──────────────────────────────────────────────────────────────

export interface ChannelSpec {
  /** Channel name, unique within the extension's inputs or outputs */
  name: string;
  /** Type of values carried on this channel */
  type: ChannelType;
  /** Human-readable description */
  description?: string;
  /** If true, the input must be wired or the bundle fails to compile */
  required: boolean;
  /** single = one upstream emitter; multi = many, merged by declared strategy */
  cardinality: 'single' | 'multi';
  /** For multi inputs: how to merge multiple emitters' values into one */
  merge?: 'sum' | 'last-wins' | 'collect';
}

// ─── Extension Manifest ────────────────────────────────────────────────────

export type ExtensionCategory =
  | 'MECHANIC'
  | 'ECONOMY'
  | 'AI'
  | 'SOCIAL'
  | 'RENDER'
  | 'PHYSICS';

export type DeterminismMode = 'deterministic' | 'advisory' | 'none';

export type ExtensionKind =
  | 'native-dsl'
  | 'html5-bundle'
  | 'external-endpoint'
  | 'ai-agent';

export interface TokenDefinition {
  /** Symbol, e.g. "CORN" */
  symbol: string;
  /** Display name */
  name: string;
  /** Where the token lives */
  scope: 'session' | 'game' | 'user';
  /** Mint policy */
  mintPolicy:
    | { kind: 'fixed-cap'; cap: number }
    | { kind: 'unbounded-rate-limited'; perSecond: number }
    | { kind: 'unbounded' };
  /** If set, each token represents this many micro-Liquid; minting locks Liquid */
  liquidBackingMicro?: number;
  description?: string;
}

export interface ExtensionManifest {
  /** Stable identifier across versions */
  id: string;
  /** Semantic version */
  version: string;
  /** URL-friendly slug */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Author (creator handle or platform) */
  author: string;
  /** Category for marketplace + genome */
  category: ExtensionCategory;
  /** What this extension kind is */
  kind: ExtensionKind;
  /** Trust level */
  trustLevel: 'native' | 'html5' | 'external' | 'ai-advisory';
  /** Determinism classification */
  determinismMode: DeterminismMode;
  /** Typed inputs */
  inputs: ChannelSpec[];
  /** Typed outputs */
  outputs: ChannelSpec[];
  /** Tokens this extension owns (may emit) */
  tokenDefinitions?: TokenDefinition[];
  /** Tokens this extension may consume */
  consumesTokens?: string[];
  /** Permissions required */
  permissions: PermissionSet;
  /** Fork lineage */
  parentHash?: string;
  /** Capabilities */
  capabilities?: string[];
  /** Configuration schema — drives auto-generated forms in Studio */
  configSchema?: ConfigField[];
  /** Icon (emoji or URL) for Studio display */
  icon?: string;
  /** Marketplace tags for search */
  tags?: string[];
}

/** A single configurable field on an extension. Studio generates a form from this. */
export interface ConfigField {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  options?: string[];
  description?: string;
  unit?: string;
}

export interface PermissionSet {
  identity?: ('read-profile' | 'read-handle')[];
  wallet?: ('read-balance' | 'read-ledger')[];
  social?: ('read-followers' | 'post-creator-feed')[];
  ai?: ('call-generator' | 'call-iterator' | 'call-moderator')[];
  network?: ('platform-proxy' | 'none')[];
  storage?: ('session-state' | 'cloud-save')[];
}

// ─── Experience Graph ──────────────────────────────────────────────────────

export type ExperienceType = 'GAME' | 'SPARK';

/** A node in the graph: an instance of an extension */
export interface ExtensionInstanceSpec {
  /** Instance id, unique within the bundle */
  id: string;
  /** Reference to the extension (by id, resolved via registry) */
  extensionId: string;
  /** Optional config overrides */
  config?: Record<string, unknown>;
  /** Role within the bundle (for genome + visualization) */
  role?: 'core' | 'mechanic' | 'economy' | 'social' | 'ai-advisory' | 'render';
}

/** A directed edge: output of one instance feeds input of another */
export interface WireSpec {
  from: { instance: string; channel: string };
  to: { instance: string; channel: string };
}

/** A bundle = the composition (input to the compiler) */
export interface ExperienceBundle {
  type: ExperienceType;
  name?: string;
  instances: ExtensionInstanceSpec[];
  wires: WireSpec[];
}

// ─── Compiler Output ───────────────────────────────────────────────────────

export interface CompiledGraph {
  valid: boolean;
  errors: CompileError[];
  /** Topologically sorted instance ids */
  executionOrder: string[];
  /** Per-instance resolved manifest */
  instances: Record<string, { spec: ExtensionInstanceSpec; manifest: ExtensionManifest }>;
  /** Resolved wires, indexed by target input */
  inputSources: Record<string, Record<string, WireSpec[]>>;
  /** Determinism partition */
  deterministic: boolean;
  /** Tokens declared by any instance in the graph */
  declaredTokens: TokenDefinition[];
  /** Compile fingerprint */
  contentHash?: string;
}

export interface CompileError {
  code: string;
  message: string;
  path?: string;
}

// ─── Runtime ───────────────────────────────────────────────────────────────

export type SessionMode = 'PREVIEW' | 'EARN';
export type SessionStatus = 'ACTIVE' | 'ENDED' | 'SUSPENDED';

export interface SessionContext {
  sessionId: string;
  experienceId: string;
  mode: SessionMode;
  /** Server-issued for EARN; random for PREVIEW */
  seed: string;
  /** Anonymous preview allowed */
  userId?: string;
  startedAt: number;
}

/** A single channel message emitted during a tick */
export interface ChannelMessage {
  instance: string;
  channel: string;
  value: unknown;
  tick: number;
}

/** A runtime event: state change, channel emission, token op, log */
export type RuntimeEvent =
  | { kind: 'tick'; tick: number; ts: number }
  | { kind: 'state'; instance: string; state: unknown; tick: number; ts: number }
  | { kind: 'channel'; message: ChannelMessage; ts: number }
  | { kind: 'token-emit'; instance: string; symbol: string; amount: number; reason?: string; tick: number; ts: number }
  | { kind: 'token-consume'; instance: string; symbol: string; amount: number; reason?: string; tick: number; ts: number }
  | { kind: 'log'; instance: string; message: string; data?: unknown; tick: number; ts: number }
  | { kind: 'action'; action: string; payload?: unknown; tick: number; ts: number }
  | { kind: 'session-end'; reason: string; tick: number; ts: number };

/** Inspector snapshot of a running session */
export interface InspectorSnapshot {
  sessionId: string;
  tick: number;
  status: SessionStatus;
  instances: Array<{
    id: string;
    extensionId: string;
    name: string;
    category: ExtensionCategory;
    state: unknown;
    lastEvents: RuntimeEvent[];
  }>;
  tokenBalances: Record<string, number>;
  recentEvents: RuntimeEvent[];
  executionOrder: string[];
  score?: number;
}

// ─── Ledger ────────────────────────────────────────────────────────────────

export interface LedgerAccount {
  id: string;
  kind: string;
  balance: number; // in micro-Liquid
  createdAt: number;
}

export interface LedgerEntryInput {
  txId: string;
  account: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface LedgerEntry extends LedgerEntryInput {
  id: string;
  lineNo: number;
  createdAt: number;
}

export interface LedgerTransaction {
  id: string;
  memo?: string;
  createdAt: number;
  entries: LedgerEntry[];
  sumDebit: number;
  sumCredit: number;
  balanced: boolean;
}

// ─── Tokens ────────────────────────────────────────────────────────────────

export interface TokenAccount {
  sessionId: string;
  symbol: string;
  balance: number;
  scope: 'session' | 'game' | 'user';
}

export type TokenEventKind = 'EMIT' | 'CONSUME' | 'SETTLE' | 'REJECT';

export interface TokenEvent {
  id: string;
  sessionId: string;
  kind: TokenEventKind;
  symbol: string;
  amount: number;
  instance?: string;
  reason?: string;
  tick?: number;
  createdAt: number;
}

// ─── Telemetry / Genome ────────────────────────────────────────────────────

export interface ExperienceEvent {
  id: string;
  experienceId: string;
  sessionId: string;
  bundleHash?: string;
  tickCount: number;
  sessionDurationMs: number;
  actions: number;
  completion: boolean;
  score?: number;
  tokensEmitted: Record<string, number>;
  tokensConsumed: Record<string, number>;
  extensions: string[];
  createdAt: number;
}

export interface ExperienceGenome {
  experienceId: string;
  bundleHash?: string;
  extensions: string[];
  categories: Record<ExtensionCategory, number>;
  mechanics: string[];
  compositionDepth: number;
  hasEconomy: boolean;
  hasAI: boolean;
  tokenCount: number;
  computedAt: number;
  // ── Genome v2 scores (0-100) ──────────────────────────────────────────
  complexityScore: number;
  noveltyScore: number;
  economyScore: number;
  socialScore: number;
  emotionScore: number;
  retentionPrediction: number;
  // ── DNA arrays (ordered fingerprints) ─────────────────────────────────
  extensionDNA: string[];
  tokenDNA: string[];
  interactionDNA: string[];
}

// ─── World Engine Types ────────────────────────────────────────────────────

/** A player's evolving identity, built from their play history */
export interface PlayerGenome {
  favoriteGenres: ExperienceKind[];
  emotionPreferences: ExperienceEmotion[];
  playedExtensions: string[];
  completionRate: number;
  averageSessionLength: number;
  skillLevel: number;      // 0-100, derived from scores + completion
  socialBehavior: 'solo' | 'social' | 'competitive';
  creatorAffinity: string[]; // creator IDs they play most
}

export interface PlayerIdentity {
  userId: string;
  displayName: string;
  playerGenome: PlayerGenome;
  creatorScore: number;
  playerScore: number;
  collaborationScore: number;
  trustScore: number;
  achievements: string[];
  sessionCount: number;
  createdAt: number;
}

/** Aggregated metrics for an experience across all sessions */
export interface ExperienceMetricsAggregate {
  experienceId: string;
  totalSessions: number;
  totalPlayTimeMs: number;
  completionRate: number;
  averageScore: number;
  averageDropOffMs: number;
  retention1d: number;
  retention7d: number;
  frustrationEvents: number;
  achievementEvents: number;
  surpriseEvents: number;
  socialMoments: number;
  tokensEarned: number;
  tokensSpent: number;
  marketActions: number;
  forks: number;
  shares: number;
}

/** A single recommendation from the Discovery Engine */
export interface ExperienceRecommendation {
  experienceId: string;
  title: string;
  score: number;          // 0-100
  reasons: string[];      // why this was recommended
  predictedEnjoyment: number; // 0-100
}

/** A royalty share in the fork lineage graph */
export interface RoyaltyShare {
  creatorId: string;
  creatorName: string;
  shareBps: number;       // basis points (10000 = 100%)
  role: 'original' | 'fork' | 'extension' | 'platform' | 'ai';
}

/** AI-generated proposal to evolve an experience */
export interface EvolutionProposalData {
  id: string;
  experienceId: string;
  analysis: {
    patterns: string[];
    dropOffPoint?: string;
    bottlenecks: string[];
    strengths: string[];
  };
  proposedChanges: {
    summary: string;
    changes: Array<{ instance: string; config: Record<string, unknown>; reason: string }>;
  };
  predictedLift: number;
  newBundle?: ExperienceBundle;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';
  createdAt: number;
}

/** A simulated player for the Experience Lab */
export interface SimulatedPlayer {
  userId: string;
  displayName: string;
  profile: PlayerGenome;
  actionsPerSession: number;
  preferredTickRate: number;
}

// ─── Civilization Engine Types (v0.3) ──────────────────────────────────────

/** A persistent world activated from a published experience */
export interface World {
  id: string;
  name: string;
  description: string;
  experienceId: string;
  creatorId: string;
  status: 'DORMANT' | 'ACTIVE' | 'PAUSED' | 'ENDED';
  tickCount: number;
  population: number;
  worldGenome: WorldGenome;
  macroState: WorldMacroState;
  createdAt: number;
  lastTickAt?: number;
}

/** Genome of a world — derived from the experience genome + simulation state */
export interface WorldGenome {
  complexity: number;
  economyDepth: number;
  socialDensity: number;
  agentDiversity: number;
  resourceVariety: number;
  eventFrequency: number;
}

/** Macro-level world state (fast to update, doesn't require full runtime) */
export interface WorldMacroState {
  resources: Record<string, number>;      // resource type → total supply
  prices: Record<string, number>;         // resource type → current price
  population: number;
  averageWealth: number;
  giniCoefficient: number;                // wealth inequality (0=equality, 1=inequality)
  mood: number;                           // -100 (crisis) to +100 (boom)
  activeEvents: string[];
}

/** An entity living inside a world */
export type EntityType = 'CITIZEN' | 'MERCHANT' | 'BUILDER' | 'EXPLORER' | 'COMPETITOR' | 'ORGANIZATION' | 'RESOURCE_NODE' | 'PLAYER';

export interface WorldEntity {
  id: string;
  worldId: string;
  name: string;
  type: EntityType;
  agentGenome?: AgentGenome;
  wealth: number;                         // in micro-Liquid
  resources: Record<string, number>;      // resource holdings
  reputation: number;                     // -100 to +100
  relationships: Record<string, number>;  // entityId → relationship score (-100 to +100)
  memory: AgentMemory[];
  lastDecisionTick: number;
  alive: boolean;
  createdAt: number;
}

/** The personality + capabilities of an autonomous agent */
export interface AgentGenome {
  personality: {
    riskTolerance: number;                // 0-100
    sociability: number;                  // 0-100
    ambition: number;                     // 0-100
    creativity: number;                   // 0-100
  };
  goals: string[];
  skills: Record<string, number>;         // skill name → level (0-100)
  role: EntityType;
  decisionStyle: 'greedy' | 'strategic' | 'social' | 'creative';
}

/** An agent's memory of past events */
export interface AgentMemory {
  tick: number;
  event: string;
  impact: number;                         // -100 to +100 (how it affected the agent)
  learning: string;                       // what the agent learned
}

/** A relationship between two entities */
export interface Relationship {
  id: string;
  worldId: string;
  fromEntityId: string;
  toEntityId: string;
  type: 'owns' | 'trades' | 'competes' | 'collaborates' | 'trusts' | 'fears' | 'allied' | 'rival';
  strength: number;                       // 0-100
  createdAt: number;
}

/** An emergent event generated from world state */
export interface WorldEvent {
  id: string;
  worldId: string;
  name: string;
  description: string;
  type: 'economic' | 'social' | 'environmental' | 'competitive' | 'crisis' | 'discovery';
  tick: number;
  effects: {
    resourceChanges: Record<string, number>;
    priceChanges: Record<string, number>;
    moodChange: number;
    affectedEntities: string[];
  };
  rewards?: Record<string, number>;       // entityId → liquid reward (micro)
  storyText: string;                      // narrative for the history log
}

/** An ownable asset in the world economy */
export interface Asset {
  id: string;
  worldId: string;
  name: string;
  type: 'land' | 'building' | 'business' | 'item' | 'infrastructure';
  ownerId?: string;                       // entity ID that owns it
  purchasePrice: number;                  // micro-Liquid
  generationRate: Record<string, number>; // resource → amount per tick
  forSale: boolean;
  askingPrice?: number;
  createdAt: number;
}

/** A recorded world tick with state snapshot */
export interface WorldTickRecord {
  id: string;
  worldId: string;
  tick: number;
  stateSnapshot: WorldMacroState;
  eventsThisTick: string[];
  decisionsThisTick: number;
  timestamp: number;
}

/** A historical entry in the world's chronicle */
export interface WorldHistoryEntry {
  id: string;
  worldId: string;
  tick: number;
  type: 'founding' | 'event' | 'milestone' | 'crisis' | 'discovery' | 'social' | 'economic';
  title: string;
  narrative: string;
  timestamp: number;
}

// ─── Studio Domain Types ───────────────────────────────────────────────────

export type ExperienceKind = 'GAME' | 'SPARK' | 'SIMULATION' | 'CHALLENGE' | 'LEARNING';
export type ExperienceEmotion = 'competition' | 'discovery' | 'creativity' | 'mastery' | 'relaxation' | 'social' | 'strategy';

/** Creator intent captured by the wizard — becomes part of the genome */
export interface ExperienceIntent {
  kind: ExperienceKind;
  emotions: ExperienceEmotion[];
  goals: string[];
  audience: string;
  description: string;
}

/** A published experience (persisted in DB) */
export interface PublishedExperience {
  id: string;
  slug: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  bundleHash: string;
  parentExperienceId?: string;  // fork lineage
  intent: ExperienceIntent;
  genome: ExperienceGenome;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  playCount: number;
  forkCount: number;
  likeCount: number;
  createdAt: number;
  publishedAt?: number;
}
