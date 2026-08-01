import { NextResponse } from 'next/server';
import { telemetryService } from '@/lib/telemetry-store';

/**
 * GET /api/telemetry/genomes?limit=...
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const genomes = await telemetryService.listGenomes(limit);
  return NextResponse.json({ genomes });
}
