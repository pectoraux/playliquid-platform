import { NextRequest, NextResponse } from 'next/server';
import { executeMarketTransaction, getMarketHistory } from '@/lib/living/economy-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const worldId = url.searchParams.get('worldId');
  if (!worldId) return NextResponse.json({ error: 'worldId required' }, { status: 400 });
  const history = await getMarketHistory(worldId);
  return NextResponse.json({ history });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await executeMarketTransaction(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
