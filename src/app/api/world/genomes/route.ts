import { NextResponse } from 'next/server';
import { telemetryService } from '@/lib/telemetry-store';

export async function GET() {
  const genomes = await telemetryService.listGenomes(50);
  return NextResponse.json({ genomes });
}
