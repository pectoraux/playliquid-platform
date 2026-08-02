import { NextResponse } from 'next/server';
import { getDesignSession } from '@/lib/game-creation/generation-orchestrator';

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await getDesignSession(sessionId);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json(session);
}
