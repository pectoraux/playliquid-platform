import { NextResponse } from 'next/server';
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
