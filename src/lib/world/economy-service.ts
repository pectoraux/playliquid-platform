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
 * Reward a creator for player engagement.
 * Called when a session ends — distributes Liquid from the reward pool.
 */
export async function rewardEngagement(params: {
  experienceId: string;
  userId: string;
  sessionDurationMs: number;
  score: number;
}): Promise<{ totalReward: number; shares: RoyaltyShare[] }> {
  const { experienceId, sessionDurationMs, score } = params;

  // Calculate engagement reward (micro-Liquid)
  // Base: 1 Liquid per minute of play + 0.1 Liquid per score point
  const minutesPlayed = sessionDurationMs / 60000;
  const baseReward = Math.round((minutesPlayed * 1_000_000 + score * 100_000));

  if (baseReward <= 0) return { totalReward: 0, shares: [] };

  // Get the experience + creator
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    include: { creator: true },
  });
  if (!exp) return { totalReward: 0, shares: [] };

  const shares = await computeRoyaltyShares(experienceId);
  const totalReward = baseReward;

  // Distribute via ledger
  const lines: Array<{ account: string; debit: number; credit: number; memo?: string }> = [
    // Debit reward pool (credit = total reward out)
    { account: ACCOUNTS.REWARD_POOL, debit: 0, credit: totalReward, memo: `engagement reward for ${exp.title}` },
  ];

  // Platform share
  const platformAmount = Math.round(totalReward * PLATFORM_SHARE_BPS / 10000);
  if (platformAmount > 0) {
    lines.push({ account: ACCOUNTS.PLATFORM_REVENUE, debit: platformAmount, credit: 0, memo: 'platform share' });
  }

  // Creator engagement share
  const creatorAmount = Math.round(totalReward * CREATOR_ENGAGEMENT_BPS / 10000);
  if (creatorAmount > 0) {
    lines.push({ account: ACCOUNTS.CREATOR_WALLET(exp.creatorId), debit: creatorAmount, credit: 0, memo: 'creator engagement reward' });
  }

  // Lineage share — split among fork ancestors. The remaining amount is
  // calculated as a residual so debits always sum to exactly totalReward.
  const lineageAmount = totalReward - platformAmount - creatorAmount;
  if (lineageAmount > 0 && shares.length > 0) {
    let distributed = 0;
    for (let i = 0; i < shares.length; i++) {
      const share = shares[i];
      if (i === shares.length - 1) {
        // Last share gets the residual to ensure exact balance
        const shareAmount = lineageAmount - distributed;
        if (shareAmount > 0) {
          lines.push({ account: ACCOUNTS.CREATOR_WALLET(share.creatorId), debit: shareAmount, credit: 0, memo: `lineage: ${share.role}` });
          distributed += shareAmount;
        }
      } else {
        const shareAmount = Math.round(lineageAmount * share.shareBps / 10000);
        if (shareAmount > 0) {
          lines.push({ account: ACCOUNTS.CREATOR_WALLET(share.creatorId), debit: shareAmount, credit: 0, memo: `lineage: ${share.role}` });
          distributed += shareAmount;
        }
      }
    }
  }

  await ledger.post(lines, `engagement: ${exp.title}`);

  // Update creator's totalLiquid
  await db.creatorRecord.update({
    where: { id: exp.creatorId },
    data: { totalLiquid: { increment: creatorAmount } },
  }).catch(() => {});

  return { totalReward, shares };
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
