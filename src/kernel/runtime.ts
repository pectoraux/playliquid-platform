/**
 * Experience Runtime Engine
 * ---------------------------
 * Executes a compiled graph tick-by-tick. Pure logic: given a compiled graph
 * and an action stream, produces a deterministic sequence of runtime events.
 *
 * The runtime is the universal execution layer. It does not know whether an
 * extension is AI-generated, hand-written, or externally hosted — it only
 * knows the ExtensionInstance contract.
 */

import type {
  CompiledGraph,
  ExtensionManifest,
  RuntimeEvent,
  SessionContext,
  InspectorSnapshot,
  TokenDefinition,
} from './types';

// ─── Extension Instance Contract ───────────────────────────────────────────

export interface UpdateContext {
  tick: number;
  /** Merged input values for this tick, keyed by channel name */
  inputs: Record<string, unknown>;
  /** All raw input values (for multi-cardinality channels) */
  rawInputs: Record<string, unknown[]>;
  /** Current state (mutate via setState) */
  state: unknown;
  /** Replace state */
  setState: (next: unknown) => void;
  /** Emit a value on an output channel */
  emit: (channel: string, value: unknown) => void;
  /** Emit a token (records a TokenEvent; updates balance) */
  emitToken: (symbol: string, amount: number, reason?: string) => void;
  /** Consume a token (fails if insufficient balance) */
  consumeToken: (symbol: string, amount: number, reason?: string) => void;
  /** Read a token balance */
  tokenBalance: (symbol: string) => number;
  /** Read the seed (for deterministic RNG) */
  seed: string;
  /** Append a log line */
  log: (message: string, data?: unknown) => void;
  /** End the session */
  endSession: (reason: string) => void;
}

export interface ExtensionInstance {
  instanceId: string;
  manifest: ExtensionManifest;
  state: unknown;
  /** Called once per tick. Mutates state via ctx.setState and emits via ctx.emit. */
  update: (ctx: UpdateContext) => void;
}

export type ExtensionFactory = (
  instanceId: string,
  config: Record<string, unknown> | undefined,
) => ExtensionInstance;

// ─── Runtime ───────────────────────────────────────────────────────────────

export interface RuntimeSession {
  context: SessionContext;
  graph: CompiledGraph;
  instances: Map<string, ExtensionInstance>;
  /** Per-tick output buffers: instance -> channel -> values[] */
  outputBuffers: Map<string, Map<string, unknown[]>>;
  /** Per-tick input buffers: instance -> channel -> values[] */
  inputBuffers: Map<string, Map<string, unknown[]>>;
  /** Token balances: symbol -> amount */
  tokenBalances: Map<string, number>;
  /** Pending token operations to flush */
  tokenOps: RuntimeEvent[];
  tick: number;
  status: 'ACTIVE' | 'ENDED' | 'SUSPENDED';
  events: RuntimeEvent[];
  /** Score (extracted from any extension that exposes `score` in state) */
  score: number;
  /** Count of user actions received */
  actionCount: number;
  /** Last update timestamp */
  lastTickAt: number;
}

export interface RuntimeHooks {
  /** Called when a token is emitted — lets the platform record it */
  onTokenEmit?: (sessionId: string, symbol: string, amount: number, instance?: string, tick?: number) => void;
  onTokenConsume?: (sessionId: string, symbol: string, amount: number, instance?: string, tick?: number) => void;
  onTokenReject?: (sessionId: string, symbol: string, amount: number, reason: string) => void;
  onEvent?: (sessionId: string, event: RuntimeEvent) => void;
}

/**
 * Create a new runtime session from a compiled graph.
 * The factories map tells the runtime how to instantiate each extension.
 */
