/**
 * v0.49 Asset Economy Universe — Asset Service
 * ----------------------------------------------
 * Persistent, ownable, tradeable assets that travel between experiences.
 *
 * Asset lifecycle:
 *   Created → Published → Installed → Used → Royalty Generated → Evolved → Forked
 *
 * Three asset classes:
 *   - Creator Assets (mechanics, templates, AI agents) → creator royalties
 *   - Player Assets (items, characters, collectibles) → player economy
 *   - Platform Assets (base systems) → platform revenue
 */

import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import { ACCOUNTS } from '@/kernel/ledger';

// ─── Asset Types ───────────────────────────────────────────────────────────

export const ASSET_TYPES = {
  character: { label: 'Character', icon: '🧙', desc: 'NPCs, heroes, villains with personality' },
  mechanic: { label: 'Game Mechanic', icon: '⚙️', desc: 'Combat, trading, crafting systems' },
  'ai-agent': { label: 'AI Agent', icon: '🤖', desc: 'Autonomous AI with memory and goals' },
  template: { label: 'Template', icon: '📐', desc: 'Complete game templates' },
  item: { label: 'Item', icon: '🗡️', desc: 'Weapons, tools, collectibles' },
  'world-seed': { label: 'World Seed', icon: '🌍', desc: 'Civilization templates with NPCs + economy' },
};

// ─── Seed Assets ───────────────────────────────────────────────────────────

const SEED_ASSETS = [
  { name: 'Trading System', type: 'mechanic', icon: '🏪', description: 'Complete marketplace with buy/sell/auction mechanics, price discovery, and trade routes.', royaltyBps: 500, tags: ['economy', 'trade', 'marketplace'], innovationScore: 70, performanceScore: 85 },
  { name: 'Combat System', type: 'mechanic', icon: '⚔️', description: 'Turn-based combat with damage types, armor, abilities, and status effects.', royaltyBps: 700, tags: ['combat', 'pvp', 'balance'], innovationScore: 60, performanceScore: 90 },
  { name: 'Farming Template', type: 'template', icon: '🌾', description: 'Complete farming game with crops, seasons, weather, and economy.', royaltyBps: 800, tags: ['farming', 'economy', 'simulation'], innovationScore: 75, performanceScore: 88 },
  { name: 'AI Merchant Maria', type: 'ai-agent', icon: '🧑‍💼', description: 'Autonomous AI merchant that learns player behavior, negotiates prices, and remembers trade history across sessions.', royaltyBps: 600, tags: ['ai', 'economy', 'npc', 'memory'], innovationScore: 90, performanceScore: 82 },
  { name: 'Cyber Wolf', type: 'character', icon: '🐺', description: 'A cybernetic wolf companion with loyalty mechanics, upgradeable abilities, and cross-game memory.', royaltyBps: 400, tags: ['character', 'companion', 'rpg'], innovationScore: 65, performanceScore: 75 },
  { name: 'Medieval World Seed', type: 'world-seed', icon: '🏰', description: 'Complete medieval civilization with 50 NPCs, guild system, quest engine, and feudal economy.', royaltyBps: 1000, tags: ['world', 'medieval', 'civilization', 'narrative'], innovationScore: 85, performanceScore: 80 },
  { name: 'Dungeon Master AI', type: 'ai-agent', icon: '🎲', description: 'AI that generates quests, narrates stories, adapts difficulty, and tracks player progress across campaigns.', royaltyBps: 900, tags: ['ai', 'narrative', 'quests', 'dnd'], innovationScore: 95, performanceScore: 78 },
  { name: 'Leaderboard System', type: 'mechanic', icon: '🏆', description: 'Global + per-game leaderboards with seasonal resets, rank tiers, and Liquid reward distribution.', royaltyBps: 400, tags: ['competition', 'social', 'retention'], innovationScore: 50, performanceScore: 92 },
  { name: 'Legendary Sword', type: 'item', icon: '🗡️', description: 'A legendary sword that grows stronger with each victory. Carries its history across games.', royaltyBps: 300, tags: ['item', 'legendary', 'progression'], assetClass: 'player', innovationScore: 80, performanceScore: 70 },
  { name: 'Guild System', type: 'mechanic', icon: '🛡️', description: 'Create guilds, manage members, guild banks, guild quests, and inter-guild diplomacy.', royaltyBps: 600, tags: ['social', 'guilds', 'community'], innovationScore: 70, performanceScore: 85 },
];

