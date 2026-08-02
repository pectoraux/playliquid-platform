/**
 * ADR-007/008: Revenue Split + Prize Pool Service
 * -------------------------------------------------
 * When a competitive session ends, the revenue from purchased minutes
 * is split: Platform 20% / Creator 30% / Prize Pool 50%.
 *
 * The prize pool accumulates and is distributed to leaderboard top 3
 * at the end of each payout cycle.
 *
 * Extension royalties (ADR-009) come from the creator's 30% share.
 */

import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import { ACCOUNTS } from '@/kernel/ledger';
import { debitWallet } from './liquid-wallet-service';

const MICRO_XOF_PER_LIQUID = 1_000_000;

/**
 * Ensure a prize pool exists for an experience.
 */
export async function ensurePrizePool(experienceId: string, experienceName: string): Promise<string> {
  const existing = await db.prizePoolRecord.findUnique({ where: { experienceId } });
  if (existing) return existing.id;

  const pool = await db.prizePoolRecord.create({
    data: { experienceId, experienceName },
  });
  return pool.id;
}

/**
 * Process revenue split when a competitive session consumes minutes.
 * Called when minutes are used during competitive play.
 *
 * Revenue = minutesUsed × pricePerMinuteXof
 *
 * Split:
 *   Platform: 20% → platform:revenue
 *   Creator:  30% → creator:wallet (minus extension royalties)
 *   Prize Pool: 50% → pool:prize
 */
export async function processRevenueSplit(params: {
  experienceId: string;
  experienceName: string;
  creatorId: string;
  userId: string;
  minutesUsed: number;
  pricePerMinuteXof: number;
}): Promise<{
  totalRevenue: number;
  platformShare: number;
  creatorShare: number;
  prizePoolShare: number;
  extensionRoyalties: number;
  creatorNet: number;
}> {
  const totalRevenue = params.minutesUsed * params.pricePerMinuteXof;

  // Ensure prize pool exists
  const poolId = await ensurePrizePool(params.experienceId, params.experienceName);
  const pool = await db.prizePoolRecord.findUnique({ where: { id: poolId } });
  if (!pool) throw new Error('Prize pool not found');

  const platformShare = Math.floor(totalRevenue * pool.platformShareBps / 10000);
  const creatorShare = Math.floor(totalRevenue * pool.creatorShareBps / 10000);
  const prizePoolShare = totalRevenue - platformShare - creatorShare;

  // Calculate extension royalties from creator share
  const extensionRoyalties = await calculateExtensionRoyalties(params.experienceId, creatorShare);
  const creatorNet = creatorShare - extensionRoyalties;

  // Debit from player wallet
  await debitWallet(params.userId, totalRevenue, `Competitive play: ${params.experienceName}`);

  // Credit via ledger (double-entry)
  // Player wallet → platform revenue + creator wallet + prize pool + extension creators
  const lines: Array<{ account: string; debit: number; credit: number; memo?: string }> = [
    { account: `player:wallet:${params.userId}`, debit: 0, credit: totalRevenue, memo: `competitive play: ${params.experienceName}` },
    { account: ACCOUNTS.PLATFORM_REVENUE, debit: platformShare, credit: 0, memo: 'platform share 20%' },
    { account: ACCOUNTS.CREATOR_WALLET(params.creatorId), debit: creatorNet, credit: 0, memo: 'creator share (net of extension royalties)' },
    { account: ACCOUNTS.PRIZE_POOL, debit: prizePoolShare, credit: 0, memo: 'prize pool 50%' },
  ];

  // Extension royalty distributions
  const extensions = await getExtensionConfigs(params.experienceId);
  for (const ext of extensions) {
    const extRoyalty = Math.floor(creatorShare * ext.royaltyBps / 10000);
    if (extRoyalty > 0) {
      lines.push({
        account: ACCOUNTS.CREATOR_WALLET(ext.extensionCreatorId),
        debit: extRoyalty,
        credit: 0,
        memo: `extension royalty: ${ext.extensionName}`,
      });

      // Record distribution
      await db.extensionRoyaltyDistributionRecord.create({
        data: {
          experienceId: params.experienceId,
          extensionId: ext.extensionId,
          extensionName: ext.extensionName,
          extensionCreatorId: ext.extensionCreatorId,
          gameCreatorId: params.creatorId,
          grossRevenueXof: totalRevenue,
          creatorShareXof: creatorShare,
          extensionRoyaltyXof: extRoyalty,
          gameCreatorNetXof: creatorNet,
        },
      });
    }
  }

  await ledger.post(lines, `Revenue split: ${params.experienceName} (${totalRevenue / MICRO_XOF_PER_LIQUID}L)`);

  // Update prize pool
  await db.prizePoolRecord.update({
    where: { id: poolId },
    data: {
      totalAccumulated: { increment: totalRevenue },
      currentBalance: { increment: prizePoolShare },
    },
  });

  // Update creator's totalLiquid
  await db.creatorRecord.update({
    where: { id: params.creatorId },
    data: { totalLiquid: { increment: creatorNet } },
  }).catch(() => {});

  return {
    totalRevenue,
    platformShare,
    creatorShare,
    prizePoolShare,
    extensionRoyalties,
    creatorNet,
  };
}

