import { NextResponse } from 'next/server';
import { ledger } from '@/lib/token-store';

/**
 * GET /api/ledger/accounts
 */
export async function GET() {
  const accounts = await ledger.listAccounts();
  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      kind: a.kind,
      balanceLiquid: a.balance / 1_000_000, // micro → Liquid
      balanceMicro: a.balance,
    })),
  });
}