export async function seedAssets(): Promise<void> {
  for (const asset of SEED_ASSETS) {
    const assetId = `asset://${asset.type}/${asset.name.toLowerCase().replace(/\s+/g, '-')}-v1`;
    const existing = await db.assetEconomyRecord.findUnique({ where: { assetId } });
    if (existing) continue;

    const record = await db.assetEconomyRecord.create({
      data: {
        assetId,
        name: asset.name,
        description: asset.description,
        icon: asset.icon,
        type: asset.type,
        assetClass: (asset as any).assetClass ?? 'creator',
        creatorId: 'creator_demo',
        creatorName: 'PlayLiquid',
        version: 1,
        tagsJson: JSON.stringify(asset.tags),
        royaltyBps: asset.royaltyBps,
        qualityScore: asset.innovationScore,
        performanceScore: asset.performanceScore,
        innovationScore: asset.innovationScore,
        adoptionScore: Math.floor(Math.random() * 40) + 10,
        installCount: Math.floor(Math.random() * 200) + 10,
        usageCount: Math.floor(Math.random() * 5000) + 100,
        totalRevenue: Math.floor(Math.random() * 5_000_000) + 100_000,
        rating: 4 + Math.random(),
        ratingCount: Math.floor(Math.random() * 100) + 5,
      },
    });

    // Record creation event
    await db.assetEventRecord.create({
      data: {
        assetId: record.id,
        eventType: 'created',
        actorId: 'creator_demo',
        actorName: 'PlayLiquid',
        detail: `Created ${asset.name} v1`,
      },
    });
  }
}

// ─── Asset CRUD ────────────────────────────────────────────────────────────

export async function getAssets(params?: {
  type?: string;
  assetClass?: string;
  sort?: 'trending' | 'newest' | 'top-rated' | 'most-installed';
  limit?: number;
}): Promise<any[]> {
  const where: any = { status: 'PUBLISHED' };
  if (params?.type) where.type = params.type;
  if (params?.assetClass) where.assetClass = params.assetClass;

  let orderBy: any = { installCount: 'desc' };
  if (params?.sort === 'newest') orderBy = { createdAt: 'desc' };
  else if (params?.sort === 'top-rated') orderBy = { rating: 'desc' };
  else if (params?.sort === 'most-installed') orderBy = { installCount: 'desc' };
  else if (params?.sort === 'trending') orderBy = { usageCount: 'desc' };

  const assets = await db.assetEconomyRecord.findMany({
    where,
    orderBy,
    take: params?.limit ?? 20,
  });

  return assets.map(toAssetDTO);
}

