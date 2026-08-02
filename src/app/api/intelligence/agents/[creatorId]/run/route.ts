import { NextResponse } from 'next/server';
import { runAutonomousAgents } from '@/lib/intelligence/autonomous-agents-service';

export async function POST(_req: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const result = await runAutonomousAgents(creatorId);
  return NextResponse.json(result);
}
