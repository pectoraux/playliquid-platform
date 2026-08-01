import { NextResponse } from 'next/server';
import { getAssets } from '@/lib/asset-economy/asset-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? undefined;
  const sort = url.searchParams.get('sort') as any ?? 'trending';
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const assets = await getAssets({ type, sort, limit });
  return NextResponse.json({ assets });
}
