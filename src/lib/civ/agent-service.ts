/**
 * Civilization Engine — Agent Service
 * ------------------------------------
 * The autonomous agent decision loop: Observe → Reason → Plan → Act → Learn.
 *
 * Agents use the LLM for strategic decisions (every N ticks) and rule-based
 * logic for frequent tick decisions. This balances AI quality with performance.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import { ACCOUNTS } from '@/kernel/ledger';
import type { WorldEntity, AgentGenome, AgentMemory, WorldMacroState, EntityType } from '@/kernel/types';

const RESOURCE_TYPES = ['CORN', 'WOOD', 'STONE', 'WATER', 'GOLD', 'REPUTATION'];

export interface AgentDecision {
  entityId: string;
  action: string;
  params: Record<string, unknown>;
  reasoning: string;
  expectedImpact: string;
}

export interface AgentObservation {
  worldState: WorldMacroState;
  myState: { wealth: number; resources: Record<string, number>; reputation: number };
  marketConditions: { cheapest: string; mostExpensive: string; priceSpread: number };
  socialContext: { allies: number; rivals: number; reputation: number };
  recentEvents: string[];
}

/**
 * Run the agent decision loop for a single entity.
 * Returns the decision made (or null if no action).
 */
export async function runAgentLoop(params: {
  entity: WorldEntity;
  worldId: string;
  tick: number;
  worldState: WorldMacroState;
  recentEvents: string[];
  useLLM: boolean;
}): Promise<AgentDecision | null> {
  const { entity, worldId, tick, worldState, recentEvents, useLLM } = params;

  if (!entity.agentGenome || !entity.alive) return null;

  // ── OBSERVE ─────────────────────────────────────────────────────────
  const observation = observe(entity, worldState, recentEvents);

  // ── REASON + PLAN ───────────────────────────────────────────────────
  let decision: AgentDecision;
  if (useLLM) {
    decision = await reasonWithLLM(entity, observation, tick);
  } else {
    decision = reasonRuleBased(entity, observation, tick);
  }

  // ── ACT ─────────────────────────────────────────────────────────────
  await executeAction(decision, worldId, tick);

  // ── LEARN ───────────────────────────────────────────────────────────
  const memory = recordMemory(entity, decision, tick);
  await persistMemory(entity.id, memory);

  return decision;
}

/**
 * Observe the world from the agent's perspective.
 */
function observe(entity: WorldEntity, worldState: WorldMacroState, recentEvents: string[]): AgentObservation {
  const prices = worldState.prices;
  const entries = Object.entries(prices);
  const sorted = entries.sort(([, a], [, b]) => a - b);
  const cheapest = sorted[0]?.[0] ?? 'CORN';
  const mostExpensive = sorted[sorted.length - 1]?.[0] ?? 'GOLD';
  const priceSpread = (sorted[sorted.length - 1]?.[1] ?? 0) - (sorted[0]?.[1] ?? 0);

  const allies = Object.values(entity.relationships).filter((v) => v > 30).length;
  const rivals = Object.values(entity.relationships).filter((v) => v < -30).length;

  return {
    worldState,
    myState: { wealth: entity.wealth, resources: entity.resources, reputation: entity.reputation },
    marketConditions: { cheapest, mostExpensive, priceSpread },
    socialContext: { allies, rivals, reputation: entity.reputation },
    recentEvents,
  };
}

/**
 * Reason with the LLM — strategic decision making.
 */
async function reasonWithLLM(entity: WorldEntity, obs: AgentObservation, tick: number): Promise<AgentDecision> {
  const genome = entity.agentGenome!;
  const systemPrompt = `You are an autonomous AI agent in the PlayLiquid Civilization Engine. You are a ${genome.role} named ${entity.name}.

Your personality: risk tolerance ${Math.round(genome.personality.riskTolerance)}/100, sociability ${Math.round(genome.personality.sociability)}/100, ambition ${Math.round(genome.personality.ambition)}/100, creativity ${Math.round(genome.personality.creativity)}/100.

Your goals: ${genome.goals.join(', ')}.

Your skills: ${JSON.stringify(genome.skills)}.

Current world state:
- Resources: ${JSON.stringify(obs.worldState.resources)}
- Prices: ${JSON.stringify(obs.worldState.prices)}
- Population: ${obs.worldState.population}
- World mood: ${obs.worldState.mood}
- Active events: ${obs.worldState.activeEvents.join(', ') || 'none'}

Your state:
- Wealth: ${entity.wealth} micro-Liquid
- Resources: ${JSON.stringify(entity.resources)}
- Reputation: ${entity.reputation}

Market conditions: cheapest resource is ${obs.marketConditions.cheapest}, most expensive is ${obs.marketConditions.mostExpensive}.

Recent events: ${obs.recentEvents.join('; ') || 'none'}

Choose ONE action to take this tick. Valid actions:
- "produce": generate your primary resource (costs energy, gains resource)
- "trade": buy low, sell high (specify resource + buy/sell)
- "invest": purchase an asset (specify asset type)
- "socialize": improve relationships with other entities
- "compete": enter a competition
- "explore": search for new resources or events
- "rest": do nothing (save energy)

Respond with ONLY valid JSON (no markdown):
{
  "action": "produce",
  "params": { "resource": "CORN" },
  "reasoning": "why you chose this",
  "expectedImpact": "what you expect to happen"
}`;

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: `Tick ${tick}. What do you do?` },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    let jsonStr = raw.trim();
    const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();

    const parsed = JSON.parse(jsonStr);
    return {
      entityId: entity.id,
      action: parsed.action,
      params: parsed.params ?? {},
      reasoning: parsed.reasoning ?? '',
      expectedImpact: parsed.expectedImpact ?? '',
    };
  } catch {
    return reasonRuleBased(entity, obs, tick);
  }
}

