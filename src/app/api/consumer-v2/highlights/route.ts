import { NextResponse } from 'next/server';
import { getHighlightsForHome } from '@/lib/consumer-v2/consumer-service';

export async function GET() {
  const highlights = await getHighlightsForHome(10);
  return NextResponse.json({ highlights });
}
