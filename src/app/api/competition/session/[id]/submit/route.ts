import { NextRequest, NextResponse } from 'next/server';
import { submitCompetitiveScore } from '@/lib/competition/competitive-session-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = await submitCompetitiveScore({ sessionId: id, score: body.score });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
