import { NextRequest, NextResponse } from 'next/server';
import { runCreatorAITeam } from '@/lib/creator-intel/ai-team-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const insights = await runCreatorAITeam(body.creatorId ?? 'creator_demo', body.experienceId);
  return NextResponse.json({ insights });
}