export function createSession(
  context: SessionContext,
  graph: CompiledGraph,
  factories: Record<string, ExtensionFactory>,
  hooks: RuntimeHooks = {},
): RuntimeSession {
  if (!graph.valid) {
    throw new Error('Cannot create session from invalid graph');
  }

  const instances = new Map<string, ExtensionInstance>();
  for (const id of graph.executionOrder) {
    const { spec, manifest } = graph.instances[id];
    const factory = factories[manifest.id];
    if (!factory) {
      throw new Error(`No factory registered for extension "${manifest.id}"`);
    }
    const inst = factory(id, spec.config);
    instances.set(id, inst);
  }

  const session: RuntimeSession = {
    context,
    graph,
    instances,
    outputBuffers: new Map(),
    inputBuffers: new Map(),
    tokenBalances: new Map(),
    tokenOps: [],
    tick: 0,
    status: 'ACTIVE',
    events: [],
    score: 0,
    actionCount: 0,
    lastTickAt: Date.now(),
  };

  // Initialize token balances for all declared tokens
  for (const t of graph.declaredTokens) {
    session.tokenBalances.set(t.symbol, 0);
  }

  // Record session start
  pushEvent(session, { kind: 'log', instance: '$runtime', message: 'session started', data: { mode: context.mode, seed: context.seed }, tick: 0, ts: Date.now() }, hooks);

  return session;
}

/**
 * Advance the session by one tick.
 */
