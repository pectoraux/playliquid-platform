/**
 * Identity Layer v0.45 — Achievement & Progression Service
 * ---------------------------------------------------------
 * Awards XP, skills, badges, and inventory items based on player actions.
 * Defines the achievement catalog and checks for unlock conditions.
 */

import { db } from '@/lib/db';
import { awardXP, updateSkills, updateReputation } from './player-identity-service';

// ─── Achievement Catalog ───────────────────────────────────────────────────

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'play' | 'create' | 'social' | 'economy' | 'exploration' | 'mastery';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
  check: (stats: PlayerStats) => boolean;
}

export interface PlayerStats {
  totalSessions: number;
  totalScore: number;
  totalTokensEarned: number;
  worldsVisited: number;
  sparksForked: number;
  creatorsFollowed: number;
  liquidEarned: number;
  skills: Record<string, number>;
}

const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  {
    id: 'first-play',
    title: 'First Steps',
    description: 'Play your first Spark',
    icon: '🎮',
    category: 'play',
    rarity: 'common',
    xpReward: 10,
    check: (s) => s.totalSessions >= 1,
  },
  {
    id: 'explorer',
    title: 'Explorer',
    description: 'Visit 3 different worlds',
    icon: '🧭',
    category: 'exploration',
    rarity: 'common',
    xpReward: 25,
    check: (s) => s.worldsVisited >= 3,
  },
  {
    id: 'strategist',
    title: 'Strategist',
    description: 'Earn 100+ total score across sessions',
    icon: '♟️',
    category: 'mastery',
    rarity: 'rare',
    xpReward: 50,
    check: (s) => s.totalScore >= 100,
  },
  {
    id: 'merchant',
    title: 'Merchant',
    description: 'Earn 50+ tokens total',
    icon: '💰',
    category: 'economy',
    rarity: 'rare',
    xpReward: 50,
    check: (s) => s.totalTokensEarned >= 50,
  },
  {
    id: 'collector',
    title: 'Collector',
    description: 'Earn 100+ tokens total',
    icon: '📦',
    category: 'economy',
    rarity: 'epic',
    xpReward: 100,
    check: (s) => s.totalTokensEarned >= 100,
  },
  {
    id: 'world-citizen',
    title: 'World Citizen',
    description: 'Visit 5 different worlds',
    icon: '🌍',
    category: 'exploration',
    rarity: 'epic',
    xpReward: 100,
    check: (s) => s.worldsVisited >= 5,
  },
  {
    id: 'master-player',
    title: 'Master Player',
    description: 'Play 20+ sessions',
    icon: '🏆',
    category: 'mastery',
    rarity: 'epic',
    xpReward: 150,
    check: (s) => s.totalSessions >= 20,
  },
  {
    id: 'legend',
    title: 'Living Legend',
    description: 'Earn 500+ total score',
    icon: '👑',
    category: 'mastery',
    rarity: 'legendary',
    xpReward: 500,
    check: (s) => s.totalScore >= 500,
  },
  {
    id: 'tycoon',
    title: 'Liquid Tycoon',
    description: 'Earn 10+ Liquid total',
    icon: '💎',
    category: 'economy',
    rarity: 'legendary',
    xpReward: 500,
    check: (s) => s.liquidEarned >= 10_000_000, // micro-Liquid
  },
];

/**
 * Check and award any newly-earned achievements for a player.
 */
export async function checkAndAwardAchievements(userId: string): Promise<string[]> {
  // Gather player stats
  const stats = await gatherPlayerStats(userId);

  // Get already-earned achievements
  const earned = await db.achievementRecord.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const earnedIds = new Set(earned.map((e) => e.achievementId));

  const newlyAwarded: string[] = [];

  for (const def of ACHIEVEMENT_CATALOG) {
    if (earnedIds.has(def.id)) continue;
    if (def.check(stats)) {
      await db.achievementRecord.create({
        data: {
          userId,
          achievementId: def.id,
          title: def.title,
          description: def.description,
          icon: def.icon,
          category: def.category,
          rarity: def.rarity,
          xpReward: def.xpReward,
        },
      });
      await awardXP(userId, def.xpReward);
      newlyAwarded.push(def.id);

      // Award a badge item to inventory
      await db.inventoryItemRecord.upsert({
        where: { userId_itemId: { userId, itemId: `badge_${def.id}` } },
        create: {
          userId,
          itemId: `badge_${def.id}`,
          name: def.title,
          description: def.description,
          icon: def.icon,
          type: 'achievement',
          rarity: def.rarity,
        },
        update: {},
      });
    }
  }

  return newlyAwarded;
}

/**
 * Gather player stats for achievement checking.
 */
async function gatherPlayerStats(userId: string): Promise<PlayerStats> {
  const sessions = await db.playSession.findMany({
    where: { userId },
    include: { telemetry: true },
  });

  let totalScore = 0;
  let totalTokensEarned = 0;

  for (const s of sessions) {
    if (s.telemetry) {
      totalScore += s.telemetry.score ?? 0;
      const tokens = s.telemetry.tokensEmittedJson ? JSON.parse(s.telemetry.tokensEmittedJson) : {};
      for (const amt of Object.values(tokens)) totalTokensEarned += (amt as number);
    }
  }

  const worldVisits = await db.worldVisitRecord.count({ where: { userId } });
  const profile = await db.playerProfile.findUnique({ where: { userId } });
  const following = profile ? (JSON.parse(profile.followingJson) as string[]).length : 0;
  const skills = profile ? JSON.parse(profile.skillsJson) : {};

  return {
    totalSessions: sessions.length,
    totalScore,
    totalTokensEarned,
    worldsVisited: worldVisits,
    sparksForked: 0, // would need to track forks
    creatorsFollowed: following,
    // ADR-006: liquidBalance is deprecated. Use LiquidWalletRecord instead.
    liquidEarned: 0,
    skills,
  };
}

/**
 * Award XP and skills after a play session.
 */
export async function processPlaySessionRewards(params: {
  userId: string;
  score: number;
  tokensEarned: Record<string, number>;
  durationMs: number;
}): Promise<void> {
  const { userId, score, tokensEarned } = params;

  // Award XP: 1 XP per score point + 2 per token
  const xp = score + Object.values(tokensEarned).reduce((s, n) => s + n * 2, 0);
  await awardXP(userId, xp);

  // Update skills based on tokens earned
  const skillDelta: Record<string, number> = {};
  if (tokensEarned.CORN) skillDelta.farming = (skillDelta.farming ?? 0) + tokensEarned.CORN;
  if (tokensEarned.MEAL) skillDelta.cooking = (skillDelta.cooking ?? 0) + tokensEarned.MEAL * 2;
  if (tokensEarned.GOLD) skillDelta.trading = (skillDelta.trading ?? 0) + tokensEarned.GOLD * 3;
  if (score > 0) skillDelta.strategy = (skillDelta.strategy ?? 0) + Math.floor(score / 5);

  if (Object.keys(skillDelta).length > 0) {
    await updateSkills(userId, skillDelta);
  }

  // Update reputation
  await updateReputation(userId, {
    competitor: score > 20 ? 2 : 0,
    trader: tokensEarned.GOLD ? 3 : 0,
    builder: tokensEarned.CORN ? 1 : 0,
  });

  // Check achievements
  await checkAndAwardAchievements(userId);
}

/**
 * Get the achievement catalog (for display).
 */
export function getAchievementCatalog(): AchievementDef[] {
  return ACHIEVEMENT_CATALOG;
}
