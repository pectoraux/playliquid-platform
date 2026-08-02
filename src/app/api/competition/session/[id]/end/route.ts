import { NextResponse } from 'next/server';
import { endCompetitiveSession } from '@/lib/competition/competitive-session-service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await endCompetitiveSession({ sessionId: id });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result);
}
