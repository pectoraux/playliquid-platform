import { NextResponse } from 'next/server';
import { getGlobalDiscoveryGraph } from '@/lib/intelligence/discovery-graph-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 15);
  const edges = await getGlobalDiscoveryGraph(limit);
  return NextResponse.json({ edges });
}
