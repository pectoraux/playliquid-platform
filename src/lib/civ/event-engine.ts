/**
 * Civilization Engine — Emergent Events Engine
 * ---------------------------------------------
 * Generates events from world state. Events emerge from:
 *   - Resource scarcity/surplus
 *   - Economic conditions (price spikes, crashes)
 *   - Social conditions (population growth, mood extremes)
 *   - Random world occurrences
 *
 * Uses LLM to generate narrative descriptions. Events have real effects
 * on world state (resource changes, price changes, mood shifts).
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import type { WorldMacroState, WorldEvent } from '@/kernel/types';

const EVENT_TRIGGERS: Array<{
  id: string;
  name: string;
  type: WorldEvent['type'];
  condition: (state: WorldMacroState, tick: number) => boolean;
  effects: (state: WorldMacroState) => WorldEvent['effects'];
  story: (state: WorldMacroState) => string;
}> = [
  {
    id: 'drought',
    name: 'Great Drought',
    type: 'environmental',
    condition: (s) => (s.resources.WATER ?? 0) < 200,
    effects: (s) => ({
      resourceChanges: { WATER: -100, CORN: -50 },
      priceChanges: { WATER: 3, CORN: 2 },
      moodChange: -15,
      affectedEntities: [],
    }),
    story: (s) => `A severe drought struck the land. Water reserves dropped to ${s.resources.WATER ?? 0}. Crop yields suffered. Citizens grow anxious.`,
  },
  {
    id: 'bumper-harvest',
    name: 'Bumper Harvest',
    type: 'economic',
    condition: (s) => (s.resources.CORN ?? 0) > 1500,
    effects: (s) => ({
      resourceChanges: { CORN: 200 },
      priceChanges: { CORN: -0.5 },
      moodChange: 10,
      affectedEntities: [],
    }),
    story: (s) => `An unprecedented harvest! Corn reserves reached ${s.resources.CORN ?? 0}. Prices dropped as supply flooded the market. Celebrations spread across the world.`,
  },
  {
    id: 'gold-rush',
    name: 'Gold Rush',
    type: 'discovery',
    condition: (s, t) => t > 50 && t < 400 && Math.random() < 0.1,
    effects: (s) => ({
      resourceChanges: { GOLD: 50 },
      priceChanges: { GOLD: -2 },
      moodChange: 20,
      affectedEntities: [],
    }),
    story: () => `Prospectors discovered a new gold vein! The rush is on — citizens flock to mine the precious metal. Fortunes will be made.`,
  },
  {
    id: 'festival',
    name: 'Harvest Festival',
    type: 'social',
    condition: (s) => s.mood > 30 && Math.random() < 0.15,
    effects: (s) => ({
      resourceChanges: { CORN: -30, REPUTATION: 20 },
      priceChanges: {},
      moodChange: 15,
      affectedEntities: [],
    }),
    story: () => `The citizens organized a grand Harvest Festival! Food was shared, friendships deepened, and the community grew stronger. Reputation increased across the world.`,
  },
  {
    id: 'market-crash',
    name: 'Market Crash',
    type: 'crisis',
    condition: (s) => s.mood < -30 && Math.random() < 0.2,
    effects: (s) => {
      const priceChanges: Record<string, number> = {};
      for (const r of Object.keys(s.prices)) priceChanges[r] = -0.3;
      return {
        resourceChanges: {},
        priceChanges,
        moodChange: -10,
        affectedEntities: [],
      };
    },
    story: () => `Panic swept through the markets! Prices crashed as citizens rushed to liquidate assets. The economy is in turmoil.`,
  },
  {
    id: 'innovation',
    name: 'Agricultural Innovation',
    type: 'discovery',
    condition: (_s, t) => t > 100 && t % 200 === 0,
    effects: () => ({
      resourceChanges: { CORN: 100, REPUTATION: 10 },
      priceChanges: { CORN: -0.3 },
      moodChange: 5,
      affectedEntities: [],
    }),
    story: () => `A breakthrough in farming techniques! Citizens developed new irrigation methods, boosting crop yields for seasons to come.`,
  },
  {
    id: 'tournament',
    name: 'Founder\'s Tournament',
    type: 'competitive',
    condition: (s, t) => t > 30 && s.population > 20 && Math.random() < 0.08,
    effects: () => ({
      resourceChanges: { REPUTATION: 15 },
      priceChanges: {},
      moodChange: 10,
      affectedEntities: [],
    }),
    story: () => `The Founder's Tournament begins! Citizens compete for glory and reputation. The arena is alive with excitement.`,
  },
];

/**
 * Check for and generate an emergent event.
 */
