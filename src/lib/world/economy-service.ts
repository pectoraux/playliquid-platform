/**
 * World Engine — Creator Economy Service
 * ---------------------------------------
 * Handles engagement rewards and fork royalty splits.
 *
 * Revenue flows through the Liquid ledger (double-entry). When a player
 * earns Liquid in a session, a portion goes to:
 *   - The experience creator (engagement reward)
 *   - Fork lineage (royalty split)
 *   - The platform
 *
 * The royalty graph walks the fork tree and distributes shares per
 * declared lineage percentages.
 */

import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import { ACCOUNTS } from '@/kernel/ledger';
import type { RoyaltyShare } from '@/kernel/types';

const PLATFORM_SHARE_BPS = 2000;       // 20% to platform
const CREATOR_ENGAGEMENT_BPS = 6000;   // 60% to creator (engagement)
const LINEAGE_SHARE_BPS = 2000;        // 20% to fork lineage

const DEFAULT_FORK_SHARE_BPS = 9000;   // fork creator gets 90%
const DEFAULT_PARENT_SHARE_BPS = 1000; // parent gets 10%

/**
 * ADR-006: DEPRECATED — Liquid is NOT a reward currency.
 *
 * This function previously minted Liquid as engagement rewards.
 * Under ADR-006, Liquid only enters circulation through purchases.
 * Creator earnings now come from competitive session revenue splits
 * (see src/lib/economy/revenue-split-service.ts).
 *
 * This function is kept as a no-op for backward compatibility but
 * does NOT mint any Liquid.
 */
export async function rewardEngagement(_params: {
  experienceId: string;
  userId: string;
  sessionDurationMs: number;
  score: number;
}): Promise<{ totalReward: number; shares: RoyaltyShare[] }> {
  return { totalReward: 0, shares: [] };
}

/**
 * Compute the royalty shares for an experience (walks the fork tree).
 */
export async function computeRoyaltyShares(experienceId: string): Promise<RoyaltyShare[]> {
  const shares: RoyaltyShare[] = [];
  const visited = new Set<string>();

  let currentExp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true },
  });

  if (!currentExp) return shares;

  // The direct creator gets the full lineage share initially
  let remainingBps = LINEAGE_SHARE_BPS;
  let depth = 0;

  while (currentExp && !visited.has(currentExp.id) && depth < 5) {
    visited.add(currentExp.id);

    if (depth === 0) {
      // Direct creator
      shares.push({
        creatorId: currentExp.creatorId,
        creatorName: currentExp.creator.displayName,
        shareBps: remainingBps * DEFAULT_FORK_SHARE_BPS / 10000,
        role: 'fork',
      });
      remainingBps = remainingBps * DEFAULT_PARENT_SHARE_BPS / 10000;
    } else if (currentExp.parentExperienceId) {
      // Ancestor
      shares.push({
        creatorId: currentExp.creatorId,
        creatorName: currentExp.creator.displayName,
        shareBps: remainingBps * DEFAULT_FORK_SHARE_BPS / 10000,
        role: 'original',
      });
      remainingBps = remainingBps * DEFAULT_PARENT_SHARE_BPS / 10000;
    }

    if (currentExp.parentExperienceId) {
      currentExp = await db.experienceRecord.findUnique({
        where: { id: currentExp.parentExperienceId },
        include: { creator: true },
      });
    } else {
      break;
    }
    depth++;
  }

  // Any remaining goes to platform
  if (remainingBps > 0) {
    shares.push({
      creatorId: 'platform',
      creatorName: 'PlayLiquid Platform',
      shareBps: remainingBps,
      role: 'platform',
    });
  }

  // Persist
  await db.royaltyNode.upsert({
    where: { experienceId },
    create: {
      experienceId,
      sharesJson: JSON.stringify(shares),
    },
    update: {
      sharesJson: JSON.stringify(shares),
    },
  });

  return shares;
}

/**
 * Get the royalty graph for an experience.
 */
export async function getRoyaltyGraph(experienceId: string): Promise<RoyaltyShare[]> {
  const node = await db.royaltyNode.findUnique({ where: { experienceId } });
  if (node) return JSON.parse(node.sharesJson);
  return computeRoyaltyShares(experienceId);
}

/**
 * Get economy summary across all experiences.
 */
export async function getEconomySummary(): Promise<{
  totalLiquidInCirculation: number;
  totalCreatorEarnings: number;
  totalPlayerSpending: number;
  totalSessions: number;
  topCreators: Array<{ creatorId: string; name: string; earnings: number }>;
}> {
  const accounts = await ledger.listAccounts();
  const creators = await db.creatorRecord.findMany({ orderBy: { totalLiquid: 'desc' }, take: 10 });
  const sessions = await db.playSession.count();
  const sessionCount = sessions;

  const totalLiquidInCirculation = accounts
    .filter((a) => a.id.startsWith('player:wallet') || a.id.startsWith('creator:wallet'))
    .reduce((sum, a) => sum + a.balance, 0);

  const totalCreatorEarnings = accounts
    .filter((a) => a.id.startsWith('creator:wallet'))
    .reduce((sum, a) => sum + a.balance, 0);

  const totalPlayerSpending = accounts
    .filter((a) => a.id.startsWith('player:wallet'))
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);

  return {
    totalLiquidInCirculation,
    totalCreatorEarnings,
    totalPlayerSpending,
    totalSessions: sessionCount,
    topCreators: creators.map((c) => ({
      creatorId: c.id,
      name: c.displayName,
      earnings: c.totalLiquid,
    })),
  };
}
