import { NextResponse } from 'next/server';
import { endSession } from '@/lib/session-registry';

/**
 * POST /api/kernel/sessions/:id/settle
 * Ends the session. Settles liquid-backed tokens to the player wallet,
 * records telemetry, and removes the in-memory session.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await endSession(id, 'completed');
  return NextResponse.json({ ok: true, sessionId: id });
}
