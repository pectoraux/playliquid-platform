/**
 * ADR-006: Liquid Wallet Service
 * -------------------------------
 * Liquid is NOT a reward currency. 1 Liquid = 1 XOF.
 * Liquid enters the ecosystem ONLY through purchases.
 *
 * This service manages:
 *   - Wallet balance (micro-XOF)
 *   - Purchases (PaySwap integration stub)
 *   - Transfers (only for payouts and spending)
 *   - Ledger integration (double-entry)
 */

import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import { ACCOUNTS } from '@/kernel/ledger';

const MICRO_XOF_PER_LIQUID = 1_000_000;

/**
 * Get or create a wallet for a user.
 */
export async function getWallet(userId: string): Promise<{
  userId: string;
  balanceXof: number;
  balanceLiquid: number;
  totalPurchased: number;
  totalSpent: number;
  totalWon: number;
}> {
  let wallet = await db.liquidWalletRecord.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await db.liquidWalletRecord.create({ data: { userId } });
  }
  return {
    userId: wallet.userId,
    balanceXof: wallet.balanceXof,
    balanceLiquid: wallet.balanceXof / MICRO_XOF_PER_LIQUID,
    totalPurchased: wallet.totalPurchased,
    totalSpent: wallet.totalSpent,
    totalWon: wallet.totalWon,
  };
}

/**
 * Purchase Liquid via PaySwap (or future provider).
 * This is the ONLY way Liquid enters circulation.
 */
export async function purchaseLiquid(params: {
  userId: string;
  amountXof: number;
  paymentProvider?: string;
  paymentRef?: string;
}): Promise<{ purchaseId: string; status: string }> {
  const purchase = await db.liquidPurchaseRecord.create({
    data: {
      userId: params.userId,
      amountXof: params.amountXof,
      paymentProvider: params.paymentProvider ?? 'payswap',
      paymentRef: params.paymentRef,
      status: 'COMPLETED', // In production, this would be PENDING until webhook
      completedAt: new Date(),
    },
  });

  // Credit the wallet
  await db.liquidWalletRecord.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      balanceXof: params.amountXof,
      totalPurchased: params.amountXof,
    },
    update: {
      balanceXof: { increment: params.amountXof },
      totalPurchased: { increment: params.amountXof },
    },
  });

  // Record in ledger: platform clearing → player wallet
  await ledger.post([
    { account: ACCOUNTS.PLATFORM_CLEARING, debit: 0, credit: params.amountXof, memo: `Liquid purchase by ${params.userId}` },
    { account: `player:wallet:${params.userId}`, debit: params.amountXof, credit: 0, memo: `Liquid purchase` },
  ], `Liquid purchase: ${params.amountXof / MICRO_XOF_PER_LIQUID}L`);

  return { purchaseId: purchase.id, status: 'COMPLETED' };
}

/**
 * Debit Liquid from a wallet (for purchasing minutes, entry fees, etc.)
 */
export async function debitWallet(userId: string, amountXof: number, reason: string): Promise<{ ok: boolean; error?: string }> {
  const wallet = await db.liquidWalletRecord.findUnique({ where: { userId } });
  if (!wallet || wallet.balanceXof < amountXof) {
    return { ok: false, error: 'Insufficient balance' };
  }

  await db.liquidWalletRecord.update({
    where: { userId },
    data: {
      balanceXof: { decrement: amountXof },
      totalSpent: { increment: amountXof },
    },
  });

  return { ok: true };
}

/**
 * Credit Liquid to a wallet (ONLY for leaderboard payouts)
 */
export async function creditWalletFromPayout(userId: string, amountXof: number, payoutId: string): Promise<void> {
  await db.liquidWalletRecord.upsert({
    where: { userId },
    create: {
      userId,
      balanceXof: amountXof,
      totalWon: amountXof,
    },
    update: {
      balanceXof: { increment: amountXof },
      totalWon: { increment: amountXof },
    },
  });

  // Ledger: prize pool → player wallet
  await ledger.post([
    { account: ACCOUNTS.PRIZE_POOL, debit: 0, credit: amountXof, memo: `Leaderboard payout ${payoutId}` },
    { account: `player:wallet:${userId}`, debit: amountXof, credit: 0, memo: `Leaderboard payout` },
  ], `Payout: ${amountXof / MICRO_XOF_PER_LIQUID}L to ${userId}`);
}
