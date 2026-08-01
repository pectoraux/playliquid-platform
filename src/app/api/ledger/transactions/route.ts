import { NextResponse } from 'next/server';
import { ledger } from '@/lib/token-store';

/**
 * GET /api/ledger/transactions
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const txs = await ledger.listTransactions(limit);
  return NextResponse.json({
    transactions: txs.map((t) => ({
      id: t.id,
      memo: t.memo,
      createdAt: t.createdAt,
      balanced: t.balanced,
      sumDebit: t.sumDebit,
      sumCredit: t.sumCredit,
      entries: t.entries.map((e) => ({
        account: e.account,
        debitLiquid: e.debit / 1_000_000,
        creditLiquid: e.credit / 1_000_000,
        memo: e.memo,
      })),
    })),
  });
}
