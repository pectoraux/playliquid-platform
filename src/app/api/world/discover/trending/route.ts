import { NextResponse } from 'next/server';
import { getTrending } from '@/lib/world/discovery-service';

export async function GET() {
  const trending = await getTrending(10);
  return NextResponse.json({ trending });
}
