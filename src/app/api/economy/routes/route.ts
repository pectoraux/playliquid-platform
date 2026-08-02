import { NextRequest, NextResponse } from 'next/server';
import { createTradeRoute, getTradeRoutes } from '@/lib/living/economy-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const worldId = url.searchParams.get('worldId');
  if (!worldId) return NextResponse.json({ error: 'worldId required' }, { status: 400 });
  const routes = await getTradeRoutes(worldId);
  return NextResponse.json({ routes });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await createTradeRoute(body);
  return NextResponse.json(result);
}