/**
 * Calculate total extension royalties for an experience.
 */
async function calculateExtensionRoyalties(experienceId: string, creatorShare: number): Promise<number> {
  const extensions = await getExtensionConfigs(experienceId);
  let total = 0;
  for (const ext of extensions) {
    total += Math.floor(creatorShare * ext.royaltyBps / 10000);
  }
  return total;
}

/**
 * Get extension royalty configs for an experience's extensions.
 */
async function getExtensionConfigs(experienceId: string): Promise<Array<{
  extensionId: string;
  extensionName: string;
  extensionCreatorId: string;
  royaltyBps: number;
}>> {
  // Get the experience's bundle
  const exp = await db.experienceRecord.findUnique({ where: { id: experienceId } });
  if (!exp?.bundleHash) return [];

  const bundle = await db.bundleRecord.findUnique({
    where: { contentHash: exp.bundleHash },
    include: { instances: { include: { extension: true } } },
  });
  if (!bundle) return [];

  const configs: Array<{ extensionId: string; extensionName: string; extensionCreatorId: string; royaltyBps: number }> = [];

  for (const inst of bundle.instances) {
    const royaltyConfig = await db.extensionRoyaltyConfigRecord.findUnique({
      where: { extensionId: inst.extensionId },
    });
    if (royaltyConfig && royaltyConfig.royaltyBps > 0) {
      // Get extension creator
      const extRecord = await db.extensionRecord.findUnique({ where: { id: inst.extensionId } });
      if (extRecord) {
        configs.push({
          extensionId: inst.extensionId,
          extensionName: royaltyConfig.extensionName,
          extensionCreatorId: extRecord.author,
          royaltyBps: royaltyConfig.royaltyBps,
        });
      }
    }
  }

  return configs;
}

/**
 * Get prize pool status for an experience.
 */
export async function getPrizePool(experienceId: string): Promise<any | null> {
  const pool = await db.prizePoolRecord.findUnique({ where: { experienceId } });
  if (!pool) return null;
  return {
    id: pool.id,
    experienceId: pool.experienceId,
    totalAccumulated: pool.totalAccumulated,
    totalDistributed: pool.totalDistributed,
    currentBalance: pool.currentBalance,
    currentBalanceLiquid: pool.currentBalance / MICRO_XOF_PER_LIQUID,
    config: {
      platformShareBps: pool.platformShareBps,
      creatorShareBps: pool.creatorShareBps,
      prizePoolShareBps: pool.prizePoolShareBps,
      firstPlaceBps: pool.firstPlaceBps,
      secondPlaceBps: pool.secondPlaceBps,
      thirdPlaceBps: pool.thirdPlaceBps,
    },
  };
}