export function tickSession(session: RuntimeSession, hooks: RuntimeHooks = {}): RuntimeSession {
  if (session.status !== 'ACTIVE') return session;

  session.tick += 1;
  const tick = session.tick;
  session.lastTickAt = Date.now();

  pushEvent(session, { kind: 'tick', tick, ts: session.lastTickAt }, hooks);

  // Clear per-tick buffers
  session.outputBuffers.clear();
  session.inputBuffers.clear();
  session.tokenOps = [];

  // Execute each instance in topological order
  for (const id of session.graph.executionOrder) {
    const inst = session.instances.get(id);
    if (!inst) continue;

    // Gather inputs from upstream outputs (already computed this tick)
    const inputs: Record<string, unknown> = {};
    const rawInputs: Record<string, unknown[]> = {};
    const sources = session.graph.inputSources[id] ?? {};

    for (const inputSpec of inst.manifest.inputs) {
      const wires = sources[inputSpec.name] ?? [];
      const values: unknown[] = [];
      for (const w of wires) {
        const buf = session.outputBuffers.get(w.from.instance);
        const vals = buf?.get(w.from.channel) ?? [];
        values.push(...vals);
      }
      rawInputs[inputSpec.name] = values;

      // Merge per cardinality
      if (values.length === 0) {
        continue;
      }
      if (inputSpec.cardinality === 'single') {
        inputs[inputSpec.name] = values[values.length - 1];
      } else {
        const merge = inputSpec.merge ?? 'collect';
        if (merge === 'sum') {
          inputs[inputSpec.name] = (values as number[]).reduce((a, b) => (a as number) + (b as number), 0);
        } else if (merge === 'last-wins') {
          inputs[inputSpec.name] = values[values.length - 1];
        } else {
          inputs[inputSpec.name] = values;
        }
      }
    }

    // Output buffer for this instance
    const outBuf = new Map<string, unknown[]>();
    session.outputBuffers.set(id, outBuf);

    const ctx: UpdateContext = {
      tick,
      inputs,
      rawInputs,
      state: inst.state,
      seed: session.context.seed,
      setState: (next: unknown) => {
        inst.state = next;
      },
      emit: (channel: string, value: unknown) => {
        // Validate channel exists on manifest
        const chan = inst.manifest.outputs.find((c) => c.name === channel);
        if (!chan) {
          pushEvent(session, { kind: 'log', instance: id, message: `attempted emit on unknown channel "${channel}"`, tick, ts: Date.now() }, hooks);
          return;
        }
        (outBuf.get(channel) ?? outBuf.set(channel, []).get(channel)!).push(value);
        pushEvent(session, { kind: 'channel', message: { instance: id, channel, value, tick }, ts: Date.now() }, hooks);
      },
      emitToken: (symbol: string, amount: number, reason?: string) => {
        if (amount <= 0) return;
        // Verify the extension is allowed to mint this token
        const owns = inst.manifest.tokenDefinitions?.some((t) => t.symbol === symbol);
        if (!owns) {
          hooks.onTokenReject?.(session.context.sessionId, symbol, amount, `instance "${id}" does not own token "${symbol}"`);
          pushEvent(session, { kind: 'log', instance: id, message: `rejected token emit: does not own "${symbol}"`, tick, ts: Date.now() }, hooks);
          return;
        }
        // Rate / cap enforcement
        const def = inst.manifest.tokenDefinitions!.find((t) => t.symbol === symbol)!;
        if (!enforceMint(session, def, amount)) {
          hooks.onTokenReject?.(session.context.sessionId, symbol, amount, `policy violation on "${symbol}"`);
          pushEvent(session, { kind: 'log', instance: id, message: `rejected token emit: policy violation "${symbol}"`, tick, ts: Date.now() }, hooks);
          return;
        }
        const cur = session.tokenBalances.get(symbol) ?? 0;
        session.tokenBalances.set(symbol, cur + amount);
        session.tokenOps.push({ kind: 'token-emit', instance: id, symbol, amount, reason, tick, ts: Date.now() });
        hooks.onTokenEmit?.(session.context.sessionId, symbol, amount, id, tick);
      },
      consumeToken: (symbol: string, amount: number, reason?: string) => {
        if (amount <= 0) return;
        const cur = session.tokenBalances.get(symbol) ?? 0;
        if (cur < amount) {
          hooks.onTokenReject?.(session.context.sessionId, symbol, amount, `insufficient balance: ${cur} < ${amount}`);
          pushEvent(session, { kind: 'log', instance: id, message: `rejected token consume: insufficient "${symbol}"`, tick, ts: Date.now() }, hooks);
          return;
        }
        // Verify the extension is allowed to consume this token
        const allowed = inst.manifest.consumesTokens?.includes(symbol);
        if (!allowed) {
          hooks.onTokenReject?.(session.context.sessionId, symbol, amount, `instance "${id}" does not declare consumption of "${symbol}"`);
          pushEvent(session, { kind: 'log', instance: id, message: `rejected token consume: not declared "${symbol}"`, tick, ts: Date.now() }, hooks);
          return;
        }
        session.tokenBalances.set(symbol, cur - amount);
        session.tokenOps.push({ kind: 'token-consume', instance: id, symbol, amount, reason, tick, ts: Date.now() });
        hooks.onTokenConsume?.(session.context.sessionId, symbol, amount, id, tick);
      },
      tokenBalance: (symbol: string) => session.tokenBalances.get(symbol) ?? 0,
      log: (message: string, data?: unknown) => {
        pushEvent(session, { kind: 'log', instance: id, message, data, tick, ts: Date.now() }, hooks);
      },
      endSession: (reason: string) => {
        session.status = 'ENDED';
        pushEvent(session, { kind: 'session-end', reason, tick, ts: Date.now() }, hooks);
      },
    };

    try {
      inst.update(ctx);
    } catch (err) {
      pushEvent(session, { kind: 'log', instance: id, message: `error: ${(err as Error).message}`, data: { stack: (err as Error).stack }, tick, ts: Date.now() }, hooks);
    }

    // Capture state snapshot
    pushEvent(session, { kind: 'state', instance: id, state: inst.state, tick, ts: Date.now() }, hooks);

    // Extract score if the state has a `score` field
    if (inst.state && typeof inst.state === 'object' && 'score' in (inst.state as Record<string, unknown>)) {
      const s = (inst.state as { score: unknown }).score;
      if (typeof s === 'number') session.score = Math.max(session.score, s);
    }
  }

  // Flush token ops into the event log
  for (const op of session.tokenOps) {
    pushEvent(session, op, hooks);
  }

  return session;
}

