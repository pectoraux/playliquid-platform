import { NextResponse } from 'next/server';
import { tokenService } from '@/lib/token-store';

/**
 * GET /api/tokens/balances?sessionId=...
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }
  const balances = await tokenService.listBalances(sessionId);
  return NextResponse.json({ balances, sessionId });
}
