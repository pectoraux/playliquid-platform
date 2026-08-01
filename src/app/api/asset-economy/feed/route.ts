import { NextResponse } from 'next/server';
import { getAssetDiscoveryFeed } from '@/lib/asset-economy/asset-service';

export async function GET() {
  const feed = await getAssetDiscoveryFeed();
  return NextResponse.json({ feed });
}