export async function generateEmergentEvent(
  worldId: string,
  tick: number,
  state: WorldMacroState,
  useLLM: boolean,
): Promise<WorldEvent | null> {
  // Find a triggered event
  const triggered = EVENT_TRIGGERS.find((t) => {
    try {
      return t.condition(state, tick);
    } catch {
      return false;
    }
  });

  if (!triggered) return null;

  // Check we haven't fired this event recently
  const recent = await db.worldEventRecord.findFirst({
    where: { worldId, name: triggered.name, tick: { gte: tick - 30 } },
  });
  if (recent) return null;

  const effects = triggered.effects(state);
  let storyText = triggered.story(state);

  // Use LLM to enhance the story if enabled
  if (useLLM) {
    const enhanced = await enhanceEventStory(triggered.name, triggered.type, state, storyText);
    if (enhanced) storyText = enhanced;
  }

  // Apply effects to world state
  applyEffects(state, effects);

  // Distribute rewards (mood-based)
  const rewards: Record<string, number> = {};
  if (effects.moodChange > 0) {
    // Reward all alive entities with a small bonus
    const entities = await db.worldEntityRecord.findMany({
      where: { worldId, alive: true },
      select: { id: true },
    });
    const rewardPerEntity = Math.floor(5_000); // 0.005 Liquid each
    for (const e of entities.slice(0, 10)) {  // cap at 10 for ledger size
      rewards[e.id] = rewardPerEntity;
    }
    // Post rewards via ledger
    if (Object.keys(rewards).length > 0) {
      const totalReward = Object.values(rewards).reduce((s, n) => s + n, 0);
      const lines: Array<{ account: string; debit: number; credit: number; memo?: string }> = [
        { account: `world:${worldId}:treasury`, debit: 0, credit: totalReward, memo: `${triggered.name} rewards` },
      ];
      for (const [entityId, amount] of Object.entries(rewards)) {
        lines.push({ account: `entity:${entityId}:wallet`, debit: amount, credit: 0, memo: 'event reward' });
      }
      await ledger.post(lines, `event: ${triggered.name}`).catch(() => {});
    }
  }

  // Persist the event
  const record = await db.worldEventRecord.create({
    data: {
      worldId,
      name: triggered.name,
      description: triggered.type,
      type: triggered.type,
      tick,
      effectsJson: JSON.stringify(effects),
      rewardsJson: JSON.stringify(rewards),
      storyText,
    },
  });

  // Record in history
  await db.worldHistoryRecord.create({
    data: {
      worldId,
      tick,
      type: triggered.type === 'crisis' ? 'crisis' : triggered.type === 'discovery' ? 'discovery' : 'event',
      title: triggered.name,
      narrative: storyText,
    },
  });

  return {
    id: record.id,
    worldId,
    name: triggered.name,
    description: triggered.type,
    type: triggered.type,
    tick,
    effects,
    rewards: Object.keys(rewards).length > 0 ? rewards : undefined,
    storyText,
  };
}

/**
 * Apply event effects to macro state.
 */
function applyEffects(state: WorldMacroState, effects: WorldEvent['effects']): void {
  for (const [resource, delta] of Object.entries(effects.resourceChanges)) {
    state.resources[resource] = Math.max(0, (state.resources[resource] ?? 0) + delta);
  }
  for (const [resource, delta] of Object.entries(effects.priceChanges)) {
    state.prices[resource] = Math.max(0.1, (state.prices[resource] ?? 1) + delta);
  }
  state.mood = Math.max(-100, Math.min(100, state.mood + effects.moodChange));
}

/**
 * Use LLM to enhance the event narrative.
 */
async function enhanceEventStory(
  eventName: string,
  eventType: string,
  state: WorldMacroState,
  baseStory: string,
): Promise<string | null> {
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are the storyteller of a living simulation world. Enhance this event narrative with vivid, immersive detail. Keep it under 2 sentences. Do not add markdown.`,
        },
        {
          role: 'user',
          content: `Event: ${eventName} (${eventType})
World state: mood=${Math.round(state.mood)}, population=${state.population}
Base story: ${baseStory}

Write an enhanced version:`,
        },
      ],
      thinking: { type: 'disabled' },
    });
    return completion.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * Get events for a world.
 */
export async function getWorldEvents(worldId: string, limit = 20): Promise<WorldEvent[]> {
  const records = await db.worldEventRecord.findMany({
    where: { worldId },
    orderBy: { tick: 'desc' },
    take: limit,
  });
  return records.map((r) => ({
    id: r.id,
    worldId: r.worldId,
    name: r.name,
    description: r.description,
    type: r.type as WorldEvent['type'],
    tick: r.tick,
    effects: JSON.parse(r.effectsJson),
    rewards: r.rewardsJson && r.rewardsJson !== '{}' ? JSON.parse(r.rewardsJson) : undefined,
    storyText: r.storyText,
  }));
}
