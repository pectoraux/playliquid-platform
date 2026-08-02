/**
 * Phase 16 — Prize Settlement Service
 * ------------------------------------
 * At cycle completion, distributes the prize pool to top 3 players.
 * This is the ONLY service that creates player Liquid earnings.
 */

import { db } from '@/lib/db';
import { creditWalletFromPayout } from '@/lib/economy/liquid-wallet-service';
import { getTop3 } from './leaderboard-service';
import { getPrizePool } from '@/lib/economy/revenue-split-service';

const MICRO = 1_000_000;

/**
 * Settle a prize pool for an experience.
 * Distributes current balance to top 3 based on configured BPS.
 */
export async function settlePrizePool(experienceId: string, cycleLabel?: string): Promise<{
  settled: boolean;
  totalDistributed: number;
  payouts: Array<{ rank: number; userId: string; displayName: string; payoutLiquid: number }>;
  remainingInPool: number;
  error?: string;
}> {
  const pool = await getPrizePool(experienceId);
  if (!pool) return { settled: false, totalDistributed: 0, payouts: [], remainingInPool: 0, error: 'Prize pool not found' };
  if (pool.currentBalance === 0) return { settled: false, totalDistributed: 0, payouts: [], remainingInPool: 0, error: 'Prize pool is empty' };

  const top3 = await getTop3(experienceId);
  if (top3.length === 0) return { settled: false, totalDistributed: 0, payouts: [], remainingInPool: pool.currentBalance, error: 'No leaderboard entries' };

  const cycle = cycleLabel ?? generateCycleLabel();
  const bpsMap = [pool.config.firstPlaceBps, pool.config.secondPlaceBps, pool.config.thirdPlaceBps];
  const payouts: Array<{ rank: number; userId: string; displayName: string; payoutLiquid: number }> = [];
  let totalDistributed = 0;

  for (let i = 0; i < top3.length; i++) {
    const entry = top3[i];
    const bps = bpsMap[i];
    const payoutXof = Math.floor(pool.currentBalance * bps / 10000);

    if (payoutXof > 0) {
      // Record payout
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

      // Credit player wallet — ONLY path for player Liquid earnings
      await creditWalletFromPayout(entry.userId, payoutXof, payoutRecord.id);

      payouts.push({
        rank: i + 1,
        userId: entry.userId,
        displayName: entry.displayName,
        payoutLiquid: payoutXof / MICRO,
      });

      totalDistributed += payoutXof;
    }
  }

  // Update prize pool balance
  await db.prizePoolRecord.update({
    where: { experienceId },
    data: {
      totalDistributed: { increment: totalDistributed },
      currentBalance: { decrement: totalDistributed },
    },
  });

  return {
    settled: true,
    totalDistributed,
    payouts,
    remainingInPool: pool.currentBalance - totalDistributed,
  };
}

function generateCycleLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const week = Math.ceil(now.getDate() / 7);
  return `${year}-${month}-W${week}`;
}
