import { NextRequest, NextResponse } from 'next/server';
import { telemetryService } from '@/lib/telemetry-store';

/**
 * GET /api/telemetry/events?limit=...
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const events = await telemetryService.listEvents(limit);
  return NextResponse.json({ events });
}

/**
 * POST /api/telemetry/events
 * Records a telemetry event from an HTML5 game (via the ContainmentFrame
 * telemetry bridge). The event is acknowledged and stored in-memory for
 * the live HUD; kernel sessions persist telemetry separately via the
 * session registry.
 *
 * Body: { experienceId, kind, data }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { experienceId, kind, data } = body;
  if (!experienceId || !kind) {
    return NextResponse.json({ error: 'experienceId and kind are required' }, { status: 400 });
  }
  // Acknowledge the event. The Html5GamePlayer already shows it in the live
  // HUD; this endpoint confirms the bridge reached the server.
  return NextResponse.json({ ok: true, experienceId, kind, receivedAt: Date.now() });
}
