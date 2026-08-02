/**
 * ADR-007: Leaderboard Payout Service
 * -------------------------------------
 * At the end of each payout cycle, the prize pool is distributed
 * to the top 3 players on the leaderboard.
 *
 * Payout: 1st 25% / 2nd 15% / 3rd 10% of prize pool (configurable)
 * Remaining 50% carries to next cycle.
 */

import { db } from '@/lib/db';
import { creditWalletFromPayout } from './liquid-wallet-service';

const MICRO_XOF_PER_LIQUID = 1_000_000;

/**
 * Process a leaderboard payout cycle for an experience.
 * Distributes prize pool to top 3 players.
 */
export async function processPayoutCycle(experienceId: string, cycleLabel?: string): Promise<{
  cycle: string;
  totalDistributed: number;
  payouts: Array<{ rank: number; userId: string; displayName: string; payoutXof: number }>;
  remainingInPool: number;
}> {
  const pool = await db.prizePoolRecord.findUnique({ where: { experienceId } });
  if (!pool) throw new Error('Prize pool not found');

  const cycle = cycleLabel ?? generateCycleLabel();

  // Get top 3 from leaderboard
  const leaderboard = await db.leaderboardEntryRecord.findMany({
    where: { experienceId },
    orderBy: { score: 'desc' },
    take: 3,
  });

  if (leaderboard.length === 0 || pool.currentBalance === 0) {
    return { cycle, totalDistributed: 0, payouts: [], remainingInPool: pool.currentBalance };
  }

  const bpsMap = [pool.firstPlaceBps, pool.secondPlaceBps, pool.thirdPlaceBps];
  const payouts: Array<{ rank: number; userId: string; displayName: string; payoutXof: number }> = [];
  let totalDistributed = 0;

  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i];
    const bps = bpsMap[i];
    const payoutXof = Math.floor(pool.currentBalance * bps / 10000);

    if (payoutXof > 0) {
      // Record the payout
      const payoutRecord = await db.leaderboardPayoutRecord.create({
        data: {
          prizePoolId: pool.id,
          experienceId,
          userId: entry.userId,
          displayName: entry.displayName,
          rank: i + 1,
          payoutXof,
          payoutCycle: cycle,
        },
      });

      // Credit player wallet (ONLY path for player Liquid earnings)
      await creditWalletFromPayout(entry.userId, payoutXof, payoutRecord.id);

      payouts.push({
        rank: i + 1,
        userId: entry.userId,
        displayName: entry.displayName,
        payoutXof,
      });

      totalDistributed += payoutXof;
    }
  }

  // Update prize pool
  await db.prizePoolRecord.update({
    where: { id: pool.id },
    data: {
      totalDistributed: { increment: totalDistributed },
      currentBalance: { decrement: totalDistributed },
    },
  });

  return {
    cycle,
    totalDistributed,
    payouts,
    remainingInPool: pool.currentBalance - totalDistributed,
  };
}

/**
 * Get payout history for an experience.
 */
export async function getPayoutHistory(experienceId: string, limit = 20): Promise<any[]> {
  const payouts = await db.leaderboardPayoutRecord.findMany({
    where: { experienceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return payouts.map((p) => ({
    id: p.id,
    rank: p.rank,
    userId: p.userId,
    displayName: p.displayName,
    payoutXof: p.payoutXof,
    payoutLiquid: p.payoutXof / MICRO_XOF_PER_LIQUID,
    payoutCycle: p.payoutCycle,
    createdAt: p.createdAt.getTime(),
  }));
}

/**
 * Get a player's total winnings across all experiences.
 */
export async function getPlayerWinnings(userId: string): Promise<{
  totalWon: number;
  payoutCount: number;
  recentPayouts: any[];
}> {
  const payouts = await db.leaderboardPayoutRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const totalWon = payouts.reduce((s, p) => s + p.payoutXof, 0);

  return {
    totalWon,
    payoutCount: payouts.length,
    recentPayouts: payouts.map((p) => ({
      experienceId: p.experienceId,
      rank: p.rank,
      payoutLiquid: p.payoutXof / MICRO_XOF_PER_LIQUID,
      payoutCycle: p.payoutCycle,
      createdAt: p.createdAt.getTime(),
    })),
  };
}

function generateCycleLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const week = Math.ceil(now.getDate() / 7);
  return `${year}-${month}-W${week}`;
}
