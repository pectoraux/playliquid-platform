/**
 * Civilization Engine — World Service
 * ------------------------------------
 * Creates persistent worlds from published experiences, spawns AI citizens,
 * and manages world lifecycle.
 */

import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import { ACCOUNTS } from '@/kernel/ledger';
import type {
  World, WorldGenome, WorldMacroState, WorldEntity, EntityType, AgentGenome,
} from '@/kernel/types';

const FIRST_NAMES = ['Aria', 'Bram', 'Cleo', 'Doran', 'Elena', 'Finn', 'Gemma', 'Hugo', 'Iris', 'Jora', 'Kael', 'Lina', 'Milo', 'Nara', 'Orin', 'Petra', 'Quinn', 'Rosa', 'Sten', 'Tova', 'Uma', 'Vex', 'Wren', 'Xara', 'Yorin', 'Zara'];
const ROLES: EntityType[] = ['CITIZEN', 'MERCHANT', 'BUILDER', 'EXPLORER', 'COMPETITOR'];

const RESOURCE_TYPES = ['CORN', 'WOOD', 'STONE', 'WATER', 'GOLD', 'REPUTATION'];

/**
 * Create a world from a published experience.
 */
export async function createWorld(params: {
  experienceId: string;
  name: string;
  description: string;
  creatorId: string;
}): Promise<World> {
  const worldGenome: WorldGenome = {
    complexity: 50,
    economyDepth: 60,
    socialDensity: 40,
    agentDiversity: 70,
    resourceVariety: RESOURCE_TYPES.length,
    eventFrequency: 30,
  };

  const macroState: WorldMacroState = {
    resources: { CORN: 1000, WOOD: 500, STONE: 300, WATER: 800, GOLD: 100, REPUTATION: 0 },
    prices: { CORN: 1, WOOD: 2, STONE: 3, WATER: 1, GOLD: 10, REPUTATION: 5 },
    population: 0,
    averageWealth: 0,
    giniCoefficient: 0,
    mood: 0,
    activeEvents: [],
  };

  const record = await db.worldRecord.create({
    data: {
      name: params.name,
      description: params.description,
      experienceId: params.experienceId,
      creatorId: params.creatorId,
      status: 'DORMANT',
      worldGenomeJson: JSON.stringify(worldGenome),
      macroStateJson: JSON.stringify(macroState),
    },
  });

  // Seed the world's economy account
  await ledger.post([
    { account: ACCOUNTS.PLATFORM_CLEARING, debit: 0, credit: 10_000_000 },
    { account: `world:${record.id}:treasury`, debit: 10_000_000, credit: 0 },
  ], `world ${params.name} founded`);

  // Record founding in history
  await db.worldHistoryRecord.create({
    data: {
      worldId: record.id,
      tick: 0,
      type: 'founding',
      title: `${params.name} Founded`,
      narrative: `The world of ${params.name} was established. The treasury holds 10 Liquid. Citizens await.`,
    },
  });

  return toWorld(record);
}

/**
 * Spawn AI citizens in a world.
 */
export async function spawnCitizens(params: {
  worldId: string;
  count: number;
  roleDistribution?: Partial<Record<EntityType, number>>;
}): Promise<{ spawned: number; entities: WorldEntity[] }> {
  const world = await db.worldRecord.findUnique({ where: { id: params.worldId } });
  if (!world) throw new Error('World not found');

  // Default distribution: 40% citizens, 20% merchants, 10% builders, 10% explorers, 10% competitors, 10% misc
  const dist = params.roleDistribution ?? {
    CITIZEN: Math.floor(params.count * 0.4),
    MERCHANT: Math.floor(params.count * 0.2),
    BUILDER: Math.floor(params.count * 0.1),
    EXPLORER: Math.floor(params.count * 0.1),
    COMPETITOR: Math.floor(params.count * 0.1),
  };
  // Fill remainder with citizens
  const assigned = Object.values(dist).reduce((s, n) => s + n, 0);
  dist.CITIZEN = (dist.CITIZEN ?? 0) + (params.count - assigned);

  const entities: WorldEntity[] = [];
  let nameIdx = 0;

  for (const [roleStr, count] of Object.entries(dist)) {
    const role = roleStr as EntityType;
    for (let i = 0; i < count; i++) {
      const name = `${FIRST_NAMES[nameIdx % FIRST_NAMES.length]} ${String.fromCharCode(65 + (nameIdx % 26))}${nameIdx}`;
      nameIdx++;

      const genome = generateAgentGenome(role);
      const wealth = Math.floor(50_000 + Math.random() * 100_000); // 0.05 - 0.15 Liquid
      const resources: Record<string, number> = {};
      for (const r of RESOURCE_TYPES) {
        resources[r] = Math.floor(Math.random() * 20);
      }

      const record = await db.worldEntityRecord.create({
        data: {
          worldId: params.worldId,
          name,
          type: role,
          agentGenomeJson: JSON.stringify(genome),
          wealth,
          resourcesJson: JSON.stringify(resources),
          reputation: Math.floor(Math.random() * 40),
        },
      });

      // Credit the entity's wallet from world treasury
      await ledger.post([
        { account: `world:${params.worldId}:treasury`, debit: 0, credit: wealth },
        { account: `entity:${record.id}:wallet`, debit: wealth, credit: 0 },
      ], `spawned ${name} (${role})`);

      entities.push(toEntity(record));
    }
  }

  // Update world population
  await db.worldRecord.update({
    where: { id: params.worldId },
    data: {
      population: { increment: entities.length },
      status: 'ACTIVE',
    },
  });

  // Record in history
  await db.worldHistoryRecord.create({
    data: {
      worldId: params.worldId,
      tick: 0,
      type: 'founding',
      title: `${entities.length} Citizens Arrived`,
      narrative: `${entities.length} AI citizens joined the world: ${Object.entries(dist).map(([r, c]) => `${c} ${r.toLowerCase()}s`).join(', ')}.`,
    },
  });

  return { spawned: entities.length, entities };
}

