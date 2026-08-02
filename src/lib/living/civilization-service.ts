/**
 * v0.51 Living Civilizations — Time Engine + Event Generator + Seasons + Feed + Missions
 * ---------------------------------------------------------------------------------------
 * The missing primitive: TIME.
 *
 * This is what makes a player return tomorrow and discover
 * the universe moved without them.
 *
 * Every civilization gets a clock. Time advances in ticks.
 * Each tick: season progresses, population changes, economy shifts,
 * events fire, feed items are generated, missions update.
 *
 * "I entered Farm Kingdom yesterday, and something changed when I came back today."
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';

// ─── Seasons ───────────────────────────────────────────────────────────────

export const SEASONS = {
  spring: {
    label: 'Spring',
    icon: '🌱',
    theme: 'Growth',
    effects: { populationGrowth: 1.15, tradeBonus: 1.0, eventChance: 0.3, missionType: 'community' },
    description: 'A time of growth and new beginnings. Population booms.',
  },
  summer: {
    label: 'Summer',
    icon: '☀️',
    theme: 'Expansion',
    effects: { populationGrowth: 1.05, tradeBonus: 1.2, eventChance: 0.4, missionType: 'expansion' },
    description: 'Trade flourishes and civilizations expand their reach.',
  },
  autumn: {
    label: 'Autumn',
    icon: '🍂',
    theme: 'Prosperity',
    effects: { populationGrowth: 1.0, tradeBonus: 1.3, eventChance: 0.35, missionType: 'economic' },
    description: 'Harvest season. Markets are rich and festivals abound.',
  },
  winter: {
    label: 'Winter',
    icon: '❄️',
    theme: 'Challenge',
    effects: { populationGrowth: 0.95, tradeBonus: 0.9, eventChance: 0.25, missionType: 'competitive' },
    description: 'A time of trials. Resources are scarce but glory awaits the bold.',
  },
};

const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_LENGTH = 7; // 7 ticks per season

// ─── Time Engine: Advance Civilization Time ────────────────────────────────

export async function advanceTime(worldId: string, ticks: number = 1): Promise<{
  ticksAdvanced: number;
  eventsGenerated: number;
  seasonChanged: boolean;
  newSeason?: string;
  narrative: string;
}> {
  const identity = await db.worldIdentityRecord.findUnique({ where: { worldId } });
  if (!identity) throw new Error('Civilization not found');

  let eventsGenerated = 0;
  let seasonChanged = false;
  let newSeason: string | undefined;
  const narratives: string[] = [];

  // Get current tick count
  const lastTick = await db.civilizationTickRecord.findFirst({
    where: { worldId },
    orderBy: { tickNumber: 'desc' },
  });
  let currentTick = lastTick?.tickNumber ?? 0;
  let currentSeason = lastTick?.season ?? 'spring';
  let seasonDay = lastTick?.seasonDay ?? 1;

  for (let i = 0; i < ticks; i++) {
    currentTick++;
    seasonDay++;

    // Check for season change
    if (seasonDay > SEASON_LENGTH) {
      seasonDay = 1;
      const currentIdx = SEASON_ORDER.indexOf(currentSeason);
      const nextIdx = (currentIdx + 1) % SEASON_ORDER.length;
      currentSeason = SEASON_ORDER[nextIdx];
      seasonChanged = true;
      newSeason = currentSeason;

      // Record season change
      await db.civilizationSeasonRecord.updateMany({
        where: { worldId, isActive: true },
        data: { isActive: false, endDate: new Date() },
      });

      const year = Math.floor(currentTick / (SEASON_LENGTH * 4)) + 1;
      await db.civilizationSeasonRecord.create({
        data: {
          worldId,
          worldName: identity.worldName,
          season: currentSeason,
          year,
          effects: JSON.stringify(SEASONS[currentSeason as keyof typeof SEASONS].effects),
        },
      });

      // Generate season change event
      const seasonData = SEASONS[currentSeason as keyof typeof SEASONS];
      await generateFeedItem({
        worldId,
        worldName: identity.worldName,
        type: 'season',
        title: `${seasonData.icon} ${identity.worldName} enters ${seasonData.label}`,
        body: `${seasonData.description} The civilization enters the ${seasonData.theme} phase.`,
        icon: seasonData.icon,
        impact: JSON.stringify({ season: currentSeason, effects: seasonData.effects }),
        isGlobal: true,
        tickNumber: currentTick,
      });
      eventsGenerated++;

      // Generate a new mission for the season
      await generateSeasonalMission(worldId, identity.worldName, currentSeason, currentTick);

      narratives.push(`${seasonData.label} has arrived. ${seasonData.description}`);
    }

    // Calculate state changes
    const seasonEffects = SEASONS[currentSeason as keyof typeof SEASONS].effects;
    const popBefore = identity.population;
    const popGrowth = Math.floor(popBefore * (seasonEffects.populationGrowth - 1) * 0.1) + Math.floor(Math.random() * 3);
    const popAfter = Math.max(0, popBefore + popGrowth);
    const economyChange = Math.floor(Math.random() * 500_000 * seasonEffects.tradeBonus);
    const influenceChange = Math.floor(Math.random() * 5) + 1;

    // Update world identity
    await db.worldIdentityRecord.update({
      where: { worldId },
      data: {
        population: popAfter,
        influenceScore: Math.min(100, identity.influenceScore + influenceChange),
      },
    });

    // ── v0.52: Update living economy ──────────────────────────────────
    const { updateResourcesOnTick, initializeResources, initializeBuildings, checkBuildingUnlocks } = await import('./economy-service');

    // Ensure resources + buildings exist
    await initializeResources(worldId, identity.worldName).catch(() => {});
    await initializeBuildings(worldId, identity.worldName).catch(() => {});

    // Update resources (supply, demand, prices) based on new population
    const { priceChanges } = await updateResourcesOnTick(worldId, identity.worldName, currentTick, popAfter).catch(() => ({ priceChanges: [] }));

    // Check for building unlocks based on new population
    const unlockedBuildings = await checkBuildingUnlocks(worldId, identity.worldName, popAfter, currentTick).catch(() => []);
    const buildingConfigModule = await import('./economy-service');
    const BT = (buildingConfigModule as any).BUILDING_TYPES ?? {};
    for (const buildingType of unlockedBuildings) {
      const config = BT[buildingType];
      if (config) {
        await generateFeedItem({
          worldId, worldName: identity.worldName, type: 'economy',
          title: `🏗️ New Building: ${config.name}`,
          body: `A ${config.name} has been constructed! Population reached ${popAfter}, unlocking this building.`,
          icon: config.icon,
          impact: JSON.stringify({ economy: +5 }),
          isGlobal: false,
          tickNumber: currentTick,
        });
      }
    }

    // Generate economy events for significant price changes
    const { RESOURCE_TYPES } = await import('./economy-service');
    for (const change of priceChanges) {
      if (Math.abs(change.change) > 15) {
        const direction = change.change > 0 ? 'surge' : 'drop';
        const resourceConfig = RESOURCE_TYPES[change.resource as keyof typeof RESOURCE_TYPES];
        await generateFeedItem({
          worldId, worldName: identity.worldName, type: 'economy',
          title: `${resourceConfig?.icon ?? '📊'} ${resourceConfig?.label ?? change.resource} price ${direction}`,
          body: `${resourceConfig?.label ?? change.resource} price ${change.change > 0 ? 'rose' : 'fell'} ${Math.abs(change.change)}% to ${(change.newPrice / 1_000_000).toFixed(2)}L per unit.`,
          icon: change.change > 0 ? '📈' : '📉',
          impact: JSON.stringify({ economy: change.change }),
          isGlobal: false,
          tickNumber: currentTick,
        });
      }
    }

    // Generate events based on state
    const tickEvents = await generateStateEvents(worldId, identity.worldName, {
      tick: currentTick,
      season: currentSeason,
      seasonDay,
      popBefore,
      popAfter,
      economyChange,
      influenceChange,
      eventChance: seasonEffects.eventChance,
    });
    eventsGenerated += tickEvents;

    // Update mission progress
    await updateMissionProgress(worldId, {
      population: popAfter,
      economyChange,
      influence: influenceChange,
    });

    // Generate narrative
    const narrative = await generateTickNarrative({
      worldName: identity.worldName,
      tick: currentTick,
      season: currentSeason,
      seasonDay,
      popBefore,
      popAfter,
      economyChange,
      eventsGenerated: tickEvents,
    });
    narratives.push(narrative);

    // Record the tick
    await db.civilizationTickRecord.create({
      data: {
        worldId,
        worldName: identity.worldName,
        tickNumber: currentTick,
        season: currentSeason,
        seasonDay,
        populationBefore: popBefore,
        populationAfter: popAfter,
        economyChange,
        influenceChange,
        eventsGenerated: tickEvents,
        narrative,
      },
    });

    // Update identity for next iteration
    identity.population = popAfter;
    identity.influenceScore = Math.min(100, identity.influenceScore + influenceChange);
  }

  // Also record in the multiverse chronicle
  const { recordCivEvent } = await import('@/lib/multiverse/multiverse-service');
  if (seasonChanged && newSeason) {
    await recordCivEvent(worldId, identity.worldName, 'GOLDEN_AGE',
      `${identity.worldName} enters ${SEASONS[newSeason as keyof typeof SEASONS].label}`,
      narratives.join(' '),
      SEASONS[newSeason as keyof typeof SEASONS].icon,
    );
  }

  return {
    ticksAdvanced: ticks,
    eventsGenerated,
    seasonChanged,
    newSeason,
    narrative: narratives.join('\n\n'),
  };
}

// ─── Event Generator ───────────────────────────────────────────────────────

async function generateStateEvents(worldId: string, worldName: string, ctx: {
  tick: number;
  season: string;
  seasonDay: number;
  popBefore: number;
  popAfter: number;
  economyChange: number;
  influenceChange: number;
  eventChance: number;
}): Promise<number> {
  let count = 0;

  // Population milestone events
  if (ctx.popAfter >= 50 && ctx.popBefore < 50) {
    await generateFeedItem({
      worldId, worldName, type: 'population',
      title: `${worldName} reaches 50 citizens!`,
      body: `The civilization has grown to 50 citizens. A new district is founded.`,
      icon: '🏘️',
      impact: JSON.stringify({ population: +5, influence: +3 }),
      isGlobal: true,
      tickNumber: ctx.tick,
    });
    count++;
  }

  if (ctx.popAfter >= 100 && ctx.popBefore < 100) {
    await generateFeedItem({
      worldId, worldName, type: 'population',
      title: `${worldName} reaches 100 citizens!`,
      body: `A milestone! The civilization is now a Town. The people celebrate with a festival.`,
      icon: '🏛️',
      impact: JSON.stringify({ population: +10, influence: +5 }),
      isGlobal: true,
      tickNumber: ctx.tick,
    });
    count++;
  }

  if (ctx.popAfter >= 500 && ctx.popBefore < 500) {
    await generateFeedItem({
      worldId, worldName, type: 'population',
      title: `${worldName} reaches 500 citizens!`,
      body: `The civilization has become a City. Trade routes expand and culture flourishes.`,
      icon: '🌆',
      impact: JSON.stringify({ population: +20, influence: +10 }),
      isGlobal: true,
      tickNumber: ctx.tick,
    });
    count++;
  }

  // Economy events
  if (ctx.economyChange > 400_000) {
    const events = [
      { title: `Golden Trade Era in ${worldName}`, body: `Trade volume surged! Merchants report record profits.`, icon: '💰' },
      { title: `Market Boom in ${worldName}`, body: `The marketplace is bustling. New trade routes discovered.`, icon: '📈' },
      { title: `Merchant Guild Expands in ${worldName}`, body: `The Merchant Guild has opened new branches across the world.`, icon: '🏪' },
    ];
    const evt = events[Math.floor(Math.random() * events.length)];
    await generateFeedItem({
      worldId, worldName, type: 'economy',
      title: evt.title, body: evt.body, icon: evt.icon,
      impact: JSON.stringify({ economy: +5 }),
      isGlobal: true,
      tickNumber: ctx.tick,
    });
    count++;
  }

  // Random cultural events
  if (Math.random() < ctx.eventChance) {
    const culturalEvents = [
      { title: `Art Festival in ${worldName}`, body: `Citizens organized an impromptu art festival. Culture flourishes.`, icon: '🎨', type: 'culture' },
      { title: `New Discovery in ${worldName}`, body: `Scholars discovered a new technique. Knowledge spreads.`, icon: '🔬', type: 'discovery' },
      { title: `Legendary Forge in ${worldName}`, body: `A blacksmith forged a legendary item. It enters civilization history.`, icon: '⚒️', type: 'achievement' },
      { title: `Migration Wave to ${worldName}`, body: `Travelers from distant worlds arrived seeking a new home.`, icon: '🚶', type: 'migration' },
      { title: `Cultural Renaissance in ${worldName}`, body: `An age of creativity begins. Artists and thinkers thrive.`, icon: '🎭', type: 'culture' },
      { title: `Ancient Ruins Found in ${worldName}`, body: `Explorers discovered ruins from an earlier era. Mystery deepens.`, icon: '🏛️', type: 'discovery' },
    ];
    const evt = culturalEvents[Math.floor(Math.random() * culturalEvents.length)];
    await generateFeedItem({
      worldId, worldName,
      type: evt.type,
      title: evt.title,
      body: evt.body,
      icon: evt.icon,
      impact: JSON.stringify({ influence: +2 }),
      isGlobal: Math.random() > 0.5,
      tickNumber: ctx.tick,
    });
    count++;
  }

  return count;
}

// ─── Feed ──────────────────────────────────────────────────────────────────

async function generateFeedItem(params: {
  worldId: string;
  worldName: string;
  type: string;
  title: string;
  body: string;
  icon: string;
  impact: string;
  isGlobal: boolean;
  tickNumber: number;
}): Promise<void> {
  await db.civilizationFeedItemRecord.create({
    data: {
      worldId: params.worldId,
      worldName: params.worldName,
      type: params.type,
      title: params.title,
      body: params.body,
      icon: params.icon,
      impact: params.impact,
      isGlobal: params.isGlobal,
      tickNumber: params.tickNumber,
    },
  });

  // Also record in the multiverse chronicle for global events
  if (params.isGlobal) {
    const { recordCivEvent } = await import('@/lib/multiverse/multiverse-service');
    await recordCivEvent(
      params.worldId,
      params.worldName,
      'CULTURAL_RENAISSANCE',
      params.title,
      params.body,
      params.icon,
    );
  }
}

export async function getCivilizationFeed(worldId: string, limit = 30): Promise<any[]> {
  const items = await db.civilizationFeedItemRecord.findMany({
    where: { worldId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return items.map((i) => ({
    id: i.id,
    type: i.type,
    title: i.title,
    body: i.body,
    icon: i.icon,
    impact: JSON.parse(i.impact),
    isGlobal: i.isGlobal,
    tickNumber: i.tickNumber,
    createdAt: i.createdAt.getTime(),
  }));
}

export async function getGlobalFeed(limit = 30): Promise<any[]> {
  const items = await db.civilizationFeedItemRecord.findMany({
    where: { isGlobal: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return items.map((i) => ({
    id: i.id,
    worldName: i.worldName,
    type: i.type,
    title: i.title,
    body: i.body,
    icon: i.icon,
    impact: JSON.parse(i.impact),
    createdAt: i.createdAt.getTime(),
  }));
}

// ─── Missions ──────────────────────────────────────────────────────────────

const SEASONAL_MISSIONS: Record<string, Array<{
  title: string;
  description: string;
  icon: string;
  type: string;
  goalType: string;
  goalTarget: number;
  rewardType: string;
  rewardAmount: number;
  rewardDescription: string;
}>> = {
  spring: [
    { title: 'Build the Grand Garden', description: 'Grow the civilization to 150 citizens through spring growth.', icon: '🌷', type: 'community', goalType: 'population', goalTarget: 150, rewardType: 'influence', rewardAmount: 10, rewardDescription: '+10 Influence and a new garden district' },
    { title: 'Spring Exploration', description: 'Discover 3 new events this season.', icon: '🧭', type: 'expansion', goalType: 'events', goalTarget: 3, rewardType: 'population', rewardAmount: 20, rewardDescription: '+20 citizens from exploration' },
  ],
  summer: [
    { title: 'Establish Trade Routes', description: 'Generate 2,000,000 micro-Liquid in trade this season.', icon: '🗺️', type: 'expansion', goalType: 'tradeVolume', goalTarget: 2_000_000, rewardType: 'economy', rewardAmount: 500_000, rewardDescription: '+500K micro-Liquid economic boost' },
    { title: 'Summer Migration', description: 'Attract 10 new visitors this season.', icon: '🚶', type: 'expansion', goalType: 'citizens', goalTarget: 10, rewardType: 'population', rewardAmount: 15, rewardDescription: '+15 citizens from migration' },
  ],
  autumn: [
    { title: 'Harvest Festival', description: 'Generate 3,000,000 micro-Liquid in trade during harvest.', icon: '🌾', type: 'economic', goalType: 'tradeVolume', goalTarget: 3_000_000, rewardType: 'economy', rewardAmount: 1_000_000, rewardDescription: 'Grand Harvest Festival unlocks +1M economy boost' },
    { title: 'Cultural Exchange', description: 'Host 5 cultural events this season.', icon: '🎭', type: 'cultural', goalType: 'events', goalTarget: 5, rewardType: 'influence', rewardAmount: 15, rewardDescription: '+15 Influence and cultural recognition' },
  ],
  winter: [
    { title: 'Winter Tournament', description: 'Maintain population above 80 during the harsh winter.', icon: ' ⚔️', type: 'competitive', goalType: 'population', goalTarget: 80, rewardType: 'influence', rewardAmount: 20, rewardDescription: '+20 Influence for surviving the winter' },
    { title: 'Strategic Reserve', description: 'Accumulate 1,500,000 micro-Liquid in trade.', icon: '🏦', type: 'economic', goalType: 'tradeVolume', goalTarget: 1_500_000, rewardType: 'economy', rewardAmount: 750_000, rewardDescription: '+750K economic reserve for next spring' },
  ],
};

async function generateSeasonalMission(worldId: string, worldName: string, season: string, tick: number): Promise<void> {
  const missions = SEASONAL_MISSIONS[season];
  if (!missions || missions.length === 0) return;

  const mission = missions[Math.floor(Math.random() * missions.length)];

  // Check if mission already exists for this season
  const existing = await db.civilizationMissionRecord.findFirst({
    where: { worldId, season, status: 'ACTIVE' },
  });
  if (existing) return;

  await db.civilizationMissionRecord.create({
    data: {
      worldId,
      worldName,
      title: mission.title,
      description: mission.description,
      icon: mission.icon,
      type: mission.type,
      goalType: mission.goalType,
      goalTarget: mission.goalTarget,
      goalCurrent: 0,
      rewardType: mission.rewardType,
      rewardAmount: mission.rewardAmount,
      rewardDescription: mission.rewardDescription,
      status: 'ACTIVE',
      season,
    },
  });

  await generateFeedItem({
    worldId, worldName, type: 'mission',
    title: `New Mission: ${mission.title}`,
    body: mission.description,
    icon: mission.icon,
    impact: JSON.stringify({ mission: mission.title }),
    isGlobal: false,
    tickNumber: tick,
  });
}

export async function getMissions(worldId: string): Promise<any[]> {
  const missions = await db.civilizationMissionRecord.findMany({
    where: { worldId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  return missions.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    icon: m.icon,
    type: m.type,
    goalType: m.goalType,
    goalTarget: m.goalTarget,
    goalCurrent: m.goalCurrent,
    rewardDescription: m.rewardDescription,
    status: m.status,
    season: m.season,
    progress: Math.min(100, Math.round((m.goalCurrent / m.goalTarget) * 100)),
    createdAt: m.createdAt.getTime(),
  }));
}

async function updateMissionProgress(worldId: string, changes: {
  population: number;
  economyChange: number;
  influence: number;
}): Promise<void> {
  const missions = await db.civilizationMissionRecord.findMany({
    where: { worldId, status: 'ACTIVE' },
  });

  for (const mission of missions) {
    let progress = mission.goalCurrent;

    if (mission.goalType === 'population') {
      progress = Math.max(progress, changes.population);
    } else if (mission.goalType === 'tradeVolume') {
      progress += changes.economyChange;
    } else if (mission.goalType === 'influence') {
      progress += changes.influence;
    }

    // Check completion
    if (progress >= mission.goalTarget) {
      await db.civilizationMissionRecord.update({
        where: { id: mission.id },
        data: { goalCurrent: progress, status: 'COMPLETED', completedAt: new Date() },
      });

      // Generate completion feed item
      await generateFeedItem({
        worldId,
        worldName: mission.worldName,
        type: 'mission',
        title: `✅ Mission Complete: ${mission.title}`,
        body: `${mission.title} has been completed! ${mission.rewardDescription}.`,
        icon: mission.icon,
        impact: JSON.stringify({ [mission.rewardType]: mission.rewardAmount }),
        isGlobal: true,
        tickNumber: 0,
      });

      // Apply reward
      const identity = await db.worldIdentityRecord.findUnique({ where: { worldId } });
      if (identity) {
        if (mission.rewardType === 'influence') {
          await db.worldIdentityRecord.update({
            where: { worldId },
            data: { influenceScore: Math.min(100, identity.influenceScore + mission.rewardAmount) },
          });
        } else if (mission.rewardType === 'population') {
          await db.worldIdentityRecord.update({
            where: { worldId },
            data: { population: identity.population + mission.rewardAmount },
          });
        }
      }
    } else {
      await db.civilizationMissionRecord.update({
        where: { id: mission.id },
        data: { goalCurrent: progress },
      });
    }
  }
}

// ─── Narrative Generator ───────────────────────────────────────────────────

async function generateTickNarrative(ctx: {
  worldName: string;
  tick: number;
  season: string;
  seasonDay: number;
  popBefore: number;
  popAfter: number;
  economyChange: number;
  eventsGenerated: number;
}): Promise<string> {
  const popDelta = ctx.popAfter - ctx.popBefore;
  const seasonData = SEASONS[ctx.season as keyof typeof SEASONS];

  let narrative = `Day ${ctx.tick} (${seasonData.icon} ${seasonData.label}, Day ${ctx.seasonDay}): `;

  if (popDelta > 0) {
    narrative += `Population grew by ${popDelta} to ${ctx.popAfter}. `;
  } else if (popDelta < 0) {
    narrative += `Population decreased by ${Math.abs(popDelta)} to ${ctx.popAfter}. `;
  } else {
    narrative += `Population stable at ${ctx.popAfter}. `;
  }

  if (ctx.economyChange > 0) {
    narrative += `Trade generated ${(ctx.economyChange / 1_000_000).toFixed(1)} Liquid. `;
  }

  if (ctx.eventsGenerated > 0) {
    narrative += `${ctx.eventsGenerated} event${ctx.eventsGenerated > 1 ? 's' : ''} occurred. `;
  }

  return narrative.trim();
}

// ─── Timeline ──────────────────────────────────────────────────────────────

export async function getTimeline(worldId: string, limit = 30): Promise<any[]> {
  const ticks = await db.civilizationTickRecord.findMany({
    where: { worldId },
    orderBy: { tickNumber: 'desc' },
    take: limit,
  });
  return ticks.map((t) => ({
    id: t.id,
    tickNumber: t.tickNumber,
    season: t.season,
    seasonDay: t.seasonDay,
    populationBefore: t.populationBefore,
    populationAfter: t.populationAfter,
    economyChange: t.economyChange,
    influenceChange: t.influenceChange,
    eventsGenerated: t.eventsGenerated,
    narrative: t.narrative,
    timestamp: t.timestamp.getTime(),
  }));
}

// ─── Current Season ────────────────────────────────────────────────────────

export async function getCurrentSeason(worldId: string): Promise<any | null> {
  const season = await db.civilizationSeasonRecord.findFirst({
    where: { worldId, isActive: true },
  });
  if (!season) return null;
  const seasonKey = season.season as keyof typeof SEASONS;
  const seasonData = SEASONS[seasonKey];
  return {
    season: season.season,
    label: seasonData?.label ?? season.season,
    icon: seasonData?.icon ?? '🌍',
    year: season.year,
    effects: seasonData?.effects ?? {},
    description: seasonData?.description ?? '',
  };
}

// ─── "What Changed" (the key feature) ──────────────────────────────────────

export async function getWhatChanged(worldId: string, sinceHours: number = 24): Promise<{
  newEvents: any[];
  populationChange: number;
  economyChange: number;
  newMissions: any[];
  completedMissions: any[];
  seasonChanged: boolean;
  summary: string;
}> {
  const since = new Date(Date.now() - sinceHours * 3600000);

  const [feedItems, ticks, missions, completedMissions] = await Promise.all([
    db.civilizationFeedItemRecord.findMany({
      where: { worldId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    }),
    db.civilizationTickRecord.findMany({
      where: { worldId, timestamp: { gte: since } },
      orderBy: { tickNumber: 'desc' },
    }),
    db.civilizationMissionRecord.findMany({
      where: { worldId, status: 'ACTIVE', createdAt: { gte: since } },
    }),
    db.civilizationMissionRecord.findMany({
      where: { worldId, status: 'COMPLETED', completedAt: { gte: since } },
    }),
  ]);

  const populationChange = ticks.reduce((sum, t) => sum + (t.populationAfter - t.populationBefore), 0);
  const economyChange = ticks.reduce((sum, t) => sum + t.economyChange, 0);
  const seasonChanged = ticks.some((t, i, arr) => i > 0 && t.season !== arr[i - 1]?.season);

  // Generate summary
  const parts: string[] = [];
  if (populationChange !== 0) parts.push(`population ${populationChange > 0 ? 'grew' : 'changed'} by ${Math.abs(populationChange)}`);
  if (economyChange > 0) parts.push(`trade generated ${(economyChange / 1_000_000).toFixed(1)} Liquid`);
  if (feedItems.length > 0) parts.push(`${feedItems.length} events occurred`);
  if (completedMissions.length > 0) parts.push(`${completedMissions.length} mission${completedMissions.length > 1 ? 's' : ''} completed`);
  if (seasonChanged) parts.push('the season changed');

  const summary = parts.length > 0
    ? `While you were away: ${parts.join(', ')}.`
    : 'Nothing significant changed while you were away.';

  return {
    newEvents: feedItems.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      body: i.body,
      icon: i.icon,
      createdAt: i.createdAt.getTime(),
    })),
    populationChange,
    economyChange,
    newMissions: missions.map((m) => ({ id: m.id, title: m.title, icon: m.icon })),
    completedMissions: completedMissions.map((m) => ({ id: m.id, title: m.title, icon: m.icon })),
    seasonChanged,
    summary,
  };
}