/**
 * Rule-based reasoning — fast, used for frequent ticks.
 */
function reasonRuleBased(entity: WorldEntity, obs: AgentObservation, tick: number): AgentDecision {
  const genome = entity.agentGenome!;
  const role = genome.role;
  const style = genome.decisionStyle;

  // Role-based default actions with some randomness
  const rand = Math.random();
  let action = 'rest';
  let params: Record<string, unknown> = {};
  let reasoning = '';

  if (role === 'CITIZEN') {
    if (entity.resources.CORN < 5) {
      action = 'produce';
      params = { resource: 'CORN' };
      reasoning = 'Low on food, need to farm';
    } else if (rand < 0.3 && style === 'social') {
      action = 'socialize';
      reasoning = 'Building community ties';
    } else if (rand < 0.5) {
      action = 'produce';
      params = { resource: 'WOOD' };
      reasoning = 'Gathering building materials';
    } else {
      action = 'trade';
      params = { resource: obs.marketConditions.mostExpensive, direction: 'sell' };
      reasoning = `Selling ${obs.marketConditions.mostExpensive} for profit`;
    }
  } else if (role === 'MERCHANT') {
    if (obs.marketConditions.priceSpread > 5 && rand < 0.6) {
      action = 'trade';
      params = { resource: obs.marketConditions.cheapest, direction: 'buy' };
      reasoning = `Arbitrage: buy ${obs.marketConditions.cheapest} cheap`;
    } else {
      action = 'trade';
      params = { resource: obs.marketConditions.mostExpensive, direction: 'sell' };
      reasoning = `Sell ${obs.marketConditions.mostExpensive} at premium`;
    }
  } else if (role === 'BUILDER') {
    if (entity.wealth > 200_000 && rand < 0.4) {
      action = 'invest';
      params = { assetType: 'building' };
      reasoning = 'Investing in infrastructure';
    } else {
      action = 'produce';
      params = { resource: 'STONE' };
      reasoning = 'Gathering stone for construction';
    }
  } else if (role === 'EXPLORER') {
    if (rand < 0.5) {
      action = 'explore';
      reasoning = 'Searching for new resources';
    } else {
      action = 'produce';
      params = { resource: 'WATER' };
      reasoning = 'Collecting water';
    }
  } else if (role === 'COMPETITOR') {
    if (rand < 0.4) {
      action = 'compete';
      reasoning = 'Entering competition';
    } else {
      action = 'produce';
      params = { resource: 'GOLD' };
      reasoning = 'Mining gold for competitions';
    }
  }

  return {
    entityId: entity.id,
    action,
    params,
    reasoning,
    expectedImpact: `${action} should improve ${genome.goals[0] ?? 'wealth'}`,
  };
}

/**
 * Execute an agent's action — modifies world state + ledger.
 */