/**
 * Generate an agent genome based on role.
 */
function generateAgentGenome(role: EntityType): AgentGenome {
  const personalities = {
    CITIZEN: { riskTolerance: 20 + Math.random() * 30, sociability: 40 + Math.random() * 40, ambition: 30 + Math.random() * 30, creativity: 20 + Math.random() * 40 },
    MERCHANT: { riskTolerance: 50 + Math.random() * 30, sociability: 60 + Math.random() * 30, ambition: 70 + Math.random() * 20, creativity: 30 + Math.random() * 30 },
    BUILDER: { riskTolerance: 30 + Math.random() * 20, sociability: 30 + Math.random() * 30, ambition: 40 + Math.random() * 30, creativity: 70 + Math.random() * 20 },
    EXPLORER: { riskTolerance: 70 + Math.random() * 20, sociability: 30 + Math.random() * 30, ambition: 60 + Math.random() * 30, creativity: 50 + Math.random() * 30 },
    COMPETITOR: { riskTolerance: 60 + Math.random() * 30, sociability: 40 + Math.random() * 30, ambition: 80 + Math.random() * 15, creativity: 40 + Math.random() * 30 },
  };

  const goals = {
    CITIZEN: ['build a comfortable life', 'raise reputation', 'accumulate resources'],
    MERCHANT: ['maximize wealth', 'dominate trade', 'find arbitrage opportunities'],
    BUILDER: ['construct great works', 'improve infrastructure', 'leave a legacy'],
    EXPLORER: ['discover new resources', 'map the world', 'find rare events'],
    COMPETITOR: ['win tournaments', 'be the best', 'climb the leaderboard'],
  };

  const skills = {
    CITIZEN: { farming: 40 + Math.random() * 30, trading: 20 + Math.random() * 20, building: 20 + Math.random() * 20 },
    MERCHANT: { trading: 60 + Math.random() * 30, negotiation: 50 + Math.random() * 30, farming: 10 + Math.random() * 20 },
    BUILDER: { building: 60 + Math.random() * 30, farming: 20 + Math.random() * 20, engineering: 50 + Math.random() * 30 },
    EXPLORER: { exploration: 60 + Math.random() * 30, survival: 50 + Math.random() * 30, trading: 20 + Math.random() * 20 },
    COMPETITOR: { combat: 60 + Math.random() * 30, strategy: 50 + Math.random() * 30, trading: 30 + Math.random() * 20 },
  };

  const styles: AgentGenome['decisionStyle'][] = ['greedy', 'strategic', 'social', 'creative'];
  const styleMap = {
    CITIZEN: 'social' as const,
    MERCHANT: 'greedy' as const,
    BUILDER: 'creative' as const,
    EXPLORER: 'strategic' as const,
    COMPETITOR: 'greedy' as const,
  };

  return {
    personality: personalities[role as keyof typeof personalities] ?? personalities.CITIZEN,
    goals: goals[role as keyof typeof goals] ?? goals.CITIZEN,
    skills: skills[role as keyof typeof skills] ?? skills.CITIZEN,
    role,
    decisionStyle: styleMap[role as keyof typeof styleMap] ?? 'strategic',
  };
}

/**
 * Get a world by ID.
 */
export async function getWorld(worldId: string): Promise<World | null> {
  const record = await db.worldRecord.findUnique({ where: { id: worldId } });
  if (!record) return null;
  return toWorld(record);
}

/**
 * List all worlds.
 */
export async function listWorlds(): Promise<World[]> {
  const records = await db.worldRecord.findMany({ orderBy: { createdAt: 'desc' } });
  return records.map(toWorld);
}

/**
 * Get entities in a world.
 */
export async function getEntities(worldId: string): Promise<WorldEntity[]> {
  const records = await db.worldEntityRecord.findMany({
    where: { worldId, alive: true },
    orderBy: { wealth: 'desc' },
  });
  return records.map(toEntity);
}

/**
 * Get world history.
 */
export async function getHistory(worldId: string, limit = 50): Promise<any[]> {
  const records = await db.worldHistoryRecord.findMany({
    where: { worldId },
    orderBy: { tick: 'desc' },
    take: limit,
  });
  return records.map((r) => ({
    id: r.id,
    tick: r.tick,
    type: r.type,
    title: r.title,
    narrative: r.narrative,
    timestamp: r.timestamp.getTime(),
  }));
}

// ─── Mappers ───────────────────────────────────────────────────────────────

function toWorld(r: any): World {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    experienceId: r.experienceId,
    creatorId: r.creatorId,
    status: r.status,
    tickCount: r.tickCount,
    population: r.population,
    worldGenome: JSON.parse(r.worldGenomeJson),
    macroState: JSON.parse(r.macroStateJson),
    createdAt: r.createdAt.getTime(),
    lastTickAt: r.lastTickAt?.getTime(),
  };
}

function toEntity(r: any): WorldEntity {
  return {
    id: r.id,
    worldId: r.worldId,
    name: r.name,
    type: r.type as EntityType,
    agentGenome: r.agentGenomeJson ? JSON.parse(r.agentGenomeJson) : undefined,
    wealth: r.wealth,
    resources: JSON.parse(r.resourcesJson),
    reputation: r.reputation,
    relationships: JSON.parse(r.relationshipsJson),
    memory: JSON.parse(r.memoryJson),
    lastDecisionTick: r.lastDecisionTick,
    alive: r.alive,
    createdAt: r.createdAt.getTime(),
  };
}
