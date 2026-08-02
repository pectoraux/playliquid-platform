/**
 * ADR-008: Purchased Minutes Service
 * ------------------------------------
 * Players buy minutes for a specific experience.
 * Competitive sessions consume minutes, track attempts, and submit highest score.
 *
 * Flow:
 *   1. Player purchases minutes (debits Liquid wallet)
 *   2. Competitive session starts (timer begins)
 *   3. Player plays, can restart multiple times
 *   4. Each attempt's score is tracked; highest counts
 *   5. Session ends → minutes consumed → revenue split processed
 */

import { db } from '@/lib/db';
import { debitWallet } from './liquid-wallet-service';
import { processRevenueSplit } from './revenue-split-service';

/**
 * Purchase minutes for an experience.
 */
export async function purchaseMinutes(params: {
  userId: string;
  experienceId: string;
  minutes: number;
}): Promise<{ purchaseId: string; totalPaidXof: number; error?: string }> {
  const exp = await db.experienceRecord.findUnique({ where: { id: params.experienceId } });
  if (!exp) return { purchaseId: '', totalPaidXof: 0, error: 'Experience not found' };
  if (!exp.competitiveEligible) return { purchaseId: '', totalPaidXof: 0, error: 'Experience is not competitive' };
  if (params.minutes < exp.minMinutesPurchase) return { purchaseId: '', totalPaidXof: 0, error: `Minimum purchase is ${exp.minMinutesPurchase} minutes` };
  if (params.minutes > exp.maxMinutesPurchase) return { purchaseId: '', totalPaidXof: 0, error: `Maximum purchase is ${exp.maxMinutesPurchase} minutes` };

  const totalPaidXof = params.minutes * exp.pricePerMinuteXof;

  // Debit wallet
  const debitResult = await debitWallet(params.userId, totalPaidXof, `Minutes purchase: ${exp.title}`);
  if (!debitResult.ok) return { purchaseId: '', totalPaidXof: 0, error: debitResult.error };

  const purchase = await db.minutePurchaseRecord.create({
    data: {
      userId: params.userId,
      experienceId: params.experienceId,
      experienceName: exp.title,
      minutesPurchased: params.minutes,
      pricePerMinuteXof: exp.pricePerMinuteXof,
      totalPaidXof,
    },
  });

  return { purchaseId: purchase.id, totalPaidXof };
}

/**
 * Get active minute purchases for a user + experience.
 */
export async function getActiveMinutes(userId: string, experienceId: string): Promise<{
  purchaseId: string;
  minutesRemaining: number;
  minutesPurchased: number;
  minutesUsed: number;
} | null> {
  const purchase = await db.minutePurchaseRecord.findFirst({
    where: { userId, experienceId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  if (!purchase) return null;

  return {
    purchaseId: purchase.id,
    minutesRemaining: purchase.minutesPurchased - purchase.minutesUsed,
    minutesPurchased: purchase.minutesPurchased,
    minutesUsed: purchase.minutesUsed,
  };
}

/**
 * Consume minutes when a competitive session ends.
 * Triggers the revenue split.
 */
export async function consumeMinutes(params: {
  purchaseId: string;
  minutesUsed: number;
  experienceId: string;
  experienceName: string;
  creatorId: string;
  userId: string;
}): Promise<{ revenueSplit?: any; error?: string }> {
  const purchase = await db.minutePurchaseRecord.findUnique({ where: { id: params.purchaseId } });
  if (!purchase) return { error: 'Purchase not found' };
  if (purchase.status !== 'ACTIVE') return { error: 'Purchase is not active' };

  const actualMinutesUsed = Math.min(params.minutesUsed, purchase.minutesPurchased - purchase.minutesUsed);
  const newMinutesUsed = purchase.minutesUsed + actualMinutesUsed;
  const isExhausted = newMinutesUsed >= purchase.minutesPurchased;

  await db.minutePurchaseRecord.update({
    where: { id: params.purchaseId },
    data: {
      minutesUsed: newMinutesUsed,
      status: isExhausted ? 'EXHAUSTED' : 'ACTIVE',
    },
  });

  // Process revenue split for consumed minutes
  if (actualMinutesUsed > 0) {
    const revenueSplit = await processRevenueSplit({
      experienceId: params.experienceId,
      experienceName: params.experienceName,
      creatorId: params.creatorId,
      userId: params.userId,
      minutesUsed: actualMinutesUsed,
      pricePerMinuteXof: purchase.pricePerMinuteXof,
    });

    return { revenueSplit };
  }

  return {};
}

/**
 * Get a user's minute purchase history.
 */
export async function getMinutePurchases(userId: string): Promise<any[]> {
  const purchases = await db.minutePurchaseRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return purchases.map((p) => ({
    id: p.id,
    experienceId: p.experienceId,
    experienceName: p.experienceName,
    minutesPurchased: p.minutesPurchased,
    minutesUsed: p.minutesUsed,
    minutesRemaining: p.minutesPurchased - p.minutesUsed,
    pricePerMinuteXof: p.pricePerMinuteXof,
    totalPaidXof: p.totalPaidXof,
    status: p.status,
    createdAt: p.createdAt.getTime(),
  }));
}
