/**
 * Civilization Engine — World Scheduler + Events Engine
 * ------------------------------------------------------
 * Runs the persistent world simulation: ticks worlds, runs agent decisions,
 * updates economy, generates emergent events, records history.
 *
 * The scheduler runs N ticks per call. Each tick:
 *   1. Update world macro state (resources, prices, mood)
 *   2. Run agent decisions (LLM for a sample, rule-based for the rest)
 *   3. Check for emergent events
 *   4. Update relationships
 *   5. Record tick + history
 */

import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import { runAgentLoop } from './agent-service';
import { generateEmergentEvent } from './event-engine';
import type { World, WorldMacroState, WorldEntity } from '@/kernel/types';

const LLM_AGENT_SAMPLE_SIZE = 3;  // Only 3 agents per tick use LLM (cost control)
const EVENT_CHECK_INTERVAL = 10;  // Check for events every 10 ticks

/**
 * Run the world simulation for N ticks.
 */
export async function runWorldTicks(params: {
  worldId: string;
  ticks: number;
  useLLM?: boolean;
}): Promise<{ ticksRun: number; eventsGenerated: number; decisions: number }> {
  const { worldId, ticks } = params;
  const useLLM = params.useLLM ?? false;

  const world = await db.worldRecord.findUnique({ where: { id: worldId } });
  if (!world) throw new Error('World not found');

  let eventsGenerated = 0;
  let decisions = 0;

  for (let t = 0; t < ticks; t++) {
    const tick = world.tickCount + t + 1;

    // ── 1. Update macro state ──────────────────────────────────────────
    const macroState: WorldMacroState = JSON.parse(world.macroStateJson);
    updateMacroState(macroState, tick);

    // ── 2. Run agent decisions ─────────────────────────────────────────
    const entities = await db.worldEntityRecord.findMany({
      where: { worldId, alive: true },
    });

    // Sample a few agents for LLM reasoning, rest use rule-based
    const llmIndices = useLLM ? sampleIndices(entities.length, LLM_AGENT_SAMPLE_SIZE) : new Set<number>();

    const recentEvents = await getRecentEventNames(worldId, 3);

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const entityTyped: WorldEntity = {
        id: entity.id,
        worldId: entity.worldId,
        name: entity.name,
        type: entity.type as WorldEntity['type'],
        agentGenome: entity.agentGenomeJson ? JSON.parse(entity.agentGenomeJson) : undefined,
        wealth: entity.wealth,
        resources: JSON.parse(entity.resourcesJson),
        reputation: entity.reputation,
        relationships: JSON.parse(entity.relationshipsJson),
        memory: JSON.parse(entity.memoryJson),
        lastDecisionTick: entity.lastDecisionTick,
        alive: entity.alive,
        createdAt: entity.createdAt.getTime(),
      };

      const decision = await runAgentLoop({
        entity: entityTyped,
        worldId,
        tick,
        worldState: macroState,
        recentEvents,
        useLLM: llmIndices.has(i),
      });

      if (decision) decisions++;
    }

    // ── 3. Check for emergent events ───────────────────────────────────
    if (tick % EVENT_CHECK_INTERVAL === 0) {
      const event = await generateEmergentEvent(worldId, tick, macroState, useLLM);
      if (event) {
        eventsGenerated++;
        macroState.activeEvents.push(event.name);
        if (macroState.activeEvents.length > 5) macroState.activeEvents.shift();
      }
    }

    // ── 4. Update relationships (random social dynamics) ───────────────
    if (tick % 20 === 0) {
      await updateRelationships(worldId);
    }

    // ── 5. Persist world state ─────────────────────────────────────────
    await db.worldRecord.update({
      where: { id: worldId },
      data: {
        tickCount: tick,
        macroStateJson: JSON.stringify(macroState),
        lastTickAt: new Date(),
      },
    });

    // ── 6. Record tick snapshot (every 10 ticks to save space) ─────────
    if (tick % 10 === 0) {
      await db.worldTickRecord.create({
        data: {
          worldId,
          tick,
          stateSnapshotJson: JSON.stringify(macroState),
          eventsJson: JSON.stringify(macroState.activeEvents),
          decisionsCount: decisions,
        },
      });
    }

    // ── 7. Record milestones ───────────────────────────────────────────
    await checkMilestones(worldId, tick, macroState, entities.length);
  }

  return { ticksRun: ticks, eventsGenerated, decisions };
}

/**
 * Update macro state — prices drift, mood shifts, wealth distribution.
 */
function updateMacroState(state: WorldMacroState, tick: number): void {
  // Price mean-reversion toward base
  for (const [resource, price] of Object.entries(state.prices)) {
    const base = RESOURCE_BASE_PRICES[resource] ?? 1;
    state.prices[resource] = price * 0.95 + base * 0.05;
  }

  // Mood drifts toward 0 (neutral)
  state.mood = state.mood * 0.98;

  // Random mood events
  if (Math.random() < 0.05) {
    state.mood += Math.floor((Math.random() - 0.5) * 20);
    state.mood = Math.max(-100, Math.min(100, state.mood));
  }

  // Resource decay (consumption)
  for (const resource of Object.keys(state.resources)) {
    state.resources[resource] = Math.max(0, state.resources[resource] - Math.floor(Math.random() * 3));
  }
}

