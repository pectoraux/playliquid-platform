/**
 * In-Memory Session Registry
 * ---------------------------
 * Runtime sessions live in process memory for fast tick-by-tick execution.
 * The ledger, token balances, and telemetry are persisted to the database
 * via the kernel services.
 *
 * The registry wires the runtime hooks to the persistence layer so that
 * token emits/consumes flow to the TokenService while the session runs.
 */

import { createSession, tickSession, applyAction, inspect, type RuntimeSession, type RuntimeHooks } from '@/kernel/runtime';
import { compileBundle } from '@/kernel/compiler';
import type { CompiledGraph, ExperienceBundle, SessionContext, InspectorSnapshot, RuntimeEvent } from '@/kernel/types';
import { getAllFactories, resolveExtension } from '@/kernel/extensions';
import { tokenService } from '@/lib/token-store';
import { telemetryService } from '@/lib/telemetry-store';
import { db } from '@/lib/db';

interface SessionEntry {
  session: RuntimeSession;
  graph: CompiledGraph;
  bundle: ExperienceBundle;
  experienceId: string;
  hooks: RuntimeHooks;
  tokenEmits: RuntimeEvent[];
  tokenConsumes: RuntimeEvent[];
}

// Use a global registry so the Map survives Next.js dev hot-reloads.
const globalForSessions = globalThis as unknown as {
  __playliquidSessions?: Map<string, SessionEntry>;
};
const registry: Map<string, SessionEntry> = globalForSessions.__playliquidSessions ?? new Map();
globalForSessions.__playliquidSessions = registry;

function makeHooks(sessionId: string): { hooks: RuntimeHooks; tokenEmits: RuntimeEvent[]; tokenConsumes: RuntimeEvent[] } {
  const tokenEmits: RuntimeEvent[] = [];
  const tokenConsumes: RuntimeEvent[] = [];
  const hooks: RuntimeHooks = {
    onTokenEmit: (sid, symbol, amount, instance, tick) => {
      tokenEmits.push({ kind: 'token-emit', instance: instance ?? '', symbol, amount, tick: tick ?? 0, ts: Date.now() });
      // Persist asynchronously (fire-and-forget for tick speed)
      tokenService.recordEmit(sid, symbol, amount, instance, undefined, tick).catch(() => {});
      // Update balance in DB
      tokenService.repo.getBalance(sid, symbol)
        .then((cur) => tokenService.repo.setBalance(sid, symbol, cur + amount))
        .catch(() => {});
    },
    onTokenConsume: (sid, symbol, amount, instance, tick) => {
      tokenConsumes.push({ kind: 'token-consume', instance: instance ?? '', symbol, amount, tick: tick ?? 0, ts: Date.now() });
      tokenService.recordConsume(sid, symbol, amount, instance, undefined, tick).catch(() => {});
      tokenService.repo.getBalance(sid, symbol)
        .then((cur) => tokenService.repo.setBalance(sid, symbol, Math.max(0, cur - amount)))
        .catch(() => {});
    },
    onTokenReject: () => {},
    onEvent: () => {},
  };
  return { hooks, tokenEmits, tokenConsumes };
}

export async function startSession(params: {
  experienceId: string;
  bundle: ExperienceBundle;
  mode?: 'PREVIEW' | 'EARN';
  userId?: string;
}): Promise<{ sessionId: string; valid: boolean; errors: string[] }> {
  // Compile
  const graph = compileBundle(params.bundle, resolveExtension);
  if (!graph.valid) {
    return {
      sessionId: '',
      valid: false,
      errors: graph.errors.map((e) => `[${e.code}] ${e.message}`),
    };
  }

  const sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const mode = params.mode ?? 'PREVIEW';
  const seed = mode === 'EARN'
    ? `seed_${Math.random().toString(36).slice(2, 16)}`
    : `preview_${Math.random().toString(36).slice(2, 12)}`;

  const ctx: SessionContext = {
    sessionId,
    experienceId: params.experienceId,
    mode,
    seed,
    userId: params.userId,
    startedAt: Date.now(),
  };

  const { hooks, tokenEmits, tokenConsumes } = makeHooks(sessionId);
  const session = createSession(ctx, graph, getAllFactories(), hooks);

  // Persist bundle if not already stored
  if (graph.contentHash) {
    await persistBundle(params.experienceId, params.bundle, graph).catch(() => {});
  }

  // Persist session record
  await db.playSession.create({
    data: {
      id: sessionId,
      experienceId: params.experienceId,
      bundleHash: graph.contentHash,
      mode,
      seed,
      userId: params.userId,
      status: 'ACTIVE',
    },
  }).catch(() => {});

  // Compute + persist genome
  const genome = telemetryService.computeGenome(params.experienceId, graph);
  await telemetryService.persistGenome(genome).catch(() => {});

  // Initialize token balances in DB
  for (const t of graph.declaredTokens) {
    await db.tokenBalanceRecord.upsert({
      where: { sessionId_symbol: { sessionId, symbol: t.symbol } },
      create: { sessionId, symbol: t.symbol, balance: 0, scope: t.scope },
      update: {},
    }).catch(() => {});
  }

  registry.set(sessionId, {
    session,
    graph,
    bundle: params.bundle,
    experienceId: params.experienceId,
    hooks,
    tokenEmits,
    tokenConsumes,
  });

  return { sessionId, valid: true, errors: [] };
}

