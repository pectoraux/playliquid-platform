import { NextResponse } from 'next/server';
import { getMarketplaceHome } from '@/lib/universe/marketplace-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') ?? 'demo-user';
  const home = await getMarketplaceHome(userId);
  return NextResponse.json({ home });
}