const RESOURCE_BASE_PRICES: Record<string, number> = {
  CORN: 1, WOOD: 2, STONE: 3, WATER: 1, GOLD: 10, REPUTATION: 5,
};

/**
 * Sample N unique indices from 0..max.
 */
function sampleIndices(max: number, n: number): Set<number> {
  const indices = new Set<number>();
  const count = Math.min(n, max);
  while (indices.size < count) {
    indices.add(Math.floor(Math.random() * max));
  }
  return indices;
}

/**
 * Get recent event names for context.
 */
async function getRecentEventNames(worldId: string, count: number): Promise<string[]> {
  const events = await db.worldEventRecord.findMany({
    where: { worldId },
    orderBy: { createdAt: 'desc' },
    take: count,
    select: { name: true },
  });
  return events.map((e) => e.name);
}

/**
 * Update relationships — random social dynamics.
 */
async function updateRelationships(worldId: string): Promise<void> {
  const entities = await db.worldEntityRecord.findMany({
    where: { worldId, alive: true },
    select: { id: true, relationshipsJson: true, agentGenomeJson: true },
  });

  for (const entity of entities) {
    const relationships: Record<string, number> = JSON.parse(entity.relationshipsJson);
    const genome = entity.agentGenomeJson ? JSON.parse(entity.agentGenomeJson) : null;
    const sociability = genome?.personality?.sociability ?? 50;

    // Pick a random other entity
    const others = entities.filter((e) => e.id !== entity.id);
    if (others.length === 0) continue;
    const other = others[Math.floor(Math.random() * others.length)];

    const current = relationships[other.id] ?? 0;
    // Sociable agents drift toward positive, unsociable toward negative
    const drift = (sociability - 50) / 50 * (Math.random() * 4 - 1);
    relationships[other.id] = Math.max(-100, Math.min(100, current + drift));

    await db.worldEntityRecord.update({
      where: { id: entity.id },
      data: { relationshipsJson: JSON.stringify(relationships) },
    });
  }
}

/**
 * Check for milestones and record history.
 */
async function checkMilestones(worldId: string, tick: number, state: WorldMacroState, population: number): Promise<void> {
  // Population milestone
  if (population === 100 && tick < 50) {
    await recordHistory(worldId, tick, 'milestone', 'Population Reached 100', 'The world now has 100 inhabitants.');
  }

  // Economic milestones
  if (state.averageWealth > 500_000 && tick < 200) {
    await recordHistory(worldId, tick, 'economic', 'Economic Boom', 'Average wealth exceeded 0.5 Liquid per citizen.');
  }

  // Crisis
  if (state.mood < -50) {
    await recordHistory(worldId, tick, 'crisis', 'Great Depression', `World mood dropped to ${Math.round(state.mood)}. Citizens are unhappy.`);
  }

  // Recovery
  if (state.mood > 50 && tick > 100) {
    await recordHistory(worldId, tick, 'milestone', 'Golden Age', `World mood reached ${Math.round(state.mood)}. Prosperity reigns.`);
  }
}

/**
 * Record a history entry.
 */
export async function recordHistory(worldId: string, tick: number, type: string, title: string, narrative: string): Promise<void> {
  // Avoid duplicates within 10 ticks
  const existing = await db.worldHistoryRecord.findFirst({
    where: { worldId, title, tick: { gte: tick - 10 } },
  });
  if (existing) return;

  await db.worldHistoryRecord.create({
    data: { worldId, tick, type, title, narrative },
  });
}

/**
 * Get world statistics summary.
 */
export async function getWorldStats(worldId: string): Promise<{
  population: number;
  totalWealth: number;
  averageWealth: number;
  wealthiestEntity?: { name: string; wealth: number };
  totalResources: number;
  eventCount: number;
  assetCount: number;
  tickCount: number;
  mood: number;
}> {
  const world = await db.worldRecord.findUnique({ where: { id: worldId } });
  if (!world) throw new Error('World not found');

  const entities = await db.worldEntityRecord.findMany({
    where: { worldId, alive: true },
    orderBy: { wealth: 'desc' },
  });

  const totalWealth = entities.reduce((s, e) => s + e.wealth, 0);
  const averageWealth = entities.length > 0 ? totalWealth / entities.length : 0;
  const wealthiest = entities[0];

  const eventCount = await db.worldEventRecord.count({ where: { worldId } });
  const assetCount = await db.assetRecord.count({ where: { worldId } });

  const macroState: WorldMacroState = JSON.parse(world.macroStateJson);
  const totalResources = Object.values(macroState.resources).reduce((s, n) => s + n, 0);

  return {
    population: entities.length,
    totalWealth,
    averageWealth,
    wealthiestEntity: wealthiest ? { name: wealthiest.name, wealth: wealthiest.wealth } : undefined,
    totalResources,
    eventCount,
    assetCount,
    tickCount: world.tickCount,
    mood: macroState.mood,
  };
}
