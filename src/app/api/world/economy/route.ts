import { NextResponse } from 'next/server';
import { getEconomySummary } from '@/lib/world/economy-service';

export async function GET() {
  const summary = await getEconomySummary();
  return NextResponse.json({ summary });
}
