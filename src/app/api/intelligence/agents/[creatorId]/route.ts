import { NextResponse } from 'next/server';
import { getAgentInsights } from '@/lib/intelligence/autonomous-agents-service';

export async function GET(req: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 30);
  const agentType = url.searchParams.get('agentType') ?? undefined;
  const insights = agentType
    ? await import('@/lib/intelligence/autonomous-agents-service').then((m) => m.getAgentInsightsByType(creatorId, agentType as any, limit))
    : await getAgentInsights(creatorId, limit);
  return NextResponse.json({ insights });
}
