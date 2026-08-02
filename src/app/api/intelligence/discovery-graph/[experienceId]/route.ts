import { NextResponse } from 'next/server';
import { getDiscoveryGraph } from '@/lib/intelligence/discovery-graph-service';

export async function GET(req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 10);
  const graph = await getDiscoveryGraph(experienceId, limit);
  return NextResponse.json(graph);
}
