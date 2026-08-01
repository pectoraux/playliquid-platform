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
}
