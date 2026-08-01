/**
 * v0.48 Creator Intelligence — Evolution Engine + Reputation + Economy + Marketplace
 * ------------------------------------------------------------------------------------
 */

import { db } from '@/lib/db';
import { computeReputation } from '@/lib/universe/rating-service';

// ─── Game Evolution Engine ─────────────────────────────────────────────────

export interface EvolutionStage {
  stage: string;
  label: string;
  icon: string;
  description: string;
}

const STAGES: EvolutionStage[] = [
  { stage: 'birth', label: 'Birth', icon: '🌱', description: 'Just published. Finding first players.' },
  { stage: 'growth', label: 'Growing', icon: '📈', description: 'Players are coming in. The game is catching on.' },
  { stage: 'optimization', label: 'Optimizing', icon: '⚙️', description: 'Fine-tuning based on player data and AI insights.' },
  { stage: 'expansion', label: 'Expanding', icon: '🌍', description: 'Adding new features, mechanics, and content.' },
  { stage: 'civilization', label: 'Civilization', icon: '🏛️', description: 'A living world with AI citizens, economy, and culture.' },
];

export async function getEvolutionStage(experienceId: string): Promise<{ current: EvolutionStage; next?: EvolutionStage; plan?: any }> {
  const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });
  const metrics = await db.experienceMetrics.findUnique({ where: { experienceId } });
  const lifecycleEvents = await db.gameLifecycleEventRecord.findMany({ where: { experienceId } });

  const playCount = metrics?.totalSessions ?? exp?.playCount ?? 0;
  const forkCount = exp?.forkCount ?? 0;
  const hasWorld = await db.worldRecord.findFirst({ where: { experienceId } });

  let currentStage = 'birth';
  if (playCount >= 100 && forkCount >= 5 && hasWorld) currentStage = 'civilization';
  else if (playCount >= 50 && forkCount >= 3) currentStage = 'expansion';
  else if (playCount >= 20) currentStage = 'optimization';
  else if (playCount >= 5) currentStage = 'growth';

  const current = STAGES.find((s) => s.stage === currentStage)!;
  const stageIdx = STAGES.findIndex((s) => s.stage === currentStage);
  const next = stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : undefined;

  // Check for existing plan
  let plan = await db.gameEvolutionPlanRecord.findFirst({ where: { experienceId } });

  // Auto-generate plan if none exists
  if (!plan && exp) {
    plan = await generateEvolutionPlan(experienceId, exp.title, exp.creatorId, currentStage, playCount, forkCount, !!hasWorld);
  }

  return {
    current,
    next,
    plan: plan ? {
      id: plan.id,
      currentStage: plan.currentStage,
      proposedStage: plan.proposedStage,
      steps: JSON.parse(plan.stepsJson),
      projectedRetention: plan.projectedRetention,
      projectedRevenue: plan.projectedRevenue,
      status: plan.status,
    } : null,
  };
}

async function generateEvolutionPlan(experienceId: string, experienceName: string, creatorId: string, currentStage: string, playCount: number, forkCount: number, hasWorld: boolean): Promise<any> {
  const steps: Array<{ step: string; description: string; status: string; projectedImpact: string }> = [];

  if (currentStage === 'birth') {
    steps.push({ step: 'Share with friends', description: 'Get your first 10 plays by sharing directly.', status: 'PENDING', projectedImpact: 'Initial traction' });
    steps.push({ step: 'Optimize thumbnail', description: 'A compelling thumbnail increases click rate by 30%.', status: 'PENDING', projectedImpact: '+30% discovery' });
  } else if (currentStage === 'growth') {
    steps.push({ step: 'Add daily challenges', description: 'Daily challenges drive return visits.', status: 'PENDING', projectedImpact: '+25% retention' });
    steps.push({ step: 'Create community', description: 'Build a community space for players.', status: 'PENDING', projectedImpact: '+40% engagement' });
  } else if (currentStage === 'optimization') {
    steps.push({ step: 'Run AI Evolution analysis', description: 'Use the Evolution Agent to identify improvements.', status: 'PENDING', projectedImpact: '+15% completion' });
    steps.push({ step: 'Launch tournament', description: 'Competitive events attract new players.', status: 'PENDING', projectedImpact: '+50% engagement' });
  } else if (currentStage === 'expansion') {
    steps.push({ step: 'Spawn AI citizens', description: 'Activate the Civilization Engine to create a living world.', status: 'PENDING', projectedImpact: 'New content category' });
    steps.push({ step: 'Add seasonal events', description: 'Time-limited events create urgency and FOMO.', status: 'PENDING', projectedImpact: '+30% DAU' });
  } else if (currentStage === 'civilization') {
    steps.push({ step: 'Enable cross-world trade', description: 'Connect your world to the Multiverse economy.', status: 'PENDING', projectedImpact: 'New revenue stream' });
    steps.push({ step: 'Create world lore', description: 'Develop narratives that make your world memorable.', status: 'PENDING', projectedImpact: '+20% player attachment' });
  }

  const projectedRetention = 0.15 + playCount * 0.001;
  const projectedRevenue = playCount * 0.5;

  return db.gameEvolutionPlanRecord.create({
    data: {
      experienceId,
      experienceName,
      creatorId,
      currentStage,
      proposedStage: STAGES[Math.min(STAGES.findIndex((s) => s.stage === currentStage) + 1, STAGES.length - 1)].stage,
      stepsJson: JSON.stringify(steps),
      projectedRetention,
      projectedRevenue,
      status: 'DRAFT',
    },
  });
}

