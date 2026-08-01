import { NextResponse } from 'next/server';
import { getAICouncilInsights } from '@/lib/multiverse/multiverse-service';

export async function GET(_req: Request, { params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params;
  const insights = await getAICouncilInsights(worldId);
  return NextResponse.json({ insights });
}
