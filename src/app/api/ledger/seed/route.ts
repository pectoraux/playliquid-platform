import { NextResponse } from 'next/server';
import { ledger } from '@/lib/token-store';
import { ACCOUNTS } from '@/kernel/ledger';

/**
 * POST /api/ledger/seed
 * Seeds the reward pool with an initial Liquid balance (for demo purposes).
 * In production this would be funded by player purchases.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const amountLiquid = (body?.amountLiquid as number) ?? 1000;
  const amountMicro = Math.floor(amountLiquid * 1_000_000);

  // Credit reward pool from platform clearing (double-entry)
  await ledger.post(
    [
      { account: ACCOUNTS.PLATFORM_CLEARING, debit: 0, credit: amountMicro, memo: 'seed funding' },
      { account: ACCOUNTS.REWARD_POOL, debit: amountMicro, credit: 0, memo: 'seed funding' },
    ],
    'reward pool seeded',
  );

  return NextResponse.json({ ok: true, seededLiquid: amountLiquid });
}
