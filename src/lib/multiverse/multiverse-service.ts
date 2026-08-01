/**
 * v0.50 Multiverse — Civilization Network Service
 * -----------------------------------------------
 * Worlds become interoperable civilizations with identity, diplomacy,
 * migration, trade, and AI governance.
 *
 * This is NOT a transport layer. It's a civilization layer.
 * Transport is how players move. Civilization is why they move.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import { ACCOUNTS } from '@/kernel/ledger';

// ─── World Identity ────────────────────────────────────────────────────────

const CIV_LEVELS = [
  { level: 'settlement', label: 'Settlement', icon: '⛺', minPop: 0 },
  { level: 'village', label: 'Village', icon: '🏘️', minPop: 10 },
  { level: 'town', label: 'Town', icon: '🏛️', minPop: 50 },
  { level: 'city', label: 'City', icon: '🌆', minPop: 200 },
  { level: 'metropolis', label: 'Metropolis', icon: '🌃', minPop: 1000 },
  { level: 'empire', label: 'Empire', icon: '👑', minPop: 5000 },
];

export async function ensureWorldIdentity(worldId: string, worldName: string, founderId: string, founderName: string): Promise<string> {
  const existing = await db.worldIdentityRecord.findUnique({ where: { worldId } });
  if (existing) return existing.id;

  const identity = await db.worldIdentityRecord.create({
    data: {
      worldId,
      worldName,
      founderId,
      founderName,
      civilizationLevel: 'settlement',
      cultureDNA: JSON.stringify({ agriculture: 30, trade: 20, combat: 10, knowledge: 15, art: 10, community: 25 }),
      economyDNA: JSON.stringify({ currency: 'Liquid', tradeVolume: 0, gdp: 0 }),
      governanceDNA: JSON.stringify({ type: 'creator', stability: 60, participation: 30 }),
      era: 'founding',
    },
  });

  // Record founding event
  await db.civilizationEventRecord.create({
    data: {
      worldId,
      worldName,
      eventType: 'WORLD_FOUNDED',
      title: `${worldName} Founded`,
      narrative: `The civilization of ${worldName} was established by ${founderName}. A new world joins the Multiverse.`,
      icon: '🌅',
      impact: JSON.stringify({ influence: +10 }),
      isGlobal: true,
    },
  });

  // Create AI Council
  await db.worldAICouncilRecord.create({
    data: { worldId, worldName },
  });

  return identity.id;
}

export async function getWorldIdentity(worldId: string): Promise<any | null> {
  const identity = await db.worldIdentityRecord.findUnique({ where: { worldId } });
  if (!identity) return null;

  const civLevel = CIV_LEVELS.find((c) => c.level === identity.civilizationLevel) ?? CIV_LEVELS[0];

  return {
    id: identity.id,
    worldId: identity.worldId,
    worldName: identity.worldName,
    founderId: identity.founderId,
    founderName: identity.founderName,
    civilizationLevel: identity.civilizationLevel,
    civilizationLabel: civLevel.label,
    civilizationIcon: civLevel.icon,
    population: identity.population,
    influenceScore: identity.influenceScore,
    cultureDNA: JSON.parse(identity.cultureDNA),
    economyDNA: JSON.parse(identity.economyDNA),
    governanceDNA: JSON.parse(identity.governanceDNA),
    era: identity.era,
    visitors: identity.visitors,
    citizens: identity.citizens,
    alliancesCount: identity.alliancesCount,
    rivalriesCount: identity.rivalriesCount,
    createdAt: identity.createdAt.getTime(),
  };
}

export async function getAllCivilizations(): Promise<any[]> {
  const identities = await db.worldIdentityRecord.findMany({
    orderBy: { influenceScore: 'desc' },
  });

  return identities.map((identity) => {
    const civLevel = CIV_LEVELS.find((c) => c.level === identity.civilizationLevel) ?? CIV_LEVELS[0];
    return {
      id: identity.id,
      worldId: identity.worldId,
      worldName: identity.worldName,
      founderName: identity.founderName,
      civilizationLevel: identity.civilizationLevel,
      civilizationLabel: civLevel.label,
      civilizationIcon: civLevel.icon,
      population: identity.population,
      influenceScore: identity.influenceScore,
      era: identity.era,
      visitors: identity.visitors,
      alliancesCount: identity.alliancesCount,
      rivalriesCount: identity.rivalriesCount,
      cultureDNA: JSON.parse(identity.cultureDNA),
      createdAt: identity.createdAt.getTime(),
    };
  });
}

export async function updateWorldStats(worldId: string): Promise<void> {
  const world = await db.worldRecord.findUnique({ where: { id: worldId } });
  if (!world) return;

  const identity = await db.worldIdentityRecord.findUnique({ where: { worldId } });
  if (!identity) return;

  const population = world.population;
  const visitors = await db.worldVisitRecord.count({ where: { worldId } });
  const alliances = await db.worldRelationRecord.count({ where: { fromWorldId: worldId, status: 'ACTIVE', type: { in: ['ALLIANCE', 'TRADE_AGREEMENT'] } } });
  const rivalries = await db.worldRelationRecord.count({ where: { fromWorldId: worldId, status: 'ACTIVE', type: { in: ['COMPETITION', 'WAR'] } } });

  // Determine civilization level
  let civLevel = 'settlement';
  for (const c of CIV_LEVELS) {
    if (population >= c.minPop) civLevel = c.level;
  }

  // Determine era
  let era = 'founding';
  if (population > 100) era = 'growth';
  if (population > 500) era = 'golden';
  if (population > 1000) era = 'expansion';

  const influenceScore = Math.min(100, population * 2 + alliances * 10 + visitors);

  await db.worldIdentityRecord.update({
    where: { worldId },
    data: {
      population,
      visitors,
      citizens: population,
      alliancesCount: alliances,
      rivalriesCount: rivalries,
      civilizationLevel: civLevel,
      era,
      influenceScore,
    },
  });

  // Check for milestone events
  if (population >= 100 && identity.population < 100) {
    await recordCivEvent(worldId, world.name, 'GOLDEN_AGE', `${world.name} Enters Golden Age`, `${world.name} has reached 100 citizens. A Golden Age begins.`, '✨');
  }
}

// ─── World Diplomacy ───────────────────────────────────────────────────────

export async function formRelation(params: {
  fromWorldId: string;
  fromWorldName: string;
  toWorldId: string;
  toWorldName: string;
  type: string;
  terms?: Record<string, unknown>;
}): Promise<{ relationId: string }> {
  const relation = await db.worldRelationRecord.upsert({
    where: {
      fromWorldId_toWorldId_type: {
        fromWorldId: params.fromWorldId,
        toWorldId: params.toWorldId,
        type: params.type,
      },
    },
    create: {
      fromWorldId: params.fromWorldId,
      fromWorldName: params.fromWorldName,
      toWorldId: params.toWorldId,
      toWorldName: params.toWorldName,
      type: params.type,
      terms: JSON.stringify(params.terms ?? {}),
    },
    update: {
      status: 'ACTIVE',
      terms: JSON.stringify(params.terms ?? {}),
    },
  });

  // Update alliance/rivalry counts
  await updateWorldStats(params.fromWorldId);

  // Record event
  if (params.type === 'ALLIANCE') {
    await recordCivEvent(params.fromWorldId, params.fromWorldName, 'FIRST_ALLIANCE',
      `${params.fromWorldName} 🤝 ${params.toWorldName}`,
      `${params.fromWorldName} formed an alliance with ${params.toWorldName}. Together they strengthen the Multiverse.`,
      '🤝');
  } else if (params.type === 'TRADE_AGREEMENT') {
    await recordCivEvent(params.fromWorldId, params.fromWorldName, 'FIRST_TRADE',
      `Trade Route: ${params.fromWorldName} ↔ ${params.toWorldName}`,
      `A trade agreement was established between ${params.fromWorldName} and ${params.toWorldName}.`,
      '📦');
  }

  return { relationId: relation.id };
}

export async function getWorldRelations(worldId: string): Promise<any[]> {
  const relations = await db.worldRelationRecord.findMany({
    where: { fromWorldId: worldId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  return relations.map((r) => ({
    id: r.id,
    toWorldId: r.toWorldId,
    toWorldName: r.toWorldName,
    type: r.type,
    status: r.status,
    terms: JSON.parse(r.terms),
    strength: r.strength,
    createdAt: r.createdAt.getTime(),
  }));
}

// ─── Player Migration ──────────────────────────────────────────────────────

export async function migratePlayer(params: {
  userId: string;
  displayName: string;
  toWorldId: string;
  toWorldName: string;
  fromWorldId?: string;
  fromWorldName?: string;
  migrationType?: string;
}): Promise<{ migrationId: string }> {
  // Record the migration
  const migration = await db.worldMigrationRecord.create({
    data: {
      userId: params.userId,
      displayName: params.displayName,
      fromWorldId: params.fromWorldId,
      fromWorldName: params.fromWorldName,
      toWorldId: params.toWorldId,
      toWorldName: params.toWorldName,
      migrationType: params.migrationType ?? 'visit',
      assetsCarried: JSON.stringify([]), // would carry actual owned assets
      reputationCarried: 50, // would carry actual reputation
    },
  });

  // Update world visitor count
  await db.worldIdentityRecord.update({
    where: { worldId: params.toWorldId },
    data: { visitors: { increment: 1 } },
  }).catch(() => {});

  // Also record world visit
  const { recordWorldVisit } = await import('@/lib/identity/inventory-service');
  await recordWorldVisit({
    userId: params.userId,
    worldId: params.toWorldId,
    worldName: params.toWorldName,
  }).catch(() => {});

  return { migrationId: migration.id };
}

export async function getPlayerMigrations(userId: string): Promise<any[]> {
  const migrations = await db.worldMigrationRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return migrations.map((m) => ({
    id: m.id,
    fromWorldName: m.fromWorldName,
    toWorldId: m.toWorldId,
    toWorldName: m.toWorldName,
    migrationType: m.migrationType,
    createdAt: m.createdAt.getTime(),
  }));
}

// ─── Interworld Trade ──────────────────────────────────────────────────────

export async function executeWorldTrade(params: {
  fromWorldId: string;
  fromWorldName: string;
  toWorldId: string;
  toWorldName: string;
  resourceType: string;
  amount: number;  // micro-Liquid
  assetName?: string;
}): Promise<{ tradeId: string }> {
  // Record the trade
  const trade = await db.worldTradeRecord.create({
    data: {
      fromWorldId: params.fromWorldId,
      fromWorldName: params.fromWorldName,
      toWorldId: params.toWorldId,
      toWorldName: params.toWorldName,
      resourceType: params.resourceType,
      amount: params.amount,
      assetName: params.assetName,
      tradeType: 'export',
    },
  });

  // Update economy DNA
  const fromIdentity = await db.worldIdentityRecord.findUnique({ where: { worldId: params.fromWorldId } });
  if (fromIdentity) {
    const economy = JSON.parse(fromIdentity.economyDNA);
    economy.tradeVolume = (economy.tradeVolume ?? 0) + params.amount;
    economy.gdp = (economy.gdp ?? 0) + params.amount;
    await db.worldIdentityRecord.update({
      where: { worldId: params.fromWorldId },
      data: { economyDNA: JSON.stringify(economy) },
    });
  }

  return { tradeId: trade.id };
}

export async function getWorldTrades(worldId: string): Promise<any[]> {
  const trades = await db.worldTradeRecord.findMany({
    where: { OR: [{ fromWorldId: worldId }, { toWorldId: worldId }] },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return trades.map((t) => ({
    id: t.id,
    fromWorldName: t.fromWorldName,
    toWorldName: t.toWorldName,
    resourceType: t.resourceType,
    amount: t.amount,
    assetName: t.assetName,
    createdAt: t.createdAt.getTime(),
  }));
}

// ─── Civilization Events / Chronicle ───────────────────────────────────────

export async function recordCivEvent(
  worldId: string | null,
  worldName: string | null,
  eventType: string,
  title: string,
  narrative: string,
  icon: string,
  impact?: Record<string, number>,
  isGlobal = false,
): Promise<void> {
  await db.civilizationEventRecord.create({
    data: {
      worldId,
      worldName,
      eventType,
      title,
      narrative,
      icon,
      impact: JSON.stringify(impact ?? {}),
      isGlobal,
    },
  });
}

export async function getChronicle(worldId?: string, limit = 30): Promise<any[]> {
  const where: any = worldId ? { worldId } : {};
  const events = await db.civilizationEventRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return events.map((e) => ({
    id: e.id,
    worldName: e.worldName,
    eventType: e.eventType,
    title: e.title,
    narrative: e.narrative,
    icon: e.icon,
    impact: JSON.parse(e.impact),
    isGlobal: e.isGlobal,
    createdAt: e.createdAt.getTime(),
  }));
}

// ─── AI Civilization Governors ─────────────────────────────────────────────

export interface AICouncilInsight {
  agent: 'governor' | 'economy' | 'culture' | 'defense' | 'historian';
  title: string;
  body: string;
  recommendation: string;
}

export async function getAICouncilInsights(worldId: string): Promise<AICouncilInsight[]> {
  const identity = await db.worldIdentityRecord.findUnique({ where: { worldId } });
  if (!identity) return [];

  const insights: AICouncilInsight[] = [];
  const pop = identity.population;
  const alliances = identity.alliancesCount;
  const rivals = identity.rivalriesCount;
  const culture = JSON.parse(identity.cultureDNA);
  const economy = JSON.parse(identity.economyDNA);

  // Governor AI
  if (pop < 20) {
    insights.push({
      agent: 'governor',
      title: 'Population Growth Needed',
      body: `Your civilization has ${pop} citizens. Consider promoting your world to attract more players.`,
      recommendation: 'Launch a challenge or tournament to attract visitors',
    });
  } else if (pop > 100) {
    insights.push({
      agent: 'governor',
      title: 'Ready for Expansion',
      body: `With ${pop} citizens, your civilization is ready to form alliances and expand influence.`,
      recommendation: 'Form a trade agreement with another civilization',
    });
  }

  // Economy AI
  const tradeVolume = economy.tradeVolume ?? 0;
  if (tradeVolume > 1_000_000) {
    insights.push({
      agent: 'economy',
      title: 'Economy is Thriving',
      body: `Trade volume has reached ${(tradeVolume / 1_000_000).toFixed(1)} Liquid. The economy is healthy.`,
      recommendation: 'Consider lowering trade barriers to increase volume further',
    });
  } else if (tradeVolume === 0) {
    insights.push({
      agent: 'economy',
      title: 'No Trade Activity',
      body: 'Your civilization has no trade with other worlds. Economic isolation limits growth.',
      recommendation: 'Establish a trade agreement with a neighboring civilization',
    });
  }

  // Culture AI
  const topCulture = Object.entries(culture).sort(([, a], [, b]) => (b as number) - (a as number))[0];
  if (topCulture) {
    insights.push({
      agent: 'culture',
      title: `Cultural Identity: ${topCulture[0]}`,
      body: `Your civilization's dominant cultural trait is ${topCulture[0]} (${topCulture[1]}/100). This shapes how other worlds perceive you.`,
      recommendation: 'Host a cultural festival to strengthen your identity',
    });
  }

  // Defense AI
  if (rivals > 0) {
    insights.push({
      agent: 'defense',
      title: `${rivals} Rivalry${rivals > 1 ? 's' : ''} Active`,
      body: `Your civilization has ${rivals} active rivalries. Consider diplomatic solutions or strengthening defenses.`,
      recommendation: 'Form an alliance to counterbalance rivalries',
    });
  } else if (alliances === 0) {
    insights.push({
      agent: 'defense',
      title: 'No Alliances',
      body: 'Your civilization has no allies. In the Multiverse, alliances provide security and growth.',
      recommendation: 'Seek an alliance with a complementary civilization',
    });
  }

  // Historian AI
  insights.push({
    agent: 'historian',
    title: 'Chronicle Updated',
    body: `Your civilization is in the ${identity.era} era with ${identity.influenceScore} influence. History is being written.`,
    recommendation: 'Review your world chronicle to see your civilization\'s story',
  });

  // Try to enhance the top insight with LLM
  if (insights.length > 0 && identity) {
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: `You are the AI Governor of ${identity.worldName}, a civilization in the PlayLiquid Multiverse. Write ONE strategic insight (2 sentences) about the civilization's current state. Be specific and authoritative. No markdown.` },
          { role: 'user', content: `Civilization: ${identity.worldName}, Level: ${identity.civilizationLevel}, Population: ${pop}, Era: ${identity.era}, Alliances: ${alliances}, Rivals: ${rivals}, Influence: ${identity.influenceScore}` },
        ],
        thinking: { type: 'disabled' },
      });
      const enhanced = completion.choices[0]?.message?.content?.trim();
      if (enhanced) {
        insights.unshift({
          agent: 'governor',
          title: 'AI Governor Strategic Assessment',
          body: enhanced,
          recommendation: 'Follow the governor\'s strategic direction',
        });
      }
    } catch {
      // Keep rule-based insights
    }
  }

  return insights;
}

// ─── World Discovery (Civilization Recommendations) ────────────────────────

export async function getRecommendedCivilizations(userId: string, limit = 5): Promise<any[]> {
  const { getFullPlayerIdentity } = await import('@/lib/identity/player-identity-service');
  const identity = await getFullPlayerIdentity(userId);

  const allCivs = await getAllCivilizations();
  if (allCivs.length === 0) return [];

  // Get player's visited worlds
  const visited = identity?.worldPassport.visited ?? [];
  const visitedIds = new Set(visited.map((v) => v.worldId));

  const scored = allCivs.map((civ) => {
    let score = 30;
    const reasons: string[] = [];

    // Influence signal
    if (civ.influenceScore > 50) {
      score += 15;
      reasons.push(`${civ.influenceScore} influence`);
    }

    // Population signal
    if (civ.population > 50) {
      score += 10;
      reasons.push(`${civ.population} citizens`);
    }

    // Culture match
    if (identity) {
      const playerSkills = identity.skills;
      const culture = civ.cultureDNA;
      if (playerSkills.trading > 50 && culture.trade > 20) {
        score += 12;
        reasons.push('Matches your trading skills');
      }
      if (playerSkills.farming > 50 && culture.agriculture > 20) {
        score += 12;
        reasons.push('Matches your farming expertise');
      }
    }

    // New world bonus
    if (!visitedIds.has(civ.worldId)) {
      score += 10;
      reasons.push('Unexplored world');
    } else {
      score -= 5;
    }

    // Alliance bonus
    if (civ.alliancesCount > 0) {
      score += 5;
      reasons.push(`${civ.alliancesCount} alliances`);
    }

    return { ...civ, score: Math.min(100, score), reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
