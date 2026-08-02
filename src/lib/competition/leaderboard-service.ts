/**
 * Phase 16 — Leaderboard Engine
 * ------------------------------
 * Experience leaderboards with daily/weekly/monthly/all-time cycles.
 */

import { db } from '@/lib/db';

export type LeaderboardCycle = 'daily' | 'weekly' | 'monthly' | 'all-time';

/**
 * Get leaderboard for an experience.
 */
export async function getLeaderboard(experienceId: string, cycle: LeaderboardCycle = 'all-time', limit = 20): Promise<any[]> {
  const where: any = { experienceId };
  const since = getCycleStart(cycle);
  if (since) {
    where.achievedAt = { gte: since };
  }

  const entries = await db.leaderboardEntryRecord.findMany({
    where,
    orderBy: { score: 'desc' },
    take: limit,
  });

  return entries.map((e, i) => ({
    rank: i + 1,
    userId: e.userId,
    displayName: e.displayName,
    score: e.score,
    achievedAt: e.achievedAt.getTime(),
    cycle,
  }));
}

/**
 * Get a player's rank on an experience leaderboard.
 */
export async function getPlayerRank(experienceId: string, userId: string): Promise<{
  rank: number;
  score: number;
  totalPlayers: number;
} | null> {
  const entry = await db.leaderboardEntryRecord.findUnique({
    where: { experienceId_userId: { experienceId, userId } },
  });
  if (!entry) return null;

  // Count how many players have a higher score
  const higherCount = await db.leaderboardEntryRecord.count({
    where: { experienceId, score: { gt: entry.score } },
  });

  const totalPlayers = await db.leaderboardEntryRecord.count({ where: { experienceId } });

  return {
    rank: higherCount + 1,
    score: entry.score,
    totalPlayers,
  };
}

/**
 * Get top 3 for prize settlement.
 */
export async function getTop3(experienceId: string): Promise<Array<{
  userId: string;
  displayName: string;
  score: number;
  rank: number;
}>> {
  const entries = await db.leaderboardEntryRecord.findMany({
    where: { experienceId },
    orderBy: { score: 'desc' },
    take: 3,
  });

  return entries.map((e, i) => ({
    userId: e.userId,
    displayName: e.displayName,
    score: e.score,
    rank: i + 1,
  }));
}

function getCycleStart(cycle: LeaderboardCycle): Date | null {
  if (cycle === 'all-time') return null;
  const now = new Date();
  switch (cycle) {
    case 'daily':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'weekly':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return null;
  }
}