// ─── Creator Reputation ────────────────────────────────────────────────────

export interface CreatorReputation {
  innovation: number;
  playerLove: number;
  fairEconomy: number;
  community: number;
  evolutionSpeed: number;
  overall: number;
}

export async function getCreatorReputation(creatorId: string): Promise<CreatorReputation> {
  const creator = await db.creatorRecord.findUnique({
    where: { id: creatorId },
    include: { experiences: true },
  });
  if (!creator) return { innovation: 0, playerLove: 0, fairEconomy: 0, community: 0, evolutionSpeed: 0, overall: 0 };

  const publishedExps = creator.experiences.filter((e) => e.status === 'PUBLISHED');
  let totalRep = 0;
  let totalPlays = 0;
  let totalForks = 0;
  let totalLikes = 0;
  let totalEconomyScore = 0;
  let expCount = 0;

  for (const exp of publishedExps) {
    const rep = await computeReputation(exp.id);
    const metrics = await db.experienceMetrics.findUnique({ where: { experienceId: exp.id } });
    totalRep += rep.overallScore;
    totalPlays += metrics?.totalSessions ?? exp.playCount;
    totalForks += exp.forkCount;
    totalLikes += exp.likeCount;
    totalEconomyScore += rep.economyScore;
    expCount++;
  }

  const avgRep = expCount > 0 ? totalRep / expCount : 0;
  const avgEconomy = expCount > 0 ? totalEconomyScore / expCount : 0;

  const innovation = Math.min(100, Math.round(expCount * 10 + totalForks * 5));
  const playerLove = Math.min(100, Math.round(avgRep));
  const fairEconomy = Math.min(100, Math.round(avgEconomy));
  const community = Math.min(100, Math.round(totalLikes * 2 + totalForks * 3));
  const evolutionSpeed = Math.min(100, Math.round(expCount * 15 + totalForks * 2));

  const overall = Math.round((innovation + playerLove + fairEconomy + community + evolutionSpeed) / 5);

  return { innovation, playerLove, fairEconomy, community, evolutionSpeed, overall };
}

// ─── Game Economy Dashboard ────────────────────────────────────────────────

export interface GameEconomyDashboard {
  experienceId: string;
  experienceName: string;
  players: number;
  dailyActive: number;
  minuteVolume: number;      // micro-Liquid
  creatorShare: number;      // micro-Liquid
  leaderboardActivity: 'Low' | 'Medium' | 'High';
  prizePoolHealth: 'Empty' | 'Low' | 'Healthy' | 'Rich';
  retention: number;         // percentage
  tokensInCirculation: number;
  marketActions: number;
}

export async function getGameEconomy(experienceId: string): Promise<GameEconomyDashboard | null> {
  const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });
  const metrics = await db.experienceMetrics.findUnique({ where: { experienceId } });
  if (!exp) return null;

  const players = metrics?.totalSessions ?? exp.playCount;
  const dailyActive = Math.floor(players * 0.12); // approx 12% DAU
  const tokensInCirculation = metrics?.tokensEarned ?? 0;
  const minuteVolume = Math.floor(tokensInCirculation * 100_000); // tokens → micro-Liquid approx
  const creatorShare = Math.floor(minuteVolume * 0.6); // 60% creator share
  const marketActions = metrics?.marketActions ?? 0;
  const retention = Math.round((metrics?.completionRate ?? 0) * 100);

  const leaderboardActivity: GameEconomyDashboard['leaderboardActivity'] =
    players > 50 ? 'High' : players > 10 ? 'Medium' : 'Low';

  const prizePoolHealth: GameEconomyDashboard['prizePoolHealth'] =
    creatorShare > 10_000_000 ? 'Rich' : creatorShare > 1_000_000 ? 'Healthy' : creatorShare > 0 ? 'Low' : 'Empty';

  return {
    experienceId,
    experienceName: exp.title,
    players,
    dailyActive,
    minuteVolume,
    creatorShare,
    leaderboardActivity,
    prizePoolHealth,
    retention,
    tokensInCirculation,
    marketActions,
  };
}