export function getSession(sessionId: string): SessionEntry | undefined {
  return registry.get(sessionId);
}

export function tick(sessionId: string, ticks = 1): InspectorSnapshot | null {
  const entry = registry.get(sessionId);
  if (!entry) return null;
  for (let i = 0; i < ticks; i++) {
    tickSession(entry.session, entry.hooks);
  }
  // Persist tick count
  db.playSession.update({
    where: { id: sessionId },
    data: { tickCount: entry.session.tick, actionCount: entry.session.actionCount, score: entry.session.score },
  }).catch(() => {});
  return inspect(entry.session);
}

export function sendAction(sessionId: string, instanceId: string, action: string, payload?: unknown): InspectorSnapshot | null {
  const entry = registry.get(sessionId);
  if (!entry) return null;
  applyAction(entry.session, instanceId, action, payload, entry.hooks);
  return inspect(entry.session);
}

export function snapshot(sessionId: string): InspectorSnapshot | null {
  const entry = registry.get(sessionId);
  if (!entry) return null;
  return inspect(entry.session);
}

export async function endSession(sessionId: string, reason = 'manual'): Promise<void> {
  const entry = registry.get(sessionId);
  if (!entry) return;
  entry.session.status = 'ENDED';

  // Settle tokens if there's a user
  if (entry.session.context.userId) {
    const userId = entry.session.context.userId;
    await tokenService.settle(
      sessionId,
      userId,
      'pool:reward',
      `player:wallet:${userId}`,
    ).catch(() => {});
  }

  // Record telemetry
  const duration = Date.now() - entry.session.context.startedAt;
  await telemetryService.recordSession({
    experienceId: entry.experienceId,
    sessionId,
    bundleHash: entry.graph.contentHash,
    tickCount: entry.session.tick,
    sessionDurationMs: duration,
    actionCount: entry.session.actionCount,
    completion: reason === 'completed',
    score: entry.session.score,
    tokenEmits: entry.tokenEmits,
    tokenConsumes: entry.tokenConsumes,
    extensions: Object.values(entry.graph.instances).map((i) => i.manifest.id),
  }).catch(() => {});

  await db.playSession.update({
    where: { id: sessionId },
    data: { status: 'ENDED', endedAt: new Date(), tickCount: entry.session.tick, actionCount: entry.session.actionCount, score: entry.session.score },
  }).catch(() => {});

  registry.delete(sessionId);
}

export async function persistBundle(experienceId: string, bundle: ExperienceBundle, graph: CompiledGraph) {
  if (!graph.contentHash) return;
  // Upsert bundle
  await db.bundleRecord.upsert({
    where: { contentHash: graph.contentHash },
    create: {
      contentHash: graph.contentHash,
      experienceId,
      type: bundle.type,
      name: bundle.name,
      bundleJson: JSON.stringify(bundle),
      deterministic: graph.deterministic,
    },
    update: {},
  });

  // Upsert extension records
  for (const { manifest } of Object.values(graph.instances)) {
    await db.extensionRecord.upsert({
      where: { id: manifest.id },
      create: {
        id: manifest.id,
        slug: manifest.slug,
        name: manifest.name,
        description: manifest.description,
        author: manifest.author,
        category: manifest.category,
        kind: manifest.kind,
        trustLevel: manifest.trustLevel,
        determinism: manifest.determinismMode,
        manifestJson: JSON.stringify(manifest),
      },
      update: {},
    });
  }

  // Upsert bundle instances
  for (const [instId, { spec, manifest }] of Object.entries(graph.instances)) {
    await db.bundleInstance.upsert({
      where: { id: `${graph.contentHash}_${instId}` },
      create: {
        id: `${graph.contentHash}_${instId}`,
        bundleHash: graph.contentHash,
        instanceId: instId,
        extensionId: manifest.id,
        role: spec.role ?? null,
        configJson: JSON.stringify(spec.config ?? {}),
      },
      update: {},
    });
  }
}
