import { NextResponse } from 'next/server';
import { tokenService } from '@/lib/token-store';

/**
 * GET /api/tokens/events?sessionId=...&limit=...
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }
  const events = await tokenService.listEvents(sessionId, limit);
  return NextResponse.json({ events, sessionId });
}