// ─── Creator Marketplace ───────────────────────────────────────────────────

export async function seedMarketplace(): Promise<void> {
  const items = [
    { type: 'extension', name: 'Trading System', description: 'A complete marketplace extension with buy/sell/auction mechanics.', icon: '🏪', priceRoyaltyBps: 500, revenueImpact: 18, tags: ['economy', 'trade', 'marketplace'] },
    { type: 'mechanic', name: 'Combat System', description: 'Turn-based combat with damage types, armor, and abilities.', icon: '⚔️', priceRoyaltyBps: 700, revenueImpact: 22, tags: ['combat', 'pvp', 'balance'] },
    { type: 'template', name: 'Farming Template', description: 'Complete farming game template with crops, seasons, and economy.', icon: '🌾', priceRoyaltyBps: 800, revenueImpact: 35, tags: ['farming', 'economy', 'simulation'] },
    { type: 'npc', name: 'AI Merchant NPC', description: 'An autonomous AI merchant that trades with players and adapts prices.', icon: '🧑‍💼', priceRoyaltyBps: 600, revenueImpact: 15, tags: ['ai', 'economy', 'npc'] },
    { type: 'world', name: 'Medieval World Pack', description: 'A complete medieval world with regions, factions, and lore.', icon: '🏰', priceRoyaltyBps: 1000, revenueImpact: 40, tags: ['world', 'medieval', 'narrative'] },
    { type: 'asset-pack', name: 'Nature Asset Pack', description: '100+ nature sprites: trees, rocks, water, weather effects.', icon: '🌳', priceRoyaltyBps: 300, revenueImpact: 8, tags: ['assets', 'nature', 'visual'] },
    { type: 'ai-agent', name: 'Dungeon Master AI', description: 'An AI agent that generates quests, narrates stories, and adapts difficulty.', icon: '🎲', priceRoyaltyBps: 900, revenueImpact: 30, tags: ['ai', 'narrative', 'quests'] },
    { type: 'extension', name: 'Leaderboard System', description: 'Global + per-game leaderboards with seasonal resets and rewards.', icon: '🏆', priceRoyaltyBps: 400, revenueImpact: 12, tags: ['competition', 'social', 'retention'] },
  ];

  for (const item of items) {
    const existing = await db.creatorMarketplaceItemRecord.findFirst({ where: { name: item.name } });
    if (!existing) {
      await db.creatorMarketplaceItemRecord.create({
        data: {
          creatorId: 'creator_demo',
          creatorName: 'PlayLiquid',
          type: item.type,
          name: item.name,
          description: item.description,
          icon: item.icon,
          priceRoyaltyBps: item.priceRoyaltyBps,
          revenueImpact: item.revenueImpact,
          tagsJson: JSON.stringify(item.tags),
        },
      });
    }
  }
}

export async function getMarketplaceItems(type?: string): Promise<any[]> {
  const where: any = {};
  if (type) where.type = type;

  const items = await db.creatorMarketplaceItemRecord.findMany({
    where,
    orderBy: { usedByCount: 'desc' },
    take: 20,
  });

  return items.map((i) => ({
    id: i.id,
    type: i.type,
    name: i.name,
    description: i.description,
    icon: i.icon,
    priceRoyaltyBps: i.priceRoyaltyBps,
    usedByCount: i.usedByCount,
    rating: i.rating,
    revenueImpact: i.revenueImpact,
    tags: JSON.parse(i.tagsJson),
    creatorName: i.creatorName,
  }));
}

export async function getMarketplaceSummary(): Promise<{ totalItems: number; byType: Record<string, number> }> {
  const items = await db.creatorMarketplaceItemRecord.findMany();
  const byType: Record<string, number> = {};
  for (const i of items) byType[i.type] = (byType[i.type] ?? 0) + 1;
  return { totalItems: items.length, byType };
}