async function executeAction(decision: AgentDecision, worldId: string, tick: number): Promise<void> {
  const entity = await db.worldEntityRecord.findUnique({ where: { id: decision.entityId } });
  if (!entity || !entity.alive) return;

  const resources: Record<string, number> = JSON.parse(entity.resourcesJson);
  let wealth = entity.wealth;
  let reputation = entity.reputation;
  let ledgerPosted = false;

  switch (decision.action) {
    case 'produce': {
      const resource = (decision.params.resource as string) ?? 'CORN';
      const amount = 1 + Math.floor(Math.random() * 3);
      resources[resource] = (resources[resource] ?? 0) + amount;
      // Update world supply
      await updateWorldResource(worldId, resource, amount);
      ledgerPosted = true;
      break;
    }
    case 'trade': {
      const resource = (decision.params.resource as string) ?? 'CORN';
      const direction = (decision.params.direction as string) ?? 'sell';
      const world = await db.worldRecord.findUnique({ where: { id: worldId } });
      const macroState: WorldMacroState = world ? JSON.parse(world.macroStateJson) : null;
      if (!macroState) break;
      const price = macroState.prices[resource] ?? 1;
      const amount = 1;

      if (direction === 'sell' && (resources[resource] ?? 0) >= amount) {
        const tradeAmount = Math.round(price * 100_000); // micro-Liquid, rounded to integer
        resources[resource] -= amount;
        wealth += tradeAmount;
        await updateWorldResource(worldId, resource, -amount);
        // Ledger: entity wallet → world treasury
        await ledger.post([
          { account: `world:${worldId}:treasury`, debit: 0, credit: tradeAmount },
          { account: `entity:${entity.id}:wallet`, debit: tradeAmount, credit: 0 },
        ], `trade: ${entity.name} sold ${amount} ${resource}`);
        ledgerPosted = true;
      } else if (direction === 'buy' && wealth >= price * 100_000) {
        const tradeAmount = Math.round(price * 100_000);
        resources[resource] = (resources[resource] ?? 0) + amount;
        wealth -= tradeAmount;
        await updateWorldResource(worldId, resource, amount);
        await ledger.post([
          { account: `entity:${entity.id}:wallet`, debit: 0, credit: tradeAmount },
          { account: `world:${worldId}:treasury`, debit: tradeAmount, credit: 0 },
        ], `trade: ${entity.name} bought ${amount} ${resource}`);
        ledgerPosted = true;
      }
      break;
    }
    case 'socialize': {
      reputation += 1 + Math.floor(Math.random() * 3);
      break;
    }
    case 'compete': {
      if (wealth >= 50_000) {
        wealth -= 50_000;
        const won = Math.random() > 0.5;
        if (won) {
          wealth += 100_000;
          reputation += 5;
          await ledger.post([
            { account: `world:${worldId}:treasury`, debit: 0, credit: 100_000 },
            { account: `entity:${entity.id}:wallet`, debit: 100_000, credit: 0 },
          ], `competition: ${entity.name} won`);
        }
      }
      break;
    }
    case 'explore': {
      if (Math.random() > 0.7) {
        const found = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)];
        const amount = 2 + Math.floor(Math.random() * 5);
        resources[found] = (resources[found] ?? 0) + amount;
        await updateWorldResource(worldId, found, amount);
      }
      break;
    }
    case 'invest': {
      // Create an asset
      const assetType = (decision.params.assetType as string) ?? 'building';
      const price = 200_000;
      if (wealth >= price) {
        wealth -= price;
        await db.assetRecord.create({
          data: {
            worldId,
            name: `${assetType} of ${entity.name}`,
            type: assetType,
            ownerId: entity.id,
            purchasePrice: price,
            generationRateJson: JSON.stringify({ REPUTATION: 1 }),
          },
        });
        await ledger.post([
          { account: `entity:${entity.id}:wallet`, debit: 0, credit: price },
          { account: `world:${worldId}:treasury`, debit: price, credit: 0 },
        ], `asset: ${entity.name} bought ${assetType}`);
      }
      break;
    }
    case 'rest':
    default:
      // No action
      break;
  }

  // Persist entity state
  await db.worldEntityRecord.update({
    where: { id: entity.id },
    data: {
      wealth,
      resourcesJson: JSON.stringify(resources),
      reputation,
      lastDecisionTick: tick,
    },
  });
}

/**
 * Update world resource supply and adjust prices.
 */
async function updateWorldResource(worldId: string, resource: string, delta: number): Promise<void> {
  const world = await db.worldRecord.findUnique({ where: { id: worldId } });
  if (!world) return;
  const state: WorldMacroState = JSON.parse(world.macroStateJson);
  state.resources[resource] = (state.resources[resource] ?? 0) + delta;
  // Simple price adjustment: more supply → lower price
  const supply = state.resources[resource] ?? 0;
  const basePrice = RESOURCE_BASE_PRICES[resource] ?? 1;
  state.prices[resource] = Math.max(0.1, basePrice * (1 - supply / 2000));
  await db.worldRecord.update({
    where: { id: worldId },
    data: { macroStateJson: JSON.stringify(state) },
  });
}

const RESOURCE_BASE_PRICES: Record<string, number> = {
  CORN: 1, WOOD: 2, STONE: 3, WATER: 1, GOLD: 10, REPUTATION: 5,
};

/**
 * Record a memory for the agent.
 */
function recordMemory(entity: WorldEntity, decision: AgentDecision, tick: number): AgentMemory {
  return {
    tick,
    event: decision.action,
    impact: decision.action === 'trade' ? 5 : decision.action === 'produce' ? 2 : 0,
    learning: decision.reasoning,
  };
}

/**
 * Persist agent memory (keep last 20).
 */
async function persistMemory(entityId: string, memory: AgentMemory): Promise<void> {
  const entity = await db.worldEntityRecord.findUnique({ where: { id: entityId } });
  if (!entity) return;
  const memories: AgentMemory[] = JSON.parse(entity.memoryJson);
  memories.push(memory);
  if (memories.length > 20) memories.shift();
  await db.worldEntityRecord.update({
    where: { id: entityId },
    data: { memoryJson: JSON.stringify(memories) },
  });
}