export async function getAsset(assetId: string): Promise<any | null> {
  // Try by internal ID first, then by asset:// ID
  let asset = await db.assetEconomyRecord.findUnique({ where: { id: assetId } });
  if (!asset) {
    asset = await db.assetEconomyRecord.findUnique({ where: { assetId } });
  }
  if (!asset) return null;

  const dto = toAssetDTO(asset);

  // Get events
  const events = await db.assetEventRecord.findMany({
    where: { assetId: asset.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  dto.events = events.map((e) => ({
    eventType: e.eventType,
    actorName: e.actorName,
    detail: e.detail,
    createdAt: e.createdAt.getTime(),
  }));

  // Get installations
  const installations = await db.assetInstallationRecord.findMany({
    where: { assetId: asset.id, status: 'ACTIVE' },
    take: 5,
  });
  dto.installedIn = installations.map((i) => ({
    experienceId: i.experienceId,
    experienceName: i.experienceName,
    installedAt: i.installedAt.getTime(),
  }));

  // Get lineage
  if (asset.parentAssetId) {
    const parent = await db.assetEconomyRecord.findUnique({ where: { id: asset.parentAssetId } });
    dto.parent = parent ? { name: parent.name, version: parent.version } : null;
  }

  // Check for children (forks/evolutions)
  const children = await db.assetEconomyRecord.findMany({
    where: { parentAssetId: asset.id },
  });
  dto.children = children.map((c) => ({ name: c.name, version: c.version }));

  return dto;
}

// ─── Install Asset ─────────────────────────────────────────────────────────

export async function installAsset(params: {
  assetId: string;
  experienceId: string;
  experienceName: string;
  installedBy: string;
}): Promise<{ ok: boolean; error?: string }> {
  const asset = await db.assetEconomyRecord.findUnique({ where: { id: params.assetId } });
  if (!asset) return { ok: false, error: 'Asset not found' };

  // Check if already installed
  const existing = await db.assetInstallationRecord.findFirst({
    where: { assetId: asset.id, experienceId: params.experienceId, status: 'ACTIVE' },
  });
  if (existing) return { ok: false, error: 'Already installed' };

  // Create installation
  await db.assetInstallationRecord.create({
    data: {
      assetId: asset.id,
      experienceId: params.experienceId,
      experienceName: params.experienceName,
      installedBy: params.installedBy,
    },
  });

  // Update asset stats
  await db.assetEconomyRecord.update({
    where: { id: asset.id },
    data: {
      installCount: { increment: 1 },
      adoptionScore: { increment: 2 },
    },
  });

  // Record event
  await db.assetEventRecord.create({
    data: {
      assetId: asset.id,
      eventType: 'installed',
      actorId: params.installedBy,
      actorName: params.installedBy,
      detail: `Installed in ${params.experienceName}`,
    },
  });

  // If asset has a price, process payment via ledger
  if (asset.priceLiquid > 0) {
    await ledger.post([
      { account: `entity:${params.installedBy}:wallet`, debit: 0, credit: asset.priceLiquid, memo: `purchased ${asset.name}` },
      { account: ACCOUNTS.CREATOR_WALLET(asset.creatorId), debit: Math.floor(asset.priceLiquid * 0.9), credit: 0, memo: `asset sale: ${asset.name}` },
      { account: ACCOUNTS.PLATFORM_REVENUE, debit: Math.floor(asset.priceLiquid * 0.1), credit: 0, memo: `platform fee: ${asset.name}` },
    ], `asset purchase: ${asset.name}`);
  }

  return { ok: true };
}

// ─── Asset Reputation ──────────────────────────────────────────────────────

export async function getAssetReputation(assetId: string): Promise<{
  quality: number;
  performance: number;
  adoption: number;
  fairness: number;
  innovation: number;
  overall: number;
}> {
  const asset = await db.assetEconomyRecord.findUnique({ where: { id: assetId } });
  if (!asset) return { quality: 0, performance: 0, adoption: 0, fairness: 0, innovation: 0, overall: 0 };

  const overall = Math.round(
    (asset.qualityScore + asset.performanceScore + asset.adoptionScore + asset.fairnessScore + asset.innovationScore) / 5
  );

  return {
    quality: asset.qualityScore,
    performance: asset.performanceScore,
    adoption: asset.adoptionScore,
    fairness: asset.fairnessScore,
    innovation: asset.innovationScore,
    overall,
  };
}

// ─── Rate Asset ────────────────────────────────────────────────────────────

export async function rateAsset(assetId: string, userId: string, rating: number): Promise<void> {
  const asset = await db.assetEconomyRecord.findUnique({ where: { id: assetId } });
  if (!asset) return;

  const newRatingCount = asset.ratingCount + 1;
  const newRating = ((asset.rating * asset.ratingCount) + rating) / newRatingCount;

  await db.assetEconomyRecord.update({
    where: { id: assetId },
    data: {
      rating: newRating,
      ratingCount: newRatingCount,
      qualityScore: Math.min(100, Math.round(newRating * 20)),
    },
  });

  await db.assetEventRecord.create({
    data: {
      assetId,
      eventType: 'rated',
      actorId: userId,
      actorName: userId,
      detail: `Rated ${rating}/5`,
    },
  });
}

// ─── Evolve Asset (create new version) ─────────────────────────────────────

export async function evolveAsset(params: {
  assetId: string;
  creatorId: string;
  creatorName: string;
  changes: string;
  configJson?: Record<string, unknown>;
}): Promise<{ newAssetId: string }> {
  const parent = await db.assetEconomyRecord.findUnique({ where: { id: params.assetId } });
  if (!parent) throw new Error('Parent asset not found');

  const newVersion = parent.version + 1;
  const newAssetId = `asset://${parent.type}/${parent.name.toLowerCase().replace(/\s+/g, '-')}-v${newVersion}`;

  const child = await db.assetEconomyRecord.create({
    data: {
      assetId: newAssetId,
      name: parent.name,
      description: parent.description,
      icon: parent.icon,
      type: parent.type,
      assetClass: parent.assetClass,
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      version: newVersion,
      parentAssetId: parent.id,
      configJson: JSON.stringify(params.configJson ?? {}),
      tagsJson: parent.tagsJson,
      royaltyBps: parent.royaltyBps,
      qualityScore: parent.qualityScore,
      performanceScore: Math.min(100, parent.performanceScore + 5),
      innovationScore: Math.min(100, parent.innovationScore + 10),
    },
  });

  await db.assetEventRecord.create({
    data: {
      assetId: child.id,
      eventType: 'evolved',
      actorId: params.creatorId,
      actorName: params.creatorName,
      detail: `Evolved from v${parent.version}: ${params.changes}`,
      metadataJson: JSON.stringify({ parentVersion: parent.version, changes: params.changes }),
    },
  });

  return { newAssetId: child.id };
}

// ─── Fork Asset ────────────────────────────────────────────────────────────

export async function forkAsset(params: {
  assetId: string;
  creatorId: string;
  creatorName: string;
  newName: string;
}): Promise<{ forkedAssetId: string }> {
  const parent = await db.assetEconomyRecord.findUnique({ where: { id: params.assetId } });
  if (!parent) throw new Error('Asset not found');

  const newAssetId = `asset://${parent.type}/${params.newName.toLowerCase().replace(/\s+/g, '-')}-v1`;

  const fork = await db.assetEconomyRecord.create({
    data: {
      assetId: newAssetId,
      name: params.newName,
      description: `Fork of ${parent.name}. ${parent.description}`,
      icon: parent.icon,
      type: parent.type,
      assetClass: parent.assetClass,
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      version: 1,
      parentAssetId: parent.id,
      configJson: parent.configJson,
      tagsJson: parent.tagsJson,
      royaltyBps: parent.royaltyBps,
      qualityScore: parent.qualityScore,
      performanceScore: parent.performanceScore,
      innovationScore: Math.min(100, parent.innovationScore + 5),
    },
  });

  await db.assetEventRecord.create({
    data: {
      assetId: fork.id,
      eventType: 'forked',
      actorId: params.creatorId,
      actorName: params.creatorName,
      detail: `Forked from ${parent.name} v${parent.version}`,
    },
  });

  return { forkedAssetId: fork.id };
}

// ─── Asset Discovery Feed ──────────────────────────────────────────────────

export async function getAssetDiscoveryFeed(): Promise<{
  trending: any[];
  newReleases: any[];
  topRated: any[];
  mostInstalled: any[];
}> {
  const [trending, newReleases, topRated, mostInstalled] = await Promise.all([
    getAssets({ sort: 'trending', limit: 4 }),
    getAssets({ sort: 'newest', limit: 4 }),
    getAssets({ sort: 'top-rated', limit: 4 }),
    getAssets({ sort: 'most-installed', limit: 4 }),
  ]);

  return { trending, newReleases, topRated, mostInstalled };
}

// ─── Creator's Assets ──────────────────────────────────────────────────────

export async function getCreatorAssets(creatorId: string): Promise<{
  assets: any[];
  totalRevenue: number;
  totalInstalls: number;
  byType: Record<string, number>;
}> {
  const assets = await db.assetEconomyRecord.findMany({
    where: { creatorId },
    orderBy: { totalRevenue: 'desc' },
  });

  const totalRevenue = assets.reduce((s, a) => s + a.totalRevenue, 0);
  const totalInstalls = assets.reduce((s, a) => s + a.installCount, 0);
  const byType: Record<string, number> = {};
  for (const a of assets) byType[a.type] = (byType[a.type] ?? 0) + 1;

  return {
    assets: assets.map(toAssetDTO),
    totalRevenue,
    totalInstalls,
    byType,
  };
}

// ─── AI Asset Recommendations ──────────────────────────────────────────────

export async function getAIAssetRecommendations(experienceId: string): Promise<Array<{
  asset: any;
  reason: string;
  expectedImpact: string;
}>> {
  const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });
  if (!exp) return [];

  const metrics = await db.experienceMetrics.findUnique({ where: { experienceId: experienceId } });
  const recommendations: Array<{ asset: any; reason: string; expectedImpact: string }> = [];

  // Get all assets
  const allAssets = await getAssets({ limit: 20 });

  // Rule-based recommendations
  if (metrics && metrics.completionRate < 0.5) {
    const leaderboard = allAssets.find((a) => a.type === 'mechanic' && a.name.includes('Leaderboard'));
    if (leaderboard) {
      recommendations.push({
        asset: leaderboard,
        reason: 'Low completion rate — competitive elements can improve retention',
        expectedImpact: '+15% retention',
      });
    }
  }

  if (metrics && metrics.marketActions < metrics.totalSessions * 0.3) {
    const trading = allAssets.find((a) => a.type === 'mechanic' && a.name.includes('Trading'));
    if (trading) {
      recommendations.push({
        asset: trading,
        reason: 'Low economic engagement — a trading system can activate the economy',
        expectedImpact: '+30% economic activity',
      });
    }
  }

  const aiAgent = allAssets.find((a) => a.type === 'ai-agent');
  if (aiAgent) {
    recommendations.push({
      asset: aiAgent,
      reason: 'AI agents create emergent gameplay that keeps players coming back',
      expectedImpact: '+25% return rate',
    });
  }

  const guild = allAssets.find((a) => a.type === 'mechanic' && a.name.includes('Guild'));
  if (guild && (metrics?.totalSessions ?? 0) > 20) {
    recommendations.push({
      asset: guild,
      reason: 'Your game has enough players for social features to thrive',
      expectedImpact: '+40% community engagement',
    });
  }

  // Fill with top-rated if not enough
  while (recommendations.length < 4) {
    const remaining = allAssets.filter((a) => !recommendations.find((r) => r.asset.id === a.id));
    if (remaining.length === 0) break;
    const next = remaining[0];
    recommendations.push({
      asset: next,
      reason: 'Highly rated by the community',
      expectedImpact: `+${Math.floor(Math.random() * 20) + 10}% engagement`,
    });
  }

  return recommendations.slice(0, 5);
}

// ─── Helper ────────────────────────────────────────────────────────────────

function toAssetDTO(a: any): any {
  return {
    id: a.id,
    assetId: a.assetId,
    name: a.name,
    description: a.description,
    icon: a.icon,
    type: a.type,
    assetClass: a.assetClass,
    creatorId: a.creatorId,
    creatorName: a.creatorName,
    version: a.version,
    tags: JSON.parse(a.tagsJson),
    royaltyBps: a.royaltyBps,
    priceLiquid: a.priceLiquid,
    qualityScore: a.qualityScore,
    performanceScore: a.performanceScore,
    adoptionScore: a.adoptionScore,
    fairnessScore: a.fairnessScore,
    innovationScore: a.innovationScore,
    installCount: a.installCount,
    usageCount: a.usageCount,
    totalRevenue: a.totalRevenue,
    rating: a.rating,
    ratingCount: a.ratingCount,
    createdAt: a.createdAt.getTime(),
  };
}
