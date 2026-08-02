import { NextRequest, NextResponse } from 'next/server';
import { recomputeDiscoveryGraph } from '@/lib/intelligence/discovery-graph-service';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const experienceId = body.experienceId as string | undefined;
  const result = await recomputeDiscoveryGraph(experienceId);
  return NextResponse.json(result);
}