/**
 * Apply an external action (user input) to a specific instance.
 * The action is buffered and consumed on the next tick.
 */
export function applyAction(
  session: RuntimeSession,
  instanceId: string,
  action: string,
  payload?: unknown,
  hooks: RuntimeHooks = {},
): void {
  session.actionCount += 1;
  pushEvent(session, { kind: 'action', action, payload, tick: session.tick, ts: Date.now() }, hooks);

  const inst = session.instances.get(instanceId);
  if (!inst) return;

  // Extensions can opt-in to receiving actions by exposing a `handleAction` method on their state object
  const state = inst.state as { handleAction?: (action: string, payload?: unknown) => void } | null;
  if (state && typeof state.handleAction === 'function') {
    try {
      state.handleAction(action, payload);
    } catch (err) {
      pushEvent(session, { kind: 'log', instance: instanceId, message: `action error: ${(err as Error).message}`, tick: session.tick, ts: Date.now() }, hooks);
    }
  }
}

/**
 * Snapshot the session for the inspector UI.
 */
export function inspect(session: RuntimeSession): InspectorSnapshot {
  const instances = session.graph.executionOrder.map((id) => {
    const inst = session.instances.get(id)!;
    const lastEvents = session.events
      .filter((e) => 'instance' in e && e.instance === id)
      .slice(-5)
      .reverse();
    return {
      id,
      extensionId: inst.manifest.id,
      name: inst.manifest.name,
      category: inst.manifest.category,
      state: inst.state,
      lastEvents,
    };
  });

  const tokenBalances: Record<string, number> = {};
  for (const [sym, amt] of session.tokenBalances) tokenBalances[sym] = amt;

  return {
    sessionId: session.context.sessionId,
    tick: session.tick,
    status: session.status,
    instances,
    tokenBalances,
    recentEvents: session.events.slice(-50).reverse(),
    executionOrder: session.graph.executionOrder,
    score: session.score,
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────────

function pushEvent(session: RuntimeSession, event: RuntimeEvent, hooks: RuntimeHooks) {
  session.events.push(event);
  // Cap event log at 1000 entries to bound memory
  if (session.events.length > 1000) {
    session.events.splice(0, session.events.length - 1000);
  }
  hooks.onEvent?.(session.context.sessionId, event);
}

/**
 * Enforce token mint policy. Returns true if mint is allowed.
 * For rate-limited policies, we approximate by tracking total minted per symbol
 * and comparing against (perSecond * elapsedSeconds). Cap policies track total.
 *
 * The tracker is stored as a Symbol-keyed property on the session object so it
 * does not pollute the RuntimeSession interface but is per-session.
 */
const MINT_TRACKER = Symbol('mintTracker');

interface MintTracker {
  [symbol: string]: { total: number; firstMintTick: number };
}

function enforceMint(session: RuntimeSession, def: TokenDefinition, amount: number): boolean {
  const trackers = ((session as unknown) as Record<symbol, MintTracker>)[MINT_TRACKER] ?? {};
  ((session as unknown) as Record<symbol, MintTracker>)[MINT_TRACKER] = trackers;

  // firstMintTick defaults to 0 (session start) so the rate limit window
  // begins from session start, not from the first mint attempt.
  const tracker = trackers[def.symbol] ?? { total: 0, firstMintTick: 0 };
  trackers[def.symbol] = tracker;

  if (def.mintPolicy.kind === 'fixed-cap') {
    if (tracker.total + amount > def.mintPolicy.cap) return false;
  } else if (def.mintPolicy.kind === 'unbounded-rate-limited') {
    const elapsedSeconds = Math.max(session.tick - tracker.firstMintTick, 0) / 10; // 10 ticks/sec
    const allowed = def.mintPolicy.perSecond * Math.max(elapsedSeconds, 0.1);
    if (tracker.total + amount > allowed) return false;
  }
  // 'unbounded' always allowed

  tracker.total += amount;
  return true;
}
